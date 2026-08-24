begin;

create or replace function public.get_admin_disciplinary_action_export(
  p_actor_user_id uuid,
  p_start_date date,
  p_end_date date
)
returns table (
  applied_at timestamptz,
  institutional_username text,
  user_name text,
  user_role public.app_role,
  violation_type public.discipline_violation_type,
  action_kind public.discipline_action_kind,
  occurrence_count smallint,
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
    action.applied_at,
    identity.institutional_username,
    app_user.user_name,
    app_user.role,
    action.violation_type,
    action.action_kind,
    action.occurrence_count,
    profile_revision.date_of_birth,
    profile_revision.reported_sex::text,
    measurement.height_cm,
    measurement.weight_kg
  from public.disciplinary_action as action
  join public.app_user as app_user on app_user.user_id = action.user_id
  left join private.user_institutional_identity as identity on identity.user_id = action.user_id
  left join lateral (
    select revision.date_of_birth, revision.reported_sex
    from private.user_personal_profile_revision as revision
    where revision.user_id = action.user_id
      and revision.recorded_at <= action.applied_at
    order by revision.recorded_at desc, revision.user_personal_profile_revision_id desc
    limit 1
  ) as profile_revision on true
  left join lateral (
    select body_measurement.height_cm, body_measurement.weight_kg
    from private.user_body_measurement as body_measurement
    where body_measurement.user_id = action.user_id
      and body_measurement.measured_at <= action.applied_at
    order by body_measurement.measured_at desc, body_measurement.user_body_measurement_id desc
    limit 1
  ) as measurement on true
  where action.applied_at >= p_start_date::timestamp at time zone 'America/Santiago'
    and action.applied_at < (p_end_date + 1)::timestamp at time zone 'America/Santiago'
  order by action.applied_at, app_user.user_name;
end;
$$;

revoke all on function public.get_admin_disciplinary_action_export(uuid, date, date) from public, anon, authenticated;
grant execute on function public.get_admin_disciplinary_action_export(uuid, date, date) to service_role;

comment on function public.get_admin_disciplinary_action_export(uuid, date, date) is
  'Server-only export of immutable disciplinary actions; excludes RUT, HMAC and institutional email domain.';

commit;
