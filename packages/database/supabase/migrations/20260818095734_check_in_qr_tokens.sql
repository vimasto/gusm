begin;

create type private.check_in_qr_scan_result as enum (
  'checked_in',
  'already_present',
  'no_current_booking'
);

create table private.check_in_qr_token (
  qr_token_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_user(user_id) on delete restrict,
  booking_date date not null,
  time_block_id smallint not null references public.time_block(time_block_id) on delete restrict,
  token_hash bytea not null unique check (octet_length(token_hash) = 32),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  scanned_at timestamptz,
  scanned_by_user_id uuid references public.app_user(user_id) on delete restrict,
  scan_result private.check_in_qr_scan_result,
  revoked_at timestamptz,
  check (expires_at > issued_at),
  check (
    (scanned_at is null and scanned_by_user_id is null and scan_result is null)
    or (scanned_at is not null and scanned_by_user_id is not null and scan_result is not null)
  ),
  check (scanned_at is null or revoked_at is null)
);

create index check_in_qr_token_user_block_idx
  on private.check_in_qr_token (user_id, booking_date, time_block_id, issued_at desc);
create index check_in_qr_token_pending_expiry_idx
  on private.check_in_qr_token (expires_at)
  where scanned_at is null and revoked_at is null;

alter table private.check_in_qr_token enable row level security;
revoke all on table private.check_in_qr_token from public, anon, authenticated;

