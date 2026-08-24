begin;

alter table public.time_block_closure
  add column reason text not null default 'No informado',
  add constraint time_block_closure_reason_check check (char_length(trim(reason)) between 3 and 240);

alter table public.weekly_time_block_closure
  add column reason text not null default 'No informado',
  add constraint weekly_time_block_closure_reason_check check (char_length(trim(reason)) between 3 and 240);

create or replace function private.require_current_admin(p_user_id uuid)
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
      and app_user.role = 'admin'
      and app_user.disabled_at is null
      and app_user.accepted_terms_version = system_settings.current_terms_version
  ) then
    raise exception 'an active administrator with current terms acceptance is required';
  end if;
end;
$$;

create or replace function public.get_admin_configuration(p_actor_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'America/Santiago')::date;
begin
  perform private.require_current_admin(p_actor_user_id);

  return (
    select jsonb_build_object(
      'settings', jsonb_build_object(
        'nSessionsPerDay', system_settings.n_sessions_per_day,
        'overcapacityMaxAbove', system_settings.overcapacity_max_above,
        'standardCapacity', system_settings.standard_capacity
      ),
      'timeBlocks', coalesce((
        select jsonb_agg(jsonb_build_object(
          'timeBlockId', time_block.time_block_id,
          'startTime', time_block.time_block_t0::text,
          'endTime', time_block.time_block_t1::text
        ) order by time_block.display_order)
        from public.time_block as time_block
      ), '[]'::jsonb),
      'dateClosures', coalesce((
        select jsonb_agg(jsonb_build_object(
          'date', closure.closure_date,
          'timeBlockId', closure.time_block_id,
          'reason', closure.reason
        ) order by closure.closure_date, closure.time_block_id)
        from public.time_block_closure as closure
        where closure.closure_date >= v_today
      ), '[]'::jsonb),
      'weeklyClosures', coalesce((
        select jsonb_agg(jsonb_build_object(
          'isoWeekday', closure.iso_weekday,
          'timeBlockId', closure.time_block_id,
          'reason', closure.reason
        ) order by closure.iso_weekday, closure.time_block_id)
        from public.weekly_time_block_closure as closure
      ), '[]'::jsonb)
    )
    from public.system_settings as system_settings
    where system_settings.singleton
  );
end;
$$;

create or replace function public.update_admin_operational_settings(
  p_actor_user_id uuid,
  p_n_sessions_per_day smallint,
  p_overcapacity_max_above smallint
)
returns public.system_settings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings public.system_settings%rowtype;
begin
  perform private.require_current_admin(p_actor_user_id);

  if p_n_sessions_per_day <= 0 then
    raise exception 'daily session limit must be positive';
  elsif p_overcapacity_max_above < 0 then
    raise exception 'overcapacity maximum cannot be negative';
  end if;

  update public.system_settings
  set
    n_sessions_per_day = p_n_sessions_per_day,
    overcapacity_max_above = p_overcapacity_max_above,
    updated_by_user_id = p_actor_user_id
  where singleton
  returning * into v_settings;

  return v_settings;
end;
$$;

create or replace function public.upsert_admin_date_time_block_closure(
  p_actor_user_id uuid,
  p_time_block_id smallint,
  p_closure_date date,
  p_reason text
)
returns public.time_block_closure
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_closure public.time_block_closure%rowtype;
  v_reason text := trim(p_reason);
  v_today date := (now() at time zone 'America/Santiago')::date;
begin
  perform private.require_current_admin(p_actor_user_id);

  if p_closure_date < v_today then
    raise exception 'past dates cannot be closed';
  elsif char_length(v_reason) not between 3 and 240 then
    raise exception 'closure reason must contain between 3 and 240 characters';
  elsif not exists (
    select 1 from public.time_block where time_block_id = p_time_block_id
  ) then
    raise exception 'time block not found';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_closure_date::text || ':' || p_time_block_id::text, 0)
  );

  if exists (
    select 1
    from public.booking as booking
    where booking.booking_date = p_closure_date
      and booking.time_block_id = p_time_block_id
      and booking.status <> 'cancelled'
  ) then
    raise exception 'active bookings must be resolved before closing a time block';
  end if;

  insert into public.time_block_closure (
    closure_date,
    time_block_id,
    reason,
    created_by_user_id
  )
  values (p_closure_date, p_time_block_id, v_reason, p_actor_user_id)
  on conflict (closure_date, time_block_id) do update
  set
    reason = excluded.reason,
    created_by_user_id = excluded.created_by_user_id
  returning * into v_closure;

  return v_closure;
