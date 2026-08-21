begin;

create type public.booking_admission_source as enum (
  'self_service',
  'staff_exception',
  'staff_overcapacity'
);

alter table public.booking
  add column admission_source public.booking_admission_source not null default 'self_service',
  add constraint booking_admission_source_overcapacity_check check (
    (is_overcapacity and admission_source = 'staff_overcapacity')
    or (not is_overcapacity and admission_source <> 'staff_overcapacity')
  );

create table private.staff_block_admission_request (
  staff_block_admission_request_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_user(user_id) on delete restrict,
  booking_date date not null,
  time_block_id smallint not null references public.time_block(time_block_id),
  requested_at timestamptz not null default now(),
  expires_at timestamptz not null,
  check (expires_at > requested_at),
  unique (user_id, booking_date, time_block_id)
);

create index staff_block_admission_request_window_idx
  on private.staff_block_admission_request (booking_date, time_block_id, expires_at);

create index user_institutional_identity_username_prefix_idx
  on private.user_institutional_identity (institutional_username text_pattern_ops);

alter table private.staff_block_admission_request enable row level security;

create or replace function private.require_current_staff(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.app_user as app_user
    join public.system_settings as system_settings on system_settings.singleton
    where app_user.user_id = p_user_id
      and app_user.role in ('gym_staff', 'admin')
      and app_user.disabled_at is null
      and app_user.accepted_terms_version = system_settings.current_terms_version
  ) then
    raise exception 'an active gym staff user with current terms acceptance is required';
  end if;
end;
$$;

create or replace function private.require_current_terms_user(p_user_id uuid)
returns public.app_user
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user public.app_user%rowtype;
begin
  select app_user.* into v_user
  from public.app_user as app_user
  join public.system_settings as system_settings on system_settings.singleton
  where app_user.user_id = p_user_id
    and app_user.disabled_at is null
    and app_user.accepted_terms_version = system_settings.current_terms_version;

  if not found then
    raise exception 'an active application user with current terms acceptance is required';
  end if;

  return v_user;
end;
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
  select * into v_window from private.current_check_in_qr_window();

  if not found then
    raise exception 'there is no active check-in window';
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
    private.block_starts_at(v_window.booking_date, v_window.time_block_id) + interval '15 minutes';
end;
$$;