create or replace function private.current_check_in_qr_window()
returns table (booking_date date, time_block_id smallint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (now() at time zone 'America/Santiago')::date as booking_date,
    time_block.time_block_id
  from public.time_block as time_block
  where extract(isodow from now() at time zone 'America/Santiago') between 1 and 5
    and now() >= private.block_starts_at(
    (now() at time zone 'America/Santiago')::date,
    time_block.time_block_id
  )
    and now() < private.block_starts_at(
      (now() at time zone 'America/Santiago')::date,
      time_block.time_block_id
    ) + interval '15 minutes'
  limit 1;
$$;

create or replace function public.issue_check_in_qr(
  p_user_id uuid,
  p_token_hash bytea
)
returns table (
  state text,
  qr_token_id uuid,
  booking_date date,
  time_block_id smallint,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window record;
  v_token private.check_in_qr_token%rowtype;
begin
  if octet_length(p_token_hash) <> 32 then
    raise exception 'check-in token hash must have exactly 32 bytes';
  end if;

  if not exists (
    select 1
    from public.app_user as app_user
    join public.system_settings as system_settings on system_settings.singleton
    where app_user.user_id = p_user_id
      and app_user.disabled_at is null
      and app_user.accepted_terms_version = system_settings.current_terms_version
  ) then
    raise exception 'active user with current terms acceptance is required';
  end if;

  select * into v_window from private.current_check_in_qr_window();

  if found then
    update private.check_in_qr_token
    set revoked_at = now()
    where user_id = p_user_id
      and booking_date = v_window.booking_date
      and time_block_id = v_window.time_block_id
      and scanned_at is null
      and revoked_at is null;

    insert into private.check_in_qr_token (
      user_id,
      booking_date,
      time_block_id,
      token_hash,
      expires_at
    )
    values (
      p_user_id,
      v_window.booking_date,
      v_window.time_block_id,
      p_token_hash,
      least(
        now() + interval '45 seconds',
        private.block_starts_at(v_window.booking_date, v_window.time_block_id) + interval '15 minutes'
      )
    )
    returning * into v_token;

    return query
    select
      'ready'::text,
      v_token.qr_token_id,
      v_token.booking_date,
      v_token.time_block_id,
      v_token.expires_at;
    return;
  end if;

  if exists (
    select 1
    from public.booking as booking
    where booking.user_id = p_user_id
      and booking.booking_date = (now() at time zone 'America/Santiago')::date
      and booking.status = 'absent'
      and now() >= private.block_starts_at(booking.booking_date, booking.time_block_id) + interval '15 minutes'
      and now() < private.block_ends_at(booking.booking_date, booking.time_block_id)
  ) then
    return query select 'arrived_too_late'::text, null::uuid, null::date, null::smallint, null::timestamptz;
    return;
  end if;

  return query select 'outside_window'::text, null::uuid, null::date, null::smallint, null::timestamptz;
end;
$$;

create or replace function public.get_check_in_qr_status(
  p_user_id uuid,
  p_qr_token_id uuid
)
returns table (
  state text,
  scanned_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token private.check_in_qr_token%rowtype;
begin
  if not exists (
    select 1
    from public.app_user as app_user
    join public.system_settings as system_settings on system_settings.singleton
    where app_user.user_id = p_user_id
      and app_user.disabled_at is null
      and app_user.accepted_terms_version = system_settings.current_terms_version
  ) then
    raise exception 'active user with current terms acceptance is required';
  end if;

  select * into v_token
  from private.check_in_qr_token
  where qr_token_id = p_qr_token_id
    and user_id = p_user_id;

  if not found then
    return query select 'not_found'::text, null::timestamptz;
  elsif v_token.scanned_at is not null then
    return query select v_token.scan_result::text, v_token.scanned_at;
  elsif v_token.revoked_at is not null or now() >= v_token.expires_at then
    return query select 'expired'::text, null::timestamptz;
  else
    return query select 'pending'::text, null::timestamptz;
  end if;
end;
$$;

create or replace function public.consume_check_in_qr(
  p_scanner_user_id uuid,
  p_token_hash bytea
)
returns table (
  state text,
  scanned_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_scanner_role public.app_role;
  v_token private.check_in_qr_token%rowtype;
  v_booking public.booking%rowtype;
  v_window record;
  v_result private.check_in_qr_scan_result;
  v_scanned_at timestamptz := now();
begin
  if octet_length(p_token_hash) <> 32 then
    return query select 'invalid_token'::text, null::timestamptz;
    return;
  end if;

  select app_user.role into v_scanner_role
  from public.app_user as app_user
  join public.system_settings as system_settings on system_settings.singleton
  where app_user.user_id = p_scanner_user_id
    and app_user.disabled_at is null
    and app_user.accepted_terms_version = system_settings.current_terms_version;

  if v_scanner_role is null or v_scanner_role not in ('gym_staff', 'admin') then
    raise exception 'an active gym staff user with current terms acceptance is required';
  end if;

  select * into v_token
  from private.check_in_qr_token
  where token_hash = p_token_hash
  for update;

  if not found then
    return query select 'invalid_token'::text, null::timestamptz;
    return;
  elsif v_token.scanned_at is not null then
    return query select 'token_used'::text, v_token.scanned_at;
    return;
  elsif v_token.revoked_at is not null or v_scanned_at >= v_token.expires_at then
    return query select 'token_expired'::text, null::timestamptz;
    return;
  end if;

  select * into v_window from private.current_check_in_qr_window();

  if not found
    or v_window.booking_date <> v_token.booking_date
    or v_window.time_block_id <> v_token.time_block_id then
    update private.check_in_qr_token
    set revoked_at = v_scanned_at
    where qr_token_id = v_token.qr_token_id;

    return query select 'token_expired'::text, null::timestamptz;
    return;
  end if;

  select * into v_booking
  from public.booking as booking
  where booking.user_id = v_token.user_id
    and booking.booking_date = v_token.booking_date
    and booking.time_block_id = v_token.time_block_id
  for update;

  if found and v_booking.status = 'reserved' then
    update public.booking
    set status = 'absent', absent_at = v_scanned_at
    where booking_id = v_booking.booking_id
    returning * into v_booking;

    insert into public.user_warning (user_id, booking_id, warning_type)
    values (v_booking.user_id, v_booking.booking_id, 'missed_confirmation')
    on conflict (booking_id, warning_type) where booking_id is not null do nothing;

    insert into public.booking_event (booking_id, event_type)
    values (v_booking.booking_id, 'expired_to_absent');
  end if;

  if found and v_booking.status = 'confirmed' then
    update public.booking
    set status = 'present', present_at = v_scanned_at, qr_scanned_at = v_scanned_at
    where booking_id = v_booking.booking_id;

    insert into public.booking_event (booking_id, event_type, actor_user_id)
    values (v_booking.booking_id, 'qr_check_in', p_scanner_user_id);

    v_result := 'checked_in';
  elsif found and v_booking.status = 'present' then
    v_result := 'already_present';
  else
    v_result := 'no_current_booking';
  end if;

  update private.check_in_qr_token
  set
    scanned_at = v_scanned_at,
    scanned_by_user_id = p_scanner_user_id,
    scan_result = v_result
  where qr_token_id = v_token.qr_token_id;

  return query select v_result::text, v_scanned_at;
end;
$$;

revoke all on function private.current_check_in_qr_window() from public, anon, authenticated;
revoke all on function public.issue_check_in_qr(uuid, bytea) from public, anon, authenticated;
revoke all on function public.get_check_in_qr_status(uuid, uuid) from public, anon, authenticated;
revoke all on function public.consume_check_in_qr(uuid, bytea) from public, anon, authenticated;
grant execute on function public.issue_check_in_qr(uuid, bytea) to service_role;
grant execute on function public.get_check_in_qr_status(uuid, uuid) to service_role;
grant execute on function public.consume_check_in_qr(uuid, bytea) to service_role;

comment on table private.check_in_qr_token is
  'One-use opaque check-in tokens. Only SHA-256 hashes are stored; a token is bound to one date and time block.';
comment on function public.issue_check_in_qr(uuid, bytea) is
  'Server-only QR issuer. Tokens are valid only during the first 15 minutes of the bound block.';
comment on function public.consume_check_in_qr(uuid, bytea) is
  'Server-only scanner operation for gym staff. Zebra USB scanners submit an opaque QR token as HID keyboard input.';

commit;