end;
$$;

create or replace function public.upsert_admin_weekly_time_block_closure(
  p_actor_user_id uuid,
  p_time_block_id smallint,
  p_iso_weekday smallint,
  p_reason text
)
returns public.weekly_time_block_closure
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_closure public.weekly_time_block_closure%rowtype;
  v_reason text := trim(p_reason);
begin
  perform private.require_current_admin(p_actor_user_id);

  if p_iso_weekday not between 1 and 7 then
    raise exception 'weekday must use ISO numbering from 1 through 7';
  elsif char_length(v_reason) not between 3 and 240 then
    raise exception 'closure reason must contain between 3 and 240 characters';
  elsif not exists (
    select 1 from public.time_block where time_block_id = p_time_block_id
  ) then
    raise exception 'time block not found';
  end if;

  if exists (
    select 1
    from public.booking as booking
    where booking.time_block_id = p_time_block_id
      and extract(isodow from booking.booking_date)::smallint = p_iso_weekday
      and booking.status in ('reserved', 'confirmed')
  ) then
    raise exception 'active bookings must be resolved before closing a weekly time block';
  end if;

  insert into public.weekly_time_block_closure (
    iso_weekday,
    time_block_id,
    reason,
    created_by_user_id
  )
  values (p_iso_weekday, p_time_block_id, v_reason, p_actor_user_id)
  on conflict (iso_weekday, time_block_id) do update
  set
    reason = excluded.reason,
    created_by_user_id = excluded.created_by_user_id
  returning * into v_closure;

  return v_closure;
end;
$$;

