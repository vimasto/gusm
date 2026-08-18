begin;

create or replace function public.create_booking(p_time_block_id smallint, p_booking_date date)
returns public.booking
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user public.app_user%rowtype;
  v_booking public.booking%rowtype;
  v_start timestamptz;
  v_capacity smallint;
  v_daily_limit smallint;
  v_standard_count integer;
  v_daily_count integer;
  v_today date := (now() at time zone 'America/Santiago')::date;
  v_reactivate boolean := false;
  v_auto_confirm boolean := false;
begin
  if not (select private.is_active_current_user()) then
    raise exception 'current terms acceptance required';
  end if;

  select * into v_user
  from public.app_user
  where user_id = (select auth.uid())
    and disabled_at is null;

  if not found then
    raise exception 'active application user not found';
  end if;

  if p_booking_date < v_today or p_booking_date > v_today + 7 then
    raise exception 'booking date must be within the next 7 days';
  end if;

  if p_time_block_id = 7 and v_user.role not in ('u_staff', 'gym_staff', 'admin') then
    raise exception 'time block 7 is restricted to university staff';
  end if;

  if v_user.role = 'u_staff' and v_user.allowed_time_block_id <> p_time_block_id then
    raise exception 'u_staff is restricted to its assigned block';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_booking_date::text || ':' || p_time_block_id::text, 0));

  v_start := private.block_starts_at(p_booking_date, p_time_block_id);
  if v_start is null then
    raise exception 'time block not found';
  end if;

  if now() >= v_start then
    raise exception 'past blocks cannot be reserved';
  end if;

  if exists (
    select 1
    from public.time_block_closure
    where closure_date = p_booking_date
      and time_block_id = p_time_block_id
  ) then
    raise exception 'time block is closed for this date';
  end if;

  v_auto_confirm := now() >= v_start - interval '1 hour';

  select * into v_booking
  from public.booking
  where user_id = (select auth.uid())
    and time_block_id = p_time_block_id
    and booking_date = p_booking_date
  for update;

  if found and v_booking.status = 'reserved' and v_auto_confirm then
    insert into public.user_warning (user_id, booking_id, warning_type)
    values (v_booking.user_id, null, 'missed_confirmation');

    update public.user_warning
    set booking_id = null
    where booking_id = v_booking.booking_id;

    delete from public.booking_event
    where booking_id = v_booking.booking_id;

    delete from public.booking
    where booking_id = v_booking.booking_id;
  elsif found then
    if v_booking.status <> 'cancelled' then
      raise exception 'a booking already exists for this block and date';
    end if;

    v_reactivate := true;
  end if;

  select standard_capacity, n_sessions_per_day into v_capacity, v_daily_limit
  from public.system_settings
  where singleton;

  select count(*) into v_daily_count
  from public.booking
  where user_id = (select auth.uid())
    and booking_date = p_booking_date
    and status <> 'cancelled';

  if v_daily_count >= v_daily_limit then
    raise exception 'daily booking limit reached';
  end if;

  select count(*) into v_standard_count
  from public.booking
  where booking_date = p_booking_date
    and time_block_id = p_time_block_id
    and status in ('reserved', 'confirmed', 'present')
    and is_overcapacity = false;

  if v_standard_count >= v_capacity then
    raise exception 'standard capacity reached';
  end if;

  if v_reactivate then
    update public.booking
    set
      status = case when v_auto_confirm then 'confirmed' else 'reserved' end,
      is_overcapacity = false,
      booked_at = now(),
      confirmed_at = case when v_auto_confirm then now() else null end,
      present_at = null,
      absent_at = null,
      cancelled_at = null,
      qr_scanned_at = null
    where booking_id = v_booking.booking_id
    returning * into v_booking;

    insert into public.booking_event (booking_id, event_type, actor_user_id, metadata)
    values (
      v_booking.booking_id,
      'reactivated',
      (select auth.uid()),
      case when v_auto_confirm then '{"source":"late_booking"}'::jsonb else '{}'::jsonb end
    );
  else
    insert into public.booking (
      user_id,
      time_block_id,
      booking_date,
      status,
      confirmed_at
    )
    values (
      (select auth.uid()),
      p_time_block_id,
      p_booking_date,
      case when v_auto_confirm then 'confirmed' else 'reserved' end,
      case when v_auto_confirm then now() else null end
    )
    returning * into v_booking;

    insert into public.booking_event (booking_id, event_type, actor_user_id, metadata)
    values (
      v_booking.booking_id,
      case when v_auto_confirm then 'confirmed' else 'reserved' end,
      (select auth.uid()),
      case when v_auto_confirm then '{"source":"late_booking"}'::jsonb else '{}'::jsonb end
    );
  end if;

  if v_reactivate and v_auto_confirm then
    insert into public.booking_event (booking_id, event_type, actor_user_id, metadata)
    values (
      v_booking.booking_id,
      'confirmed',
      (select auth.uid()),
      '{"source":"late_booking"}'::jsonb
    );
  end if;

  return v_booking;
