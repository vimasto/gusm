begin;

create or replace function public.record_profile_data_from_payload(
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_profile_data jsonb
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_date_of_birth_text text;
  v_reported_sex text;
  v_height_cm_text text;
  v_weight_kg_text text;
  v_date_of_birth date;
  v_height_cm smallint;
  v_weight_kg numeric;
begin
  if p_profile_data is null or jsonb_typeof(p_profile_data) <> 'object' then
    raise exception 'profile data payload must be an object';
  end if;

  if p_profile_data ? 'dateOfBirth'
    and jsonb_typeof(p_profile_data -> 'dateOfBirth') not in ('string', 'null') then
    raise exception 'date of birth payload is invalid';
  end if;

  if p_profile_data ? 'reportedSex'
    and jsonb_typeof(p_profile_data -> 'reportedSex') not in ('string', 'null') then
    raise exception 'reported sex payload is invalid';
  end if;

  if p_profile_data ? 'heightCm'
    and jsonb_typeof(p_profile_data -> 'heightCm') not in ('number', 'null') then
    raise exception 'height payload is invalid';
  end if;

  if p_profile_data ? 'weightKg'
    and jsonb_typeof(p_profile_data -> 'weightKg') not in ('number', 'null') then
    raise exception 'weight payload is invalid';
  end if;

  v_date_of_birth_text := nullif(p_profile_data ->> 'dateOfBirth', '');
  v_reported_sex := nullif(p_profile_data ->> 'reportedSex', '');
  v_height_cm_text := nullif(p_profile_data ->> 'heightCm', '');
  v_weight_kg_text := nullif(p_profile_data ->> 'weightKg', '');

  if v_date_of_birth_text is not null then
    if v_date_of_birth_text !~ '^\\d{4}-\\d{2}-\\d{2}$' then
      raise exception 'date of birth payload is invalid';
    end if;

    v_date_of_birth := v_date_of_birth_text::date;
  end if;

  if v_height_cm_text is not null then
    if v_height_cm_text !~ '^\\d+$' then
      raise exception 'height payload is invalid';
    end if;

    v_height_cm := v_height_cm_text::smallint;
  end if;

  if v_weight_kg_text is not null then
    if v_weight_kg_text !~ '^\\d+(\\.\\d{1,2})?$' then
      raise exception 'weight payload is invalid';
    end if;

    v_weight_kg := v_weight_kg_text::numeric;
  end if;

  perform public.record_profile_data(
    p_actor_user_id,
    p_target_user_id,
    v_date_of_birth,
    v_reported_sex,
    v_height_cm,
    v_weight_kg
  );
end;
$$;

revoke execute on function public.record_profile_data(uuid, uuid, date, text, smallint, numeric) from service_role;
revoke all on function public.record_profile_data_from_payload(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.record_profile_data_from_payload(uuid, uuid, jsonb) to service_role;

comment on function public.record_profile_data_from_payload(uuid, uuid, jsonb) is
  'Server-only JSON bridge that preserves nullable voluntary fields while delegating to the append-only profile writer.';

commit;