create or replace function public.remove_admin_date_time_block_closure(
  p_actor_user_id uuid,
  p_time_block_id smallint,
  p_closure_date date
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_current_admin(p_actor_user_id);

  delete from public.time_block_closure
  where closure_date = p_closure_date
    and time_block_id = p_time_block_id;

  return found;
end;
$$;

create or replace function public.remove_admin_weekly_time_block_closure(
  p_actor_user_id uuid,
  p_time_block_id smallint,
  p_iso_weekday smallint
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_current_admin(p_actor_user_id);

  delete from public.weekly_time_block_closure
  where iso_weekday = p_iso_weekday
    and time_block_id = p_time_block_id;

  return found;
end;
$$;

create or replace function public.get_booking_closure_reasons(
  p_actor_user_id uuid,
  p_start_date date,
  p_end_date date
)
returns table (
  closure_date date,
  time_block_id smallint,
  reason text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_current_terms_user(p_actor_user_id);

  if p_end_date < p_start_date or p_end_date > p_start_date + 31 then
    raise exception 'closure range must be between one and thirty-two days';
  end if;

  return query
  select
    calendar_day.closure_date::date,
    weekly_closure.time_block_id,
    weekly_closure.reason
  from generate_series(p_start_date, p_end_date, interval '1 day') as calendar_day(closure_date)
  join public.weekly_time_block_closure as weekly_closure
    on weekly_closure.iso_weekday = extract(isodow from calendar_day.closure_date)::smallint
  where not exists (
    select 1
    from public.time_block_closure as date_closure
    where date_closure.closure_date = calendar_day.closure_date::date
      and date_closure.time_block_id = weekly_closure.time_block_id
  )

  union all

  select
    date_closure.closure_date,
    date_closure.time_block_id,
    date_closure.reason
  from public.time_block_closure as date_closure
  where date_closure.closure_date between p_start_date and p_end_date
  order by closure_date, time_block_id;
end;
$$;

create or replace function public.get_admin_booking_export(
  p_actor_user_id uuid,
  p_start_date date,
  p_end_date date
)
returns table (
  booking_date date,
  time_block_id smallint,
  block_starts_at timestamptz,
  block_ends_at timestamptz,
  institutional_username text,
  user_name text,
  user_role public.app_role,
  booking_status public.booking_status,
  admission_source public.booking_admission_source,
  is_overcapacity boolean,
  booked_at timestamptz,
  confirmed_at timestamptz,
  late_qr_authorized_at timestamptz,
  present_at timestamptz,
  absent_at timestamptz,
  cancelled_at timestamptz,
  qr_scanned_at timestamptz,
  warning_types text,
  date_of_birth date,
  reported_sex text,
  height_cm smallint,
  weight_kg numeric
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_current_admin(p_actor_user_id);

  if p_end_date < p_start_date or p_end_date > p_start_date + 31 then
    raise exception 'export range must be between one and thirty-two days';
  end if;

  return query
  select
    booking.booking_date,
    booking.time_block_id,
    private.block_starts_at(booking.booking_date, booking.time_block_id),
    private.block_ends_at(booking.booking_date, booking.time_block_id),
    identity.institutional_username,
    app_user.user_name,
    app_user.role,
    booking.status,
    booking.admission_source,
    booking.is_overcapacity,
    booking.booked_at,
    booking.confirmed_at,
    booking.late_qr_authorized_at,
    booking.present_at,
    booking.absent_at,
    booking.cancelled_at,
    booking.qr_scanned_at,
    warnings.warning_types,
    profile_revision.date_of_birth,
    profile_revision.reported_sex::text,
    measurement.height_cm,
    measurement.weight_kg
  from public.booking as booking
  join public.app_user as app_user on app_user.user_id = booking.user_id
  left join private.user_institutional_identity as identity on identity.user_id = booking.user_id
  left join lateral (
    select string_agg(warning.warning_type::text, '| ' order by warning.created_at) as warning_types
    from public.user_warning as warning
    where warning.booking_id = booking.booking_id
  ) as warnings on true
  left join lateral (
    select revision.date_of_birth, revision.reported_sex
    from private.user_personal_profile_revision as revision
    where revision.user_id = booking.user_id
      and revision.recorded_at <= private.block_starts_at(booking.booking_date, booking.time_block_id)
    order by revision.recorded_at desc, revision.user_personal_profile_revision_id desc
    limit 1
  ) as profile_revision on true
  left join lateral (
    select body_measurement.height_cm, body_measurement.weight_kg
    from private.user_body_measurement as body_measurement
    where body_measurement.user_id = booking.user_id
      and body_measurement.measured_at <= private.block_starts_at(booking.booking_date, booking.time_block_id)
    order by body_measurement.measured_at desc, body_measurement.user_body_measurement_id desc
    limit 1
  ) as measurement on true
  where booking.booking_date between p_start_date and p_end_date
  order by booking.booking_date, booking.time_block_id, app_user.user_name;
end;
$$;

revoke all on function private.require_current_admin(uuid) from public, anon, authenticated;
revoke all on function public.get_admin_configuration(uuid) from public, anon, authenticated;
revoke all on function public.update_admin_operational_settings(uuid, smallint, smallint) from public, anon, authenticated;
revoke all on function public.upsert_admin_date_time_block_closure(uuid, smallint, date, text) from public, anon, authenticated;
revoke all on function public.upsert_admin_weekly_time_block_closure(uuid, smallint, smallint, text) from public, anon, authenticated;
revoke all on function public.remove_admin_date_time_block_closure(uuid, smallint, date) from public, anon, authenticated;
revoke all on function public.remove_admin_weekly_time_block_closure(uuid, smallint, smallint) from public, anon, authenticated;
revoke all on function public.get_booking_closure_reasons(uuid, date, date) from public, anon, authenticated;
revoke all on function public.get_admin_booking_export(uuid, date, date) from public, anon, authenticated;
revoke all on function public.create_time_block_closure(smallint, date) from authenticated;
revoke all on function public.remove_time_block_closure(smallint, date) from authenticated;
revoke all on function public.create_weekly_time_block_closure(smallint, smallint) from authenticated;
revoke all on function public.remove_weekly_time_block_closure(smallint, smallint) from authenticated;
grant execute on function public.get_admin_configuration(uuid) to service_role;
grant execute on function public.update_admin_operational_settings(uuid, smallint, smallint) to service_role;
grant execute on function public.upsert_admin_date_time_block_closure(uuid, smallint, date, text) to service_role;
grant execute on function public.upsert_admin_weekly_time_block_closure(uuid, smallint, smallint, text) to service_role;
grant execute on function public.remove_admin_date_time_block_closure(uuid, smallint, date) to service_role;
grant execute on function public.remove_admin_weekly_time_block_closure(uuid, smallint, smallint) to service_role;
grant execute on function public.get_booking_closure_reasons(uuid, date, date) to service_role;
grant execute on function public.get_admin_booking_export(uuid, date, date) to service_role;

comment on column public.time_block_closure.reason is
  'Reason shown to users when the date-specific block is unavailable.';
comment on column public.weekly_time_block_closure.reason is
  'Reason shown to users when the recurring weekday block is unavailable.';
comment on function public.get_admin_booking_export(uuid, date, date) is
  'Server-only flat operational export. It excludes identity HMAC, RUT and institutional email domains.';

commit;