end;
$$;

create or replace function public.confirm_booking(p_booking_id uuid)
returns public.booking
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.booking%rowtype;
  v_start timestamptz;
begin
  if not (select private.is_active_current_user()) then
    raise exception 'current terms acceptance required';
  end if;

  select * into v_booking
  from public.booking
  where booking_id = p_booking_id
    and user_id = (select auth.uid())
  for update;

  if not found then
    raise exception 'booking not found';
  end if;

  if v_booking.status <> 'reserved' then
    raise exception 'only reserved bookings can be confirmed';
  end if;

  v_start := private.block_starts_at(v_booking.booking_date, v_booking.time_block_id);
  if now() < v_start - interval '4 hours' or now() >= v_start - interval '1 hour' then
    raise exception 'confirmation is outside its window';
  end if;

  update public.booking
  set status = 'confirmed', confirmed_at = now()
  where booking_id = p_booking_id
  returning * into v_booking;

  insert into public.booking_event (booking_id, event_type, actor_user_id)
  values (p_booking_id, 'confirmed', (select auth.uid()));

  return v_booking;
end;
$$;

create or replace function public.expire_unconfirmed_bookings()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking_id uuid;
  v_booking_date date;
  v_time_block_id smallint;
  v_booking public.booking%rowtype;
  v_count integer := 0;
begin
  for v_booking_id, v_booking_date, v_time_block_id in
    select booking.booking_id, booking.booking_date, booking.time_block_id
    from public.booking as booking
    where booking.status = 'reserved'
      and private.block_starts_at(booking.booking_date, booking.time_block_id) - interval '1 hour' <= now()
  loop
    perform pg_advisory_xact_lock(
      hashtextextended(v_booking_date::text || ':' || v_time_block_id::text, 0)
    );

    select * into v_booking
    from public.booking as booking
    where booking.booking_id = v_booking_id
      and booking.status = 'reserved'
    for update skip locked;

    if not found then
      continue;
    end if;

    insert into public.user_warning (user_id, booking_id, warning_type)
    values (v_booking.user_id, null, 'missed_confirmation');

    update public.user_warning
    set booking_id = null
    where booking_id = v_booking.booking_id;

    delete from public.booking_event
    where booking_id = v_booking.booking_id;

    delete from public.booking
    where booking_id = v_booking.booking_id;

    v_count := v_count + 1;
  end loop;

  return v_count;
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
    if not exists (
      select 1
      from public.booking as booking
      where booking.user_id = p_user_id
        and booking.booking_date = v_window.booking_date
        and booking.time_block_id = v_window.time_block_id
        and booking.status = 'confirmed'
    ) then
      return query select 'no_current_booking'::text, null::uuid, null::date, null::smallint, null::timestamptz;
      return;
    end if;

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

revoke all on function public.confirm_booking(uuid) from public, anon;
revoke all on function public.expire_unconfirmed_bookings() from public, anon, authenticated;
revoke all on function public.create_booking(smallint, date) from public, anon;
revoke all on function public.issue_check_in_qr(uuid, bytea) from public, anon, authenticated;
revoke all on function public.get_check_in_qr_status(uuid, uuid) from public, anon, authenticated;
revoke all on function public.consume_check_in_qr(uuid, bytea) from public, anon, authenticated;
grant execute on function public.confirm_booking(uuid) to authenticated;
grant execute on function public.create_booking(smallint, date) to authenticated;
grant execute on function public.issue_check_in_qr(uuid, bytea) to service_role;
grant execute on function public.get_check_in_qr_status(uuid, uuid) to service_role;
grant execute on function public.consume_check_in_qr(uuid, bytea) to service_role;

comment on function public.create_booking(smallint, date) is
  'Creates normal reservations until block start. During the final hour, the same atomic operation creates the booking confirmed.';
comment on function public.confirm_booking(uuid) is
  'Reservation confirmation is available from four hours to one hour before the block starts.';
comment on function public.expire_unconfirmed_bookings() is
  'Deletes reserved bookings one hour before the block, preserves only a detached missed-confirmation warning, and releases capacity.';
comment on function public.issue_check_in_qr(uuid, bytea) is
  'Server-only QR issuer. Tokens are valid only during the first 15 minutes of the bound block and require a confirmed booking.';
comment on function public.consume_check_in_qr(uuid, bytea) is
  'Server-only scanner operation for gym staff. Zebra USB scanners submit an opaque QR token as HID keyboard input.';

commit;
