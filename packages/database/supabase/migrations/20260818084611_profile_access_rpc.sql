begin;

create or replace function private.get_profile_recording_source(
  p_actor_user_id uuid,
  p_target_user_id uuid
)
returns private.profile_data_source language plpgsql security definer set search_path = '' as $$
declare
  v_actor_role public.app_role;
begin
  select app_user.role into v_actor_role
  from public.app_user as app_user
  join public.system_settings as system_settings on system_settings.singleton
  where app_user.user_id = p_actor_user_id
    and app_user.disabled_at is null
    and app_user.accepted_terms_version = system_settings.current_terms_version;

  if not found then
    raise exception 'active actor with current terms acceptance is required';
  end if;

  if not exists (
    select 1
    from public.app_user as app_user
    join public.system_settings as system_settings on system_settings.singleton
    where app_user.user_id = p_target_user_id
      and app_user.disabled_at is null
      and app_user.accepted_terms_version = system_settings.current_terms_version
  ) then
    raise exception 'active target with current terms acceptance is required';
  end if;

  if p_actor_user_id = p_target_user_id then
    return 'self_reported'::private.profile_data_source;
  elsif v_actor_role = 'admin' then
    return 'admin_recorded'::private.profile_data_source;
  end if;

  raise exception 'actor cannot access this profile';
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
  streak_weeks integer
) language plpgsql security definer set search_path = '' as $$
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
  streak_anchor as (
    select max(attended_weeks.week_start) as week_start
    from attended_weeks
    cross join current_week
    where attended_weeks.week_start in (
      current_week.week_start,
      current_week.week_start - 7
    )
  ),
  weekly_streak as (
    select streak_anchor.week_start, 1 as streak_weeks
    from streak_anchor
    where streak_anchor.week_start is not null

    union all

    select attended_weeks.week_start, weekly_streak.streak_weeks + 1
    from weekly_streak
    join attended_weeks on attended_weeks.week_start = weekly_streak.week_start - 7
  )
  select
    app_user.user_name,
    app_user.role,
    institutional_identity.institutional_username,
    profile_revision.date_of_birth,
    profile_revision.reported_sex::text,
    body_measurement.height_cm,
    body_measurement.weight_kg,
    coalesce((select max(weekly_streak.streak_weeks) from weekly_streak), 0)
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

create or replace function public.get_profile_monthly_attendance(
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_month_start date
)
returns table (
  booking_date date,
  attendance_status public.booking_status
) language plpgsql security definer set search_path = '' as $$
begin
  perform private.get_profile_recording_source(p_actor_user_id, p_target_user_id);

  if p_month_start <> date_trunc('month', p_month_start)::date then
    raise exception 'month start must be the first calendar day of a month';
  end if;

  if p_month_start > date_trunc('month', (now() at time zone 'America/Santiago')::date)::date then
    raise exception 'future months have no attendance history';
  end if;

  return query
  select
    booking.booking_date,
    case
      when bool_or(booking.status = 'present') then 'present'::public.booking_status
      else 'absent'::public.booking_status
    end as attendance_status
  from public.booking as booking
  where booking.user_id = p_target_user_id
    and booking.booking_date >= p_month_start
    and booking.booking_date < (p_month_start + interval '1 month')::date
    and booking.status in ('present', 'absent')
  group by booking.booking_date
  order by booking.booking_date;
end;
$$;

create or replace function public.record_profile_data(
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_date_of_birth date,
  p_reported_sex text,
  p_height_cm smallint,
  p_weight_kg numeric
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_source private.profile_data_source;
  v_current_date date := (now() at time zone 'America/Santiago')::date;
  v_latest_profile private.user_personal_profile_revision%rowtype;
  v_latest_measurement private.user_body_measurement%rowtype;
begin
  v_source := private.get_profile_recording_source(p_actor_user_id, p_target_user_id);

  if (p_date_of_birth is null) <> (p_reported_sex is null) then
    raise exception 'date of birth and reported sex must be recorded together';
  end if;

  if p_date_of_birth is null and p_height_cm is null and p_weight_kg is null then
    raise exception 'at least one voluntary profile value is required';
  end if;

  if p_date_of_birth is not null and p_date_of_birth >= v_current_date then
    raise exception 'date of birth must be before the current date';
  end if;

  if p_reported_sex is not null
    and p_reported_sex not in ('masculino', 'femenino', 'otro', 'prefiero_no_decir') then
    raise exception 'reported sex is invalid';
  end if;

  if p_height_cm is not null and p_height_cm not between 50 and 260 then
    raise exception 'height is outside the supported range';
  end if;

  if p_weight_kg is not null and p_weight_kg not between 20 and 350 then
    raise exception 'weight is outside the supported range';
  end if;

  if p_date_of_birth is not null then
    select * into v_latest_profile
    from private.user_personal_profile_revision as revision
    where revision.user_id = p_target_user_id
    order by revision.recorded_at desc, revision.user_personal_profile_revision_id desc
    limit 1;

    if not found
      or v_latest_profile.date_of_birth is distinct from p_date_of_birth
      or v_latest_profile.reported_sex::text is distinct from p_reported_sex then
      insert into private.user_personal_profile_revision (
        user_id,
        date_of_birth,
        reported_sex,
        recorded_by_user_id,
        source
      )
      values (
        p_target_user_id,
        p_date_of_birth,
        p_reported_sex::private.reported_sex,
        p_actor_user_id,
        v_source
      );
    end if;
  end if;

  if p_height_cm is not null or p_weight_kg is not null then
    select * into v_latest_measurement
    from private.user_body_measurement as measurement
    where measurement.user_id = p_target_user_id
    order by measurement.measured_at desc, measurement.user_body_measurement_id desc
    limit 1;

    if not found
      or v_latest_measurement.height_cm is distinct from p_height_cm
      or v_latest_measurement.weight_kg is distinct from p_weight_kg then
      insert into private.user_body_measurement (
        user_id,
        height_cm,
        weight_kg,
        recorded_by_user_id,
        source
      )
      values (
        p_target_user_id,
        p_height_cm,
        p_weight_kg,
        p_actor_user_id,
        v_source
      );
    end if;
  end if;
end;
$$;

revoke all on function private.get_profile_recording_source(uuid, uuid) from public, anon, authenticated;
revoke all on function public.get_profile_overview(uuid, uuid) from public, anon, authenticated;
revoke all on function public.get_profile_monthly_attendance(uuid, uuid, date) from public, anon, authenticated;
revoke all on function public.record_profile_data(uuid, uuid, date, text, smallint, numeric) from public, anon, authenticated;

grant execute on function public.get_profile_overview(uuid, uuid) to service_role;
grant execute on function public.get_profile_monthly_attendance(uuid, uuid, date) to service_role;
grant execute on function public.record_profile_data(uuid, uuid, date, text, smallint, numeric) to service_role;

comment on function public.get_profile_overview(uuid, uuid) is
  'Server-only bridge for the current voluntary profile values and weekly attendance streak.';
comment on function public.get_profile_monthly_attendance(uuid, uuid, date) is
  'Server-only bridge for calendar attendance history. Present takes precedence if multiple daily sessions exist.';
comment on function public.record_profile_data(uuid, uuid, date, text, smallint, numeric) is
  'Server-only append-only profile writer. The user and an active admin can record values after current terms acceptance.';

commit;
