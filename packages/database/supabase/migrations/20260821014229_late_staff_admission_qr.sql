begin;

create or replace function private.current_active_time_block()
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
    and now() < private.block_ends_at(
      (now() at time zone 'America/Santiago')::date,
      time_block.time_block_id
    )
  order by time_block.display_order
  limit 1;
$$;

create or replace function private.require_open_current_check_in_window()
returns table (
  booking_date date,
  time_block_id smallint,
  block_starts_at timestamptz,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window record;
begin
  select * into v_window from private.current_active_time_block();

  if not found then
    raise exception 'there is no active time block';
  end if;

  if exists (
    select 1
    from public.time_block_closure as time_block_closure
    where time_block_closure.closure_date = v_window.booking_date
      and time_block_closure.time_block_id = v_window.time_block_id
  ) or exists (
    select 1
    from public.weekly_time_block_closure as weekly_time_block_closure
    where weekly_time_block_closure.iso_weekday = extract(isodow from v_window.booking_date)::smallint
      and weekly_time_block_closure.time_block_id = v_window.time_block_id
  ) then
    raise exception 'the current time block is closed';
  end if;

  return query
  select
    v_window.booking_date,
    v_window.time_block_id,
    private.block_starts_at(v_window.booking_date, v_window.time_block_id),
    private.block_ends_at(v_window.booking_date, v_window.time_block_id);
end;
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
  v_normal_window record;
  v_active_window record;
  v_booking public.booking%rowtype;
  v_token private.check_in_qr_token%rowtype;
begin
  if octet_length(p_token_hash) <> 32 then
    raise exception 'check-in token hash must have exactly 32 bytes';
  end if;

  perform private.require_current_terms_user(p_user_id);

  select * into v_normal_window from private.current_check_in_qr_window();

  if found then
    select * into v_booking
    from public.booking as booking
    where booking.user_id = p_user_id
      and booking.booking_date = v_normal_window.booking_date
      and booking.time_block_id = v_normal_window.time_block_id
      and booking.status = 'confirmed';

    if not found then
      return query select 'no_current_booking'::text, null::uuid, null::date, null::smallint, null::timestamptz;
      return;
    end if;

    update private.check_in_qr_token
    set revoked_at = now()
    where user_id = p_user_id
      and booking_date = v_normal_window.booking_date
      and time_block_id = v_normal_window.time_block_id
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
      v_normal_window.booking_date,
      v_normal_window.time_block_id,
      p_token_hash,
      least(
        now() + interval '45 seconds',
        private.block_starts_at(v_normal_window.booking_date, v_normal_window.time_block_id) + interval '15 minutes'
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

  select * into v_active_window from private.current_active_time_block();

  if found then
    select * into v_booking
    from public.booking as booking
    where booking.user_id = p_user_id
      and booking.booking_date = v_active_window.booking_date
      and booking.time_block_id = v_active_window.time_block_id
      and booking.status = 'confirmed'
      and booking.confirmed_at > now() - interval '5 minutes';

    if found then
      update private.check_in_qr_token
      set revoked_at = now()
      where user_id = p_user_id
        and booking_date = v_active_window.booking_date
        and time_block_id = v_active_window.time_block_id
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
        v_active_window.booking_date,
        v_active_window.time_block_id,
        p_token_hash,
        least(
          now() + interval '45 seconds',
          private.block_ends_at(v_active_window.booking_date, v_active_window.time_block_id),
          v_booking.confirmed_at + interval '5 minutes'
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

    return query select 'arrived_too_late'::text, null::uuid, null::date, null::smallint, null::timestamptz;
    return;
  end if;

  return query select 'outside_window'::text, null::uuid, null::date, null::smallint, null::timestamptz;
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
  v_token private.check_in_qr_token%rowtype;
  v_booking public.booking%rowtype;
  v_active_window record;
  v_result private.check_in_qr_scan_result;
  v_scanned_at timestamptz := now();
begin
  if octet_length(p_token_hash) <> 32 then
    return query select 'invalid_token'::text, null::timestamptz;
    return;
  end if;

  perform private.require_current_staff(p_scanner_user_id);

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

  select * into v_active_window from private.current_active_time_block();

  if not found
    or v_active_window.booking_date <> v_token.booking_date
    or v_active_window.time_block_id <> v_token.time_block_id then
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

create or replace function public.reauthorize_current_staff_block_qr(
  p_actor_user_id uuid,
  p_target_user_id uuid
)
returns public.booking
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window record;
  v_booking public.booking%rowtype;
begin
  perform private.require_current_staff(p_actor_user_id);
  perform private.require_current_terms_user(p_target_user_id);
  select * into v_window from private.require_open_current_check_in_window();

  if now() < v_window.block_starts_at + interval '15 minutes' then
    raise exception 'late QR reauthorization is available after the ordinary check-in window closes';
  end if;

  select * into v_booking
  from public.booking as booking
  where booking.user_id = p_target_user_id
    and booking.booking_date = v_window.booking_date
    and booking.time_block_id = v_window.time_block_id
    and booking.status = 'confirmed'
  for update;

  if not found then
    raise exception 'a confirmed booking is required for late QR reauthorization';
  end if;

  update public.booking
  set confirmed_at = now()
  where booking_id = v_booking.booking_id
  returning * into v_booking;

  insert into public.booking_event (booking_id, event_type, actor_user_id, metadata)
  values (
    v_booking.booking_id,
    'confirmed',
    p_actor_user_id,
    '{"late_qr_reauthorized":true}'::jsonb
  );

  return v_booking;
end;
$$;

revoke all on function private.current_active_time_block() from public, anon, authenticated;
revoke all on function private.require_open_current_check_in_window() from public, anon, authenticated;
revoke all on function public.issue_check_in_qr(uuid, bytea) from public, anon, authenticated;
revoke all on function public.consume_check_in_qr(uuid, bytea) from public, anon, authenticated;
revoke all on function public.reauthorize_current_staff_block_qr(uuid, uuid) from public, anon, authenticated;
grant execute on function public.issue_check_in_qr(uuid, bytea) to service_role;
grant execute on function public.consume_check_in_qr(uuid, bytea) to service_role;
grant execute on function public.reauthorize_current_staff_block_qr(uuid, uuid) to service_role;

comment on function private.require_open_current_check_in_window() is
  'Compatibility name for the active current block required by staff admission RPCs. The ordinary QR window remains private.current_check_in_qr_window().';
comment on function public.issue_check_in_qr(uuid, bytea) is
  'Issues ordinary QR only through block start plus 15 minutes. After that, it issues only for a staff admission or reauthorization from the preceding five minutes.';
comment on function public.reauthorize_current_staff_block_qr(uuid, uuid) is
  'Server-only late-arrival fallback. It grants an existing confirmed attendee five minutes to issue and scan a QR without changing its admission source or capacity.';

commit;
