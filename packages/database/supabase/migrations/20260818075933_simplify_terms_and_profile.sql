begin;

alter table public.system_settings
add column current_terms_version integer not null default 1
check (current_terms_version > 0);

alter table public.app_user
add column accepted_terms_version integer,
add column terms_accepted_at timestamptz,
add constraint app_user_terms_acceptance_check check (
  (
    accepted_terms_version is null
    and terms_accepted_at is null
  )
  or (
    accepted_terms_version is not null
    and accepted_terms_version > 0
    and terms_accepted_at is not null
  )
);

alter table private.user_personal_profile_revision
drop column user_profile_consent_id;

alter table private.user_body_measurement
drop column user_profile_consent_id;

drop table private.user_profile_consent;

create or replace function private.is_active_current_user()
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.app_user as app_user
      join public.system_settings as system_settings on system_settings.singleton
      where app_user.user_id = (select auth.uid())
        and app_user.disabled_at is null
        and app_user.accepted_terms_version = system_settings.current_terms_version
    );
$$;

create or replace function private.current_user_role()
returns public.app_role language sql stable security definer set search_path = '' as $$
  select app_user.role
  from public.app_user as app_user
  join public.system_settings as system_settings on system_settings.singleton
  where app_user.user_id = (select auth.uid())
    and (select auth.uid()) is not null
    and app_user.disabled_at is null
    and app_user.accepted_terms_version = system_settings.current_terms_version;
$$;

create or replace function public.has_accepted_current_terms()
returns boolean language sql stable security invoker set search_path = '' as $$
  select private.is_active_current_user();
$$;

revoke all on function public.has_accepted_current_terms() from public, anon;
grant execute on function public.has_accepted_current_terms() to authenticated;

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
returns public.booking language plpgsql security definer set search_path = '' as $$
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
  if now() < v_start - interval '4 hours' or now() >= v_start then
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

create or replace function public.cancel_booking(p_booking_id uuid)
returns public.booking language plpgsql security definer set search_path = '' as $$
declare
  v_booking public.booking%rowtype;
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

  if v_booking.status not in ('reserved', 'confirmed') then
    raise exception 'booking cannot be cancelled from its current status';
  end if;

  if now() >= private.block_starts_at(v_booking.booking_date, v_booking.time_block_id) then
    raise exception 'past blocks cannot be cancelled';
  end if;

  update public.booking
  set status = 'cancelled', cancelled_at = now()
  where booking_id = p_booking_id
  returning * into v_booking;

  insert into public.booking_event (booking_id, event_type, actor_user_id)
  values (p_booking_id, 'cancelled', (select auth.uid()));

  return v_booking;
end;
$$;

comment on column public.system_settings.current_terms_version is
  'Current global terms version. Incrementing it requires every user to accept again.';
comment on column public.app_user.accepted_terms_version is
  'Most recent terms version accepted by this user. Validity requires equality with system_settings.current_terms_version.';
comment on column public.app_user.terms_accepted_at is
  'Timestamp at which the user accepted accepted_terms_version.';
comment on table private.user_personal_profile_revision is
  'Immutable demographic revisions. User and admin writes require acceptance of the current terms in the application layer. Age is derived from date_of_birth at query time.';
comment on table private.user_body_measurement is
  'Immutable voluntary body measurements. User and admin writes require acceptance of the current terms in the application layer.';

commit;
