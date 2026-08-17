begin;

create or replace function private.block_starts_at(p_date date, p_block smallint)
returns timestamptz language sql stable security definer set search_path = '' as $$
  select ((p_date + time_block_t0) at time zone 'America/Santiago') from public.time_block where time_block_id = p_block;
$$;
create or replace function private.block_ends_at(p_date date, p_block smallint)
returns timestamptz language sql stable security definer set search_path = '' as $$
  select ((p_date + time_block_t1) at time zone 'America/Santiago') from public.time_block where time_block_id = p_block;
$$;
revoke all on function private.block_starts_at(date, smallint), private.block_ends_at(date, smallint) from public, anon, authenticated;

create or replace function public.create_booking(p_time_block_id smallint, p_booking_date date)
returns public.booking language plpgsql security definer set search_path = '' as $$
declare
  v_user public.app_user%rowtype;
  v_booking public.booking%rowtype;
  v_start timestamptz;
  v_capacity smallint;
  v_daily_limit smallint;
  v_standard_count integer;
  v_daily_count integer;
  v_reactivate boolean := false;
begin
  select * into v_user from public.app_user where user_id = auth.uid() and disabled_at is null;
  if not found then raise exception 'active application user not found'; end if;
  if v_user.role = 'u_staff' and v_user.allowed_time_block_id <> p_time_block_id then raise exception 'u_staff is restricted to its assigned block'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_booking_date::text || ':' || p_time_block_id::text, 0));
  v_start := private.block_starts_at(p_booking_date, p_time_block_id);
  if v_start is null then raise exception 'time block not found'; end if;
  if now() >= v_start then raise exception 'past blocks cannot be reserved'; end if;
  select * into v_booking from public.booking where user_id = auth.uid() and time_block_id = p_time_block_id and booking_date = p_booking_date for update;
  if found then
    if v_booking.status <> 'cancelled' then raise exception 'a booking already exists for this block and date'; end if;
    v_reactivate := true;
  end if;
  select standard_capacity, n_sessions_per_day into v_capacity, v_daily_limit from public.system_settings where singleton;
  select count(*) into v_daily_count from public.booking where user_id = auth.uid() and booking_date = p_booking_date and status <> 'cancelled';
  if v_daily_count >= v_daily_limit then raise exception 'daily booking limit reached'; end if;
  select count(*) into v_standard_count from public.booking where booking_date = p_booking_date and time_block_id = p_time_block_id and status in ('reserved', 'confirmed', 'present') and is_overcapacity = false;
  if v_standard_count >= v_capacity then raise exception 'standard capacity reached'; end if;
  if v_reactivate then
    update public.booking set status = 'reserved', is_overcapacity = false, booked_at = now(), confirmed_at = null, present_at = null, absent_at = null, cancelled_at = null, qr_scanned_at = null where booking_id = v_booking.booking_id returning * into v_booking;
  else
    insert into public.booking(user_id, time_block_id, booking_date) values (auth.uid(), p_time_block_id, p_booking_date) returning * into v_booking;
  end if;
  return v_booking;
end;
$$;

create or replace function public.cancel_booking(p_booking_id uuid)
returns public.booking language plpgsql security definer set search_path = '' as $$
declare v_booking public.booking%rowtype;
begin
  select * into v_booking from public.booking where booking_id = p_booking_id and user_id = auth.uid() for update;
  if not found then raise exception 'booking not found'; end if;
  if v_booking.status not in ('reserved', 'confirmed') then raise exception 'booking cannot be cancelled from its current status'; end if;
  if now() >= private.block_starts_at(v_booking.booking_date, v_booking.time_block_id) then raise exception 'past blocks cannot be cancelled'; end if;
  update public.booking set status = 'cancelled', cancelled_at = now() where booking_id = p_booking_id returning * into v_booking;
  return v_booking;
end;
$$;

revoke all on function public.create_booking(smallint, date), public.cancel_booking(uuid) from public, anon;
grant execute on function public.create_booking(smallint, date), public.cancel_booking(uuid) to authenticated;
commit;
