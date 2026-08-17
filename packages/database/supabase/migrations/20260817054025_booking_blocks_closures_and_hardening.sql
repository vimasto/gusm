begin;

create schema if not exists extensions;
alter extension moddatetime set schema extensions;

insert into public.time_block (time_block_id, time_block_t0, time_block_t1, display_order)
values
  (1, '08:50', '09:40', 1),
  (2, '09:40', '11:05', 2),
  (3, '11:05', '12:15', 3),
  (4, '12:15', '13:40', 4),
  (5, '14:40', '15:50', 5),
  (6, '15:50', '17:15', 6),
  (7, '17:15', '18:40', 7),
  (8, '18:40', '19:40', 8),
  (9, '19:40', '21:05', 9)
on conflict (time_block_id) do update
set
  time_block_t0 = excluded.time_block_t0,
  time_block_t1 = excluded.time_block_t1,
  display_order = excluded.display_order;

create table public.time_block_closure (
  closure_date date not null,
  time_block_id smallint not null references public.time_block(time_block_id),
  created_at timestamptz not null default now(),
  created_by_user_id uuid not null references public.app_user(user_id),
  primary key (closure_date, time_block_id)
);

create index app_user_allowed_time_block_idx on public.app_user(allowed_time_block_id);
create index booking_time_block_idx on public.booking(time_block_id);
create index booking_event_actor_user_idx on public.booking_event(actor_user_id);
create index system_settings_updated_by_user_idx on public.system_settings(updated_by_user_id);
create index user_warning_created_by_user_idx on public.user_warning(created_by_user_id);

create or replace function private.is_active_current_user()
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null
    and exists(
      select 1
      from public.app_user
      where user_id = (select auth.uid())
        and disabled_at is null
    );
$$;

create or replace function private.current_user_role()
returns public.app_role language sql stable security definer set search_path = '' as $$
  select role
  from public.app_user
  where user_id = (select auth.uid())
    and (select auth.uid()) is not null
    and disabled_at is null;
$$;

create or replace function private.is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null
    and private.current_user_role() in ('gym_staff', 'admin');
$$;

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null
    and private.current_user_role() = 'admin';
$$;

drop policy app_user_select on public.app_user;
create policy app_user_select on public.app_user for select to authenticated using (
  (user_id = (select auth.uid()) and (select private.is_active_current_user()))
  or (select private.is_staff())
);

drop policy time_block_select on public.time_block;
create policy time_block_select on public.time_block for select to authenticated using (
  (select private.is_active_current_user())
);

drop policy settings_select on public.system_settings;
create policy settings_select on public.system_settings for select to authenticated using (
  (select private.is_active_current_user())
);

drop policy booking_select on public.booking;
create policy booking_select on public.booking for select to authenticated using (
  (user_id = (select auth.uid()) and (select private.is_active_current_user()))
  or (select private.is_staff())
);

drop policy user_warning_select on public.user_warning;
create policy user_warning_select on public.user_warning for select to authenticated using (
  user_id = (select auth.uid()) or (select private.is_staff())
);

drop policy booking_event_select on public.booking_event;
create policy booking_event_select on public.booking_event for select to authenticated using (
  (select private.is_staff())
  or exists (
    select 1
    from public.booking b
    where b.booking_id = booking_event.booking_id
      and b.user_id = (select auth.uid())
  )
);

alter table public.time_block_closure enable row level security;
create policy time_block_closure_select on public.time_block_closure for select to authenticated using (
  (select private.is_active_current_user())
);
grant select on public.time_block_closure to authenticated;

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
  if (select auth.uid()) is null then
    raise exception 'authenticated user required';
  end if;

  select * into v_user
  from public.app_user
  where user_id = (select auth.uid())
    and disabled_at is null;

  if not found then
    raise exception 'active application user not found';
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

create or replace function public.create_time_block_closure(p_time_block_id smallint, p_closure_date date)
returns public.time_block_closure language plpgsql security definer set search_path = '' as $$
declare
  v_closure public.time_block_closure%rowtype;
begin
  if not (select private.is_admin()) then
    raise exception 'administrator role required';
  end if;

  if not exists (
    select 1
    from public.time_block
    where time_block_id = p_time_block_id
  ) then
    raise exception 'time block not found';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_closure_date::text || ':' || p_time_block_id::text, 0));

  if exists (
    select 1
    from public.booking
    where booking_date = p_closure_date
      and time_block_id = p_time_block_id
      and status <> 'cancelled'
  ) then
    raise exception 'active bookings must be resolved before closing a time block';
  end if;

  insert into public.time_block_closure (closure_date, time_block_id, created_by_user_id)
  values (p_closure_date, p_time_block_id, (select auth.uid()))
  on conflict (closure_date, time_block_id) do update
  set created_by_user_id = excluded.created_by_user_id
  returning * into v_closure;

  return v_closure;
end;
$$;

create or replace function public.remove_time_block_closure(p_time_block_id smallint, p_closure_date date)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not (select private.is_admin()) then
    raise exception 'administrator role required';
  end if;

  delete from public.time_block_closure
  where closure_date = p_closure_date
    and time_block_id = p_time_block_id;

  return found;
end;
$$;

revoke all on function public.create_booking(smallint, date) from public, anon;
revoke all on function public.create_time_block_closure(smallint, date) from public, anon;
revoke all on function public.remove_time_block_closure(smallint, date) from public, anon;
grant execute on function public.create_booking(smallint, date) to authenticated;
grant execute on function public.create_time_block_closure(smallint, date) to authenticated;
grant execute on function public.remove_time_block_closure(smallint, date) to authenticated;

commit;
