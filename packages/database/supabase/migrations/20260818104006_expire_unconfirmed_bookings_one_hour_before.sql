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

  if now() >= v_start - interval '1 hour' then
    raise exception 'booking is closed during the last hour before the block';
  end if;

  if exists (
    select 1
    from public.time_block_closure
    where closure_date = p_booking_date
      and time_block_id = p_time_block_id
  ) then
    raise exception 'time block is closed for this date';
  end if;

  select * into v_booking
  from public.booking
  where user_id = (select auth.uid())
    and time_block_id = p_time_block_id
    and booking_date = p_booking_date
  for update;

  if found then
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
      status = 'reserved',
      is_overcapacity = false,
      booked_at = now(),
      confirmed_at = null,
      present_at = null,
      absent_at = null,
      cancelled_at = null,
      qr_scanned_at = null
    where booking_id = v_booking.booking_id
    returning * into v_booking;

    insert into public.booking_event (booking_id, event_type, actor_user_id)
    values (v_booking.booking_id, 'reactivated', (select auth.uid()));
  else
    insert into public.booking (user_id, time_block_id, booking_date)
    values ((select auth.uid()), p_time_block_id, p_booking_date)
    returning * into v_booking;

    insert into public.booking_event (booking_id, event_type, actor_user_id)
    values (v_booking.booking_id, 'reserved', (select auth.uid()));
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
  v_booking public.booking%rowtype;
  v_count integer := 0;
begin
  for v_booking in
    select booking.*
    from public.booking as booking
    where booking.status = 'reserved'
      and private.block_starts_at(booking.booking_date, booking.time_block_id) - interval '1 hour' <= now()
    for update skip locked
  loop
    update public.booking
    set status = 'absent', absent_at = now()
    where booking_id = v_booking.booking_id;

    insert into public.user_warning (user_id, booking_id, warning_type)
    values (v_booking.user_id, v_booking.booking_id, 'missed_confirmation')
    on conflict (booking_id, warning_type) where booking_id is not null do nothing;

    insert into public.booking_event (booking_id, event_type)
    values (v_booking.booking_id, 'expired_to_absent');

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.confirm_booking(uuid) from public, anon;
revoke all on function public.expire_unconfirmed_bookings() from public, anon, authenticated;
revoke all on function public.create_booking(smallint, date) from public, anon;
grant execute on function public.confirm_booking(uuid) to authenticated;
grant execute on function public.create_booking(smallint, date) to authenticated;

comment on function public.create_booking(smallint, date) is
  'Standard booking closes one hour before the block. Expired unconfirmed capacity is operationally free, not eligible for new regular reservations.';
comment on function public.confirm_booking(uuid) is
  'Reservation confirmation is available from four hours to one hour before the block starts.';
comment on function public.expire_unconfirmed_bookings() is
  'Marks reserved bookings absent one hour before the block, releasing their capacity for confirmed demand.';

commit;