create or replace function public.request_current_block_admission(p_user_id uuid)
returns table (
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
begin
  perform private.require_current_terms_user(p_user_id);
  select * into v_window from private.require_open_current_check_in_window();

  if exists (
    select 1
    from public.booking as booking
    where booking.user_id = p_user_id
      and booking.booking_date = v_window.booking_date
      and booking.time_block_id = v_window.time_block_id
      and booking.status in ('confirmed', 'present')
  ) then
    raise exception 'a current confirmed booking already exists';
  end if;

  insert into private.staff_block_admission_request (
    user_id,
    booking_date,
    time_block_id,
    requested_at,
    expires_at
  )
  values (
    p_user_id,
    v_window.booking_date,
    v_window.time_block_id,
    now(),
    v_window.expires_at
  )
  on conflict (user_id, booking_date, time_block_id) do update
  set
    requested_at = excluded.requested_at,
    expires_at = excluded.expires_at;

  return query select v_window.booking_date, v_window.time_block_id, v_window.expires_at;
end;
$$;

create or replace function public.get_current_staff_block_context(p_actor_user_id uuid)
returns table (
  booking_date date,
  time_block_id smallint,
  block_starts_at timestamptz,
  expires_at timestamptz,
  standard_capacity smallint,
  standard_count integer,
  overcapacity_max_above smallint,
  overcapacity_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window record;
  v_settings public.system_settings%rowtype;
  v_standard_count integer;
  v_overcapacity_count integer;
begin
  perform private.require_current_staff(p_actor_user_id);
  select * into v_window from private.require_open_current_check_in_window();

  select * into v_settings from public.system_settings where singleton;

  select
    count(*) filter (where booking.is_overcapacity = false),
    count(*) filter (where booking.is_overcapacity = true)
  into v_standard_count, v_overcapacity_count
  from public.booking as booking
  where booking.booking_date = v_window.booking_date
    and booking.time_block_id = v_window.time_block_id
    and booking.status in ('reserved', 'confirmed', 'present');

  return query
  select
    v_window.booking_date,
    v_window.time_block_id,
    v_window.block_starts_at,
    v_window.expires_at,
    v_settings.standard_capacity,
    v_standard_count,
    v_settings.overcapacity_max_above,
    v_overcapacity_count;
end;
$$;

create or replace function public.get_current_staff_block_candidates(p_actor_user_id uuid)
returns table (
  user_id uuid,
  user_name text,
  booking_status public.booking_status,
  is_overcapacity boolean,
  admission_source public.booking_admission_source,
  staff_block_admission_request_id uuid,
  requested_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window record;
begin
  perform private.require_current_staff(p_actor_user_id);
  select * into v_window from private.require_open_current_check_in_window();

  return query
  with requested_users as (
    select
      request.user_id,
      request.staff_block_admission_request_id,
      request.requested_at
    from private.staff_block_admission_request as request
    where request.booking_date = v_window.booking_date
      and request.time_block_id = v_window.time_block_id
      and request.expires_at > now()
  ), candidates as (
    select
      booking.user_id,
      booking.status as booking_status,
      booking.is_overcapacity,
      booking.admission_source,
      requested_users.staff_block_admission_request_id,
      requested_users.requested_at
    from public.booking as booking
    left join requested_users on requested_users.user_id = booking.user_id
    where booking.booking_date = v_window.booking_date
      and booking.time_block_id = v_window.time_block_id
      and booking.status in ('reserved', 'confirmed', 'present', 'absent', 'cancelled')

    union all

    select
      requested_users.user_id,
      null::public.booking_status,
      null::boolean,
      null::public.booking_admission_source,
      requested_users.staff_block_admission_request_id,
      requested_users.requested_at
    from requested_users
    where not exists (
      select 1
      from public.booking as booking
      where booking.user_id = requested_users.user_id
        and booking.booking_date = v_window.booking_date
        and booking.time_block_id = v_window.time_block_id
    )
  )
  select
    candidates.user_id,
    app_user.user_name,
    candidates.booking_status,
    candidates.is_overcapacity,
    candidates.admission_source,
    candidates.staff_block_admission_request_id,
    candidates.requested_at
  from candidates
  join public.app_user as app_user on app_user.user_id = candidates.user_id
  order by
    case candidates.booking_status
      when 'confirmed' then 1
      when 'present' then 2
      when 'reserved' then 3
      when 'absent' then 4
      when 'cancelled' then 5
      else 6
    end,
    candidates.requested_at nulls last,
    app_user.user_name;
end;
$$;

create or replace function public.search_current_staff_block_users(
  p_actor_user_id uuid,
  p_institutional_username_prefix text
)
returns table (
  user_id uuid,
  user_name text,
  institutional_username text,
  booking_status public.booking_status
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window record;
  v_prefix text := lower(trim(p_institutional_username_prefix));
begin
  perform private.require_current_staff(p_actor_user_id);
  select * into v_window from private.require_open_current_check_in_window();

  if char_length(v_prefix) < 2 or v_prefix like '%@%' or v_prefix like '% %' then
    raise exception 'institutional username prefix must contain at least two characters without domain or spaces';
  end if;

  return query
  select
    app_user.user_id,
    app_user.user_name,
    identity.institutional_username,
    booking.status
  from private.user_institutional_identity as identity
  join public.app_user as app_user on app_user.user_id = identity.user_id
  left join public.booking as booking
    on booking.user_id = app_user.user_id
    and booking.booking_date = v_window.booking_date
    and booking.time_block_id = v_window.time_block_id
  join public.system_settings as system_settings on system_settings.singleton
  where identity.institutional_username like v_prefix || '%'
    and app_user.disabled_at is null
    and app_user.accepted_terms_version = system_settings.current_terms_version
  order by identity.institutional_username
  limit 10;
end;
$$;

create or replace function public.admit_current_staff_block_user(
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_admission_source public.booking_admission_source
)
returns public.booking
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window record;
  v_target public.app_user%rowtype;
  v_booking public.booking%rowtype;
  v_settings public.system_settings%rowtype;
  v_standard_count integer;
  v_overcapacity_count integer;
  v_other_daily_count integer;
  v_is_overcapacity boolean := p_admission_source = 'staff_overcapacity';
begin
  perform private.require_current_staff(p_actor_user_id);

  if p_admission_source not in ('staff_exception', 'staff_overcapacity') then
    raise exception 'staff admission source is required';
  end if;

  v_target := private.require_current_terms_user(p_target_user_id);
  select * into v_window from private.require_open_current_check_in_window();

  if v_window.time_block_id = 7 and v_target.role not in ('u_staff', 'gym_staff', 'admin') then
    raise exception 'time block 7 is restricted to university staff';
  elsif v_target.role = 'u_staff' and v_target.allowed_time_block_id <> v_window.time_block_id then
    raise exception 'u_staff is restricted to its assigned block';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_window.booking_date::text || ':' || v_window.time_block_id::text, 0)
  );

  select * into v_booking
  from public.booking as booking
  where booking.user_id = p_target_user_id
    and booking.booking_date = v_window.booking_date
    and booking.time_block_id = v_window.time_block_id
  for update;

  if found and v_booking.status = 'present' then
    raise exception 'user attendance is already registered';
  elsif found and v_booking.status = 'confirmed' then
    raise exception 'user already has a confirmed booking';
  end if;

  select * into v_settings from public.system_settings where singleton;

  select
    count(*) filter (where booking.is_overcapacity = false),
    count(*) filter (where booking.is_overcapacity = true)
  into v_standard_count, v_overcapacity_count
  from public.booking as booking
  where booking.booking_date = v_window.booking_date
    and booking.time_block_id = v_window.time_block_id
    and booking.status in ('reserved', 'confirmed', 'present')
    and booking.booking_id is distinct from v_booking.booking_id;

  if p_admission_source = 'staff_exception' and v_standard_count >= v_settings.standard_capacity then
    raise exception 'standard capacity is exhausted; use staff_overcapacity';
  elsif p_admission_source = 'staff_overcapacity' and v_standard_count < v_settings.standard_capacity then
    raise exception 'standard capacity remains; use staff_exception';
  elsif p_admission_source = 'staff_overcapacity' and v_overcapacity_count >= v_settings.overcapacity_max_above then
    raise exception 'overcapacity limit reached';
  end if;

  select count(*) into v_other_daily_count
  from public.booking as booking
  where booking.user_id = p_target_user_id
    and booking.booking_date = v_window.booking_date
    and booking.status <> 'cancelled'
    and booking.booking_id is distinct from v_booking.booking_id;

  if v_other_daily_count >= v_settings.n_sessions_per_day then
    raise exception 'daily booking limit reached';
  end if;

  if found then
    update public.booking
    set
      status = 'confirmed',
      is_overcapacity = v_is_overcapacity,
      admission_source = p_admission_source,
      booked_at = now(),
      confirmed_at = now(),
      present_at = null,
      absent_at = null,
      cancelled_at = null,
      qr_scanned_at = null
    where booking_id = v_booking.booking_id
    returning * into v_booking;
  else
    insert into public.booking (
      user_id,
      time_block_id,
      booking_date,
      status,
      is_overcapacity,
      admission_source,
      confirmed_at
    )
    values (
      p_target_user_id,
      v_window.time_block_id,
      v_window.booking_date,
      'confirmed',
      v_is_overcapacity,
      p_admission_source,
      now()
    )
    returning * into v_booking;
  end if;

  insert into public.booking_event (booking_id, event_type, actor_user_id, metadata)
  values (
    v_booking.booking_id,
    'confirmed',
    p_actor_user_id,
    jsonb_build_object('admission_source', p_admission_source, 'staff_admitted', true)
  );

  if p_admission_source = 'staff_exception' then
    insert into public.user_warning (user_id, booking_id, warning_type, created_by_user_id)
    values (p_target_user_id, v_booking.booking_id, 'unbooked_attendance', p_actor_user_id)
    on conflict (booking_id, warning_type) where booking_id is not null do nothing;
  end if;

  delete from private.staff_block_admission_request
  where user_id = p_target_user_id
    and booking_date = v_window.booking_date
    and time_block_id = v_window.time_block_id;

  return v_booking;
end;
$$;

revoke all on table private.staff_block_admission_request from public, anon, authenticated;
revoke all on function private.require_current_staff(uuid) from public, anon, authenticated;
revoke all on function private.require_current_terms_user(uuid) from public, anon, authenticated;
revoke all on function private.require_open_current_check_in_window() from public, anon, authenticated;
revoke all on function public.request_current_block_admission(uuid) from public, anon, authenticated;
revoke all on function public.get_current_staff_block_context(uuid) from public, anon, authenticated;
revoke all on function public.get_current_staff_block_candidates(uuid) from public, anon, authenticated;
revoke all on function public.search_current_staff_block_users(uuid, text) from public, anon, authenticated;
revoke all on function public.admit_current_staff_block_user(uuid, uuid, public.booking_admission_source) from public, anon, authenticated;
grant execute on function public.request_current_block_admission(uuid) to service_role;
grant execute on function public.get_current_staff_block_context(uuid) to service_role;
grant execute on function public.get_current_staff_block_candidates(uuid) to service_role;
grant execute on function public.search_current_staff_block_users(uuid, text) to service_role;
grant execute on function public.admit_current_staff_block_user(uuid, uuid, public.booking_admission_source) to service_role;

comment on column public.booking.admission_source is
  'Auditable origin of a booking. is_overcapacity remains reserved exclusively for physical excess over standard capacity.';
comment on table private.staff_block_admission_request is
  'Ephemeral signal for a physically present user to request staff admission during the active QR window. It is not a booking and never consumes capacity.';
comment on function public.admit_current_staff_block_user(uuid, uuid, public.booking_admission_source) is
  'Server-only current-block staff action. Creates or reactivates a confirmed booking, records its audited admission source, and releases a QR-eligible attendee.';

commit;
