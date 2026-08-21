begin;

alter table public.app_user
add column theme_preference text not null default 'dark',
add constraint app_user_theme_preference_check check (theme_preference in ('dark', 'light'));

drop function public.get_profile_overview(uuid, uuid);

create function public.get_profile_overview(
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

create function public.update_current_user_theme_preference(
  p_actor_user_id uuid,
  p_theme_preference text
)
returns text language plpgsql security definer set search_path = '' as $$
begin
  if p_theme_preference not in ('dark', 'light') then
    raise exception 'theme preference is invalid';
  end if;

  if not exists (
    select 1
    from public.app_user as app_user
    join public.system_settings as system_settings on system_settings.singleton
    where app_user.user_id = p_actor_user_id
      and app_user.disabled_at is null
      and app_user.accepted_terms_version = system_settings.current_terms_version
  ) then
    raise exception 'active actor with current terms acceptance is required';
  end if;

  update public.app_user
  set theme_preference = p_theme_preference
  where user_id = p_actor_user_id;

  return p_theme_preference;
end;
$$;

revoke all on function public.get_profile_overview(uuid, uuid) from public, anon, authenticated;
revoke all on function public.update_current_user_theme_preference(uuid, text) from public, anon, authenticated;

grant execute on function public.get_profile_overview(uuid, uuid) to service_role;
grant execute on function public.update_current_user_theme_preference(uuid, text) to service_role;

comment on function public.get_profile_overview(uuid, uuid) is
  'Server-only bridge for the current voluntary profile values, weekly attendance streak, and theme preference.';
comment on function public.update_current_user_theme_preference(uuid, text) is
  'Server-only writer for the active user theme preference.';

commit;
