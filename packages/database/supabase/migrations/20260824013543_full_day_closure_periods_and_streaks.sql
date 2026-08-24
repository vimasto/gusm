begin;

create table public.full_day_closure_period (
  full_day_closure_period_id uuid primary key default gen_random_uuid(),
  closure_start_date date not null,
  closure_end_date date not null,
  reason text not null check (char_length(trim(reason)) between 3 and 240),
  created_at timestamptz not null default now(),
  created_by_user_id uuid not null references public.app_user(user_id),
  check (closure_start_date <= closure_end_date),
  exclude using gist (
    daterange(closure_start_date, closure_end_date, '[]') with &&
  )
);

create index full_day_closure_period_created_by_user_idx
  on public.full_day_closure_period(created_by_user_id);

alter table public.full_day_closure_period enable row level security;
revoke all on table public.full_day_closure_period from public, anon, authenticated;

create function private.get_time_block_closure_reason(
  p_closure_date date,
  p_time_block_id smallint
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select closure.reason
  from (
    select closure_period.reason, 1 as priority
    from public.full_day_closure_period as closure_period
    where p_closure_date between closure_period.closure_start_date and closure_period.closure_end_date

    union all

    select date_closure.reason, 2 as priority
    from public.time_block_closure as date_closure
    where date_closure.closure_date = p_closure_date
      and date_closure.time_block_id = p_time_block_id

    union all

    select weekly_closure.reason, 3 as priority
    from public.weekly_time_block_closure as weekly_closure
    where weekly_closure.iso_weekday = extract(isodow from p_closure_date)::smallint
      and weekly_closure.time_block_id = p_time_block_id
  ) as closure
  order by closure.priority
  limit 1;
$$;

create function private.is_time_block_closed(
  p_closure_date date,
  p_time_block_id smallint
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.get_time_block_closure_reason(p_closure_date, p_time_block_id) is not null;
$$;

create function private.assert_open_time_block_for_booking()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('reserved', 'confirmed', 'present')
    and private.is_time_block_closed(new.booking_date, new.time_block_id) then
    raise exception 'time block is closed for this date';
  end if;

  return new;
end;
$$;

drop trigger if exists booking_reject_closed_time_block on public.booking;
create trigger booking_reject_closed_time_block
before insert or update of booking_date, time_block_id, status on public.booking
for each row
execute function private.assert_open_time_block_for_booking();

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
      'dateClosurePeriods', coalesce((
        select jsonb_agg(jsonb_build_object(
          'closurePeriodId', closure_period.full_day_closure_period_id,
          'startDate', closure_period.closure_start_date,
          'endDate', closure_period.closure_end_date,
          'reason', closure_period.reason
        ) order by closure_period.closure_start_date, closure_period.closure_end_date)
        from public.full_day_closure_period as closure_period
        where closure_period.closure_end_date >= v_today
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

create or replace function public.upsert_admin_full_day_closure_period(
  p_actor_user_id uuid,
  p_closure_start_date date,
  p_closure_end_date date,
  p_reason text
)
returns public.full_day_closure_period
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_closure_period public.full_day_closure_period%rowtype;
  v_reason text := trim(p_reason);
  v_today date := (now() at time zone 'America/Santiago')::date;
begin
  perform private.require_current_admin(p_actor_user_id);

  if p_closure_start_date < v_today then
    raise exception 'past dates cannot be closed';
  elsif p_closure_end_date < p_closure_start_date then
    raise exception 'closure end date must be on or after the start date';
  elsif p_closure_end_date > p_closure_start_date + 365 then
    raise exception 'closure period cannot exceed three hundred sixty-six days';
  elsif char_length(v_reason) not between 3 and 240 then
    raise exception 'closure reason must contain between 3 and 240 characters';
  end if;

  if exists (
    select 1
    from public.booking as booking
    where booking.booking_date between p_closure_start_date and p_closure_end_date
      and booking.status <> 'cancelled'
  ) then
    raise exception 'active bookings must be resolved before closing a date period';
  end if;

  select * into v_closure_period
  from public.full_day_closure_period as closure_period
  where closure_period.closure_start_date = p_closure_start_date
    and closure_period.closure_end_date = p_closure_end_date
  for update;

  if found then
    update public.full_day_closure_period
    set
      reason = v_reason,
      created_by_user_id = p_actor_user_id
    where full_day_closure_period_id = v_closure_period.full_day_closure_period_id
    returning * into v_closure_period;
  else
    insert into public.full_day_closure_period (
      closure_start_date,
      closure_end_date,
      reason,
      created_by_user_id
    )
    values (
      p_closure_start_date,
      p_closure_end_date,
      v_reason,
      p_actor_user_id
    )
    returning * into v_closure_period;
  end if;

  return v_closure_period;
end;
$$;

create or replace function public.remove_admin_full_day_closure_period(
  p_actor_user_id uuid,
  p_full_day_closure_period_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_current_admin(p_actor_user_id);

  delete from public.full_day_closure_period
  where full_day_closure_period_id = p_full_day_closure_period_id;

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
    time_block.time_block_id,
    closure.reason
  from generate_series(p_start_date, p_end_date, interval '1 day') as calendar_day(closure_date)
  cross join public.time_block as time_block
  cross join lateral (
    select private.get_time_block_closure_reason(
      calendar_day.closure_date::date,
      time_block.time_block_id
    ) as reason
  ) as closure
  where closure.reason is not null
  order by calendar_day.closure_date, time_block.display_order;
end;
$$;

create or replace function public.get_profile_overview(
  p_actor_user_id uuid,
  p_target_user_id uuid
)
returns table (
  user_name text,
  role public.app_role,
  institutional_username text,
  date_of_birth date,
  reported_sex text,
  height_cm smallint,
  weight_kg numeric,
  streak_weeks integer,
  theme_preference text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.get_profile_recording_source(p_actor_user_id, p_target_user_id);

  return query
  with recursive
  attended_weeks as (
    select distinct date_trunc('week', booking.booking_date)::date as week_start
    from public.booking as booking
    where booking.user_id = p_target_user_id
      and booking.status = 'present'
  ),
  current_week as (
    select date_trunc('week', (now() at time zone 'America/Santiago')::date)::date as week_start
  ),
  closure_exempt_weeks as (
    select date_trunc('week', calendar_day.closure_date)::date as week_start
    from public.full_day_closure_period as closure_period
    cross join lateral generate_series(
      closure_period.closure_start_date,
      closure_period.closure_end_date,
      interval '1 day'
    ) as calendar_day(closure_date)
    where extract(isodow from calendar_day.closure_date) between 1 and 5
    group by date_trunc('week', calendar_day.closure_date)::date
    having count(*) = 5
  ),
  streak_bounds as (
    select
      coalesce((select min(attended_weeks.week_start) from attended_weeks), current_week.week_start) as first_week,
      current_week.week_start as last_week
    from current_week
  ),
  calendar_weeks as (
    select calendar_week.week_start::date
    from streak_bounds
    cross join lateral generate_series(
      streak_bounds.first_week,
      streak_bounds.last_week,
      interval '7 days'
    ) as calendar_week(week_start)
  ),
  eligible_weeks as (
    select calendar_weeks.week_start
    from calendar_weeks
    where not exists (
      select 1
      from closure_exempt_weeks
      where closure_exempt_weeks.week_start = calendar_weeks.week_start
    )
  ),
  recent_eligible_weeks as (
    select eligible_weeks.week_start
    from eligible_weeks
    order by eligible_weeks.week_start desc
    limit 2
  ),
  streak_anchor as (
    select max(recent_eligible_weeks.week_start) as week_start
    from recent_eligible_weeks
    join attended_weeks on attended_weeks.week_start = recent_eligible_weeks.week_start
  ),
  weekly_streak as (
    select streak_anchor.week_start, 1 as streak_weeks
    from streak_anchor
    where streak_anchor.week_start is not null

    union all

    select previous_eligible_week.week_start, weekly_streak.streak_weeks + 1
    from weekly_streak
    cross join lateral (
      select max(eligible_weeks.week_start) as week_start
      from eligible_weeks
      where eligible_weeks.week_start < weekly_streak.week_start
    ) as previous_eligible_week
    join attended_weeks on attended_weeks.week_start = previous_eligible_week.week_start
  )
  select
    app_user.user_name,
    app_user.role,
    institutional_identity.institutional_username,
    profile_revision.date_of_birth,
    profile_revision.reported_sex::text,
    body_measurement.height_cm,
    body_measurement.weight_kg,
    coalesce((select max(weekly_streak.streak_weeks) from weekly_streak), 0),
    app_user.theme_preference
  from public.app_user as app_user
  left join private.user_institutional_identity as institutional_identity
    on institutional_identity.user_id = app_user.user_id
  left join lateral (
    select revision.date_of_birth, revision.reported_sex
    from private.user_personal_profile_revision as revision
    where revision.user_id = app_user.user_id
    order by revision.recorded_at desc, revision.user_personal_profile_revision_id desc
    limit 1
  ) as profile_revision on true
  left join lateral (
    select measurement.height_cm, measurement.weight_kg
    from private.user_body_measurement as measurement
    where measurement.user_id = app_user.user_id
    order by measurement.measured_at desc, measurement.user_body_measurement_id desc
    limit 1
  ) as body_measurement on true
  where app_user.user_id = p_target_user_id;
end;
$$;

revoke all on function private.get_time_block_closure_reason(date, smallint) from public, anon, authenticated;
revoke all on function private.is_time_block_closed(date, smallint) from public, anon, authenticated;
revoke all on function private.assert_open_time_block_for_booking() from public, anon, authenticated;
revoke all on function public.upsert_admin_full_day_closure_period(uuid, date, date, text) from public, anon, authenticated;
revoke all on function public.remove_admin_full_day_closure_period(uuid, uuid) from public, anon, authenticated;
revoke all on function public.get_admin_configuration(uuid) from public, anon, authenticated;
revoke all on function public.get_booking_closure_reasons(uuid, date, date) from public, anon, authenticated;
revoke all on function public.get_profile_overview(uuid, uuid) from public, anon, authenticated;

grant execute on function public.upsert_admin_full_day_closure_period(uuid, date, date, text) to service_role;
grant execute on function public.remove_admin_full_day_closure_period(uuid, uuid) to service_role;
grant execute on function public.get_admin_configuration(uuid) to service_role;
grant execute on function public.get_booking_closure_reasons(uuid, date, date) to service_role;
grant execute on function public.get_profile_overview(uuid, uuid) to service_role;

comment on table public.full_day_closure_period is
  'An inclusive full-day closure range. It closes every time block and preserves streaks only for fully covered operating weeks.';
comment on function public.get_booking_closure_reasons(uuid, date, date) is
  'Server-only closure lookup with full-day periods taking precedence over date-specific and recurring closures.';
comment on function public.get_profile_overview(uuid, uuid) is
  'Server-only profile overview. Weekly streaks skip only weeks whose five operating weekdays are fully covered by full-day closure periods.';

commit;
