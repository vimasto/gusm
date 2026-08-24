begin;

create type public.discipline_violation_type as enum (
  'absent',
  'missed_confirmation',
  'missed_qr',
  'unbooked_attendance'
);

create type public.discipline_action_kind as enum ('notice', 'disable');

alter table public.app_user
  add column disabled_reason text,
  add column disabled_by_user_id uuid references public.app_user(user_id);

create table public.discipline_rule (
  discipline_rule_id uuid primary key default gen_random_uuid(),
  violation_type public.discipline_violation_type not null,
  occurrence_threshold smallint not null check (occurrence_threshold > 0),
  window_days smallint not null default 30 check (window_days between 1 and 365),
  action_kind public.discipline_action_kind not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_user_id uuid not null references public.app_user(user_id),
  updated_by_user_id uuid not null references public.app_user(user_id),
  unique (violation_type, occurrence_threshold, window_days)
);

create table public.disciplinary_action (
  disciplinary_action_id uuid primary key default gen_random_uuid(),
  discipline_rule_id uuid not null references public.discipline_rule(discipline_rule_id) on delete restrict,
  user_id uuid not null references public.app_user(user_id),
  source_event_id uuid not null,
  violation_type public.discipline_violation_type not null,
  action_kind public.discipline_action_kind not null,
  occurrence_count smallint not null check (occurrence_count > 0),
  applied_at timestamptz not null default now(),
  unique (discipline_rule_id, source_event_id)
);

create index discipline_rule_active_violation_idx
  on public.discipline_rule (violation_type, occurrence_threshold)
  where enabled;

create index disciplinary_action_user_history_idx
  on public.disciplinary_action (user_id, applied_at desc);

create trigger discipline_rule_set_updated_at
before update on public.discipline_rule
for each row execute function private.set_updated_at();

alter table public.discipline_rule enable row level security;
alter table public.disciplinary_action enable row level security;

revoke all on table public.discipline_rule, public.disciplinary_action from anon, authenticated;

create or replace function private.apply_discipline_rules(
  p_user_id uuid,
  p_violation_type public.discipline_violation_type,
  p_source_event_id uuid,
  p_occurred_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rule public.discipline_rule%rowtype;
  v_count integer;
  v_action_id uuid;
begin
  for v_rule in
    select *
    from public.discipline_rule
    where violation_type = p_violation_type
      and enabled
    order by occurrence_threshold
  loop
    if p_violation_type = 'absent' then
      select count(*) into v_count
      from public.booking as booking
      where booking.user_id = p_user_id
        and booking.status = 'absent'
        and booking.absent_at > p_occurred_at - make_interval(days => v_rule.window_days)
        and booking.absent_at <= p_occurred_at;
    else
      select count(*) into v_count
      from public.user_warning as warning
      where warning.user_id = p_user_id
        and warning.warning_type::text = p_violation_type::text
        and warning.created_at > p_occurred_at - make_interval(days => v_rule.window_days)
        and warning.created_at <= p_occurred_at;
    end if;

    if v_count <> v_rule.occurrence_threshold then
      continue;
    end if;

    insert into public.disciplinary_action (
      discipline_rule_id,
      user_id,
      source_event_id,
      violation_type,
      action_kind,
      occurrence_count
    )
    values (
      v_rule.discipline_rule_id,
      p_user_id,
      p_source_event_id,
      p_violation_type,
      v_rule.action_kind,
      v_count
    )
    on conflict (discipline_rule_id, source_event_id) do nothing
    returning disciplinary_action_id into v_action_id;

    if v_action_id is not null and v_rule.action_kind = 'disable' then
      update public.app_user
      set
        disabled_at = now(),
        disabled_reason = format(
          'Sanción automática: %s en %s días.',
          p_violation_type::text,
          v_rule.window_days
        ),
        disabled_by_user_id = null
      where user_id = p_user_id
        and disabled_at is null;
    end if;
  end loop;
end;
$$;

create or replace function private.apply_discipline_from_warning()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.apply_discipline_rules(
    new.user_id,
    new.warning_type::text::public.discipline_violation_type,
    new.user_warning_id,
    new.created_at
  );
  return new;
end;
$$;

create or replace function private.apply_discipline_from_absence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.apply_discipline_rules(
    new.user_id,
    'absent',
    new.booking_id,
    new.absent_at
  );
  return new;
end;
$$;

create trigger user_warning_apply_discipline
after insert on public.user_warning
for each row execute function private.apply_discipline_from_warning();

create trigger booking_absence_apply_discipline
after update of status on public.booking
for each row
when (old.status is distinct from new.status and new.status = 'absent')
execute function private.apply_discipline_from_absence();

create or replace function public.get_admin_discipline_rules(p_actor_user_id uuid)
returns table (
  discipline_rule_id uuid,
  violation_type public.discipline_violation_type,
  occurrence_threshold smallint,
  window_days smallint,
  action_kind public.discipline_action_kind,
  enabled boolean
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_current_admin(p_actor_user_id);

  return query
  select
    rule.discipline_rule_id,
    rule.violation_type,
    rule.occurrence_threshold,
    rule.window_days,
    rule.action_kind,
    rule.enabled
  from public.discipline_rule as rule
  order by rule.violation_type, rule.window_days, rule.occurrence_threshold;
end;
$$;

create or replace function public.upsert_admin_discipline_rule(
  p_actor_user_id uuid,
  p_violation_type public.discipline_violation_type,
  p_occurrence_threshold smallint,
  p_window_days smallint,
  p_action_kind public.discipline_action_kind
)
returns public.discipline_rule
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rule public.discipline_rule%rowtype;
begin
  perform private.require_current_admin(p_actor_user_id);

  if p_occurrence_threshold <= 0 then
    raise exception 'discipline threshold must be positive';
  elsif p_window_days not between 1 and 365 then
    raise exception 'discipline window must contain between one and 365 days';
  end if;

  insert into public.discipline_rule (
    violation_type,
    occurrence_threshold,
    window_days,
    action_kind,
    created_by_user_id,
    updated_by_user_id
  )
  values (
    p_violation_type,
    p_occurrence_threshold,
    p_window_days,
    p_action_kind,
    p_actor_user_id,
    p_actor_user_id
  )
  on conflict (violation_type, occurrence_threshold, window_days) do update
  set
    action_kind = excluded.action_kind,
    enabled = true,
    updated_by_user_id = excluded.updated_by_user_id
  returning * into v_rule;

  return v_rule;
end;
$$;

create or replace function public.remove_admin_discipline_rule(
  p_actor_user_id uuid,
  p_discipline_rule_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_current_admin(p_actor_user_id);

  update public.discipline_rule
  set
    enabled = false,
    updated_by_user_id = p_actor_user_id
  where discipline_rule_id = p_discipline_rule_id;

  return found;
end;
$$;

create or replace function public.search_admin_users(
  p_actor_user_id uuid,
  p_query text
)
returns table (
  user_id uuid,
  institutional_username text,
  user_name text,
  user_role public.app_role,
  disabled_at timestamptz,
  disabled_reason text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_query text := lower(trim(p_query));
begin
  perform private.require_current_admin(p_actor_user_id);

  if char_length(v_query) < 2 or char_length(v_query) > 120 then
    raise exception 'the user search query must contain between two and 120 characters';
  end if;

  return query
  select
    app_user.user_id,
    identity.institutional_username,
    app_user.user_name,
    app_user.role,
    app_user.disabled_at,
    app_user.disabled_reason
  from public.app_user as app_user
  join private.user_institutional_identity as identity on identity.user_id = app_user.user_id
  where identity.institutional_username like v_query || '%'
  order by identity.institutional_username
  limit 15;
end;
$$;

create or replace function public.disable_admin_user(
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_reason text
)
returns public.app_user
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target public.app_user%rowtype;
  v_reason text := trim(p_reason);
begin
  perform private.require_current_admin(p_actor_user_id);

  if p_actor_user_id = p_target_user_id then
    raise exception 'an administrator cannot disable their own account';
  elsif char_length(v_reason) not between 3 and 240 then
    raise exception 'the suspension reason must contain between three and 240 characters';
  end if;

  select * into v_target
  from public.app_user
  where user_id = p_target_user_id
  for update;

  if not found then
    raise exception 'target user not found';
  elsif v_target.role = 'admin' then
    raise exception 'administrator accounts cannot be disabled from this screen';
  end if;

  update public.app_user
  set
    disabled_at = now(),
    disabled_reason = v_reason,
    disabled_by_user_id = p_actor_user_id
  where user_id = p_target_user_id
  returning * into v_target;

  return v_target;
end;
$$;

create or replace function public.restore_admin_user(
  p_actor_user_id uuid,
  p_target_user_id uuid
)
returns public.app_user
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target public.app_user%rowtype;
begin
  perform private.require_current_admin(p_actor_user_id);

  update public.app_user
  set
    disabled_at = null,
    disabled_reason = null,
    disabled_by_user_id = null
  where user_id = p_target_user_id
    and role <> 'admin'
  returning * into v_target;

  if not found then
    raise exception 'target user was not found or cannot be restored from this screen';
  end if;

  return v_target;
end;
$$;

revoke all on function private.apply_discipline_rules(uuid, public.discipline_violation_type, uuid, timestamptz) from public, anon, authenticated;
revoke all on function private.apply_discipline_from_warning() from public, anon, authenticated;
revoke all on function private.apply_discipline_from_absence() from public, anon, authenticated;
revoke all on function public.get_admin_discipline_rules(uuid) from public, anon, authenticated;
revoke all on function public.upsert_admin_discipline_rule(uuid, public.discipline_violation_type, smallint, smallint, public.discipline_action_kind) from public, anon, authenticated;
revoke all on function public.remove_admin_discipline_rule(uuid, uuid) from public, anon, authenticated;
revoke all on function public.search_admin_users(uuid, text) from public, anon, authenticated;
revoke all on function public.disable_admin_user(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.restore_admin_user(uuid, uuid) from public, anon, authenticated;
grant execute on function public.get_admin_discipline_rules(uuid) to service_role;
grant execute on function public.upsert_admin_discipline_rule(uuid, public.discipline_violation_type, smallint, smallint, public.discipline_action_kind) to service_role;
grant execute on function public.remove_admin_discipline_rule(uuid, uuid) to service_role;
grant execute on function public.search_admin_users(uuid, text) to service_role;
grant execute on function public.disable_admin_user(uuid, uuid, text) to service_role;
grant execute on function public.restore_admin_user(uuid, uuid) to service_role;

comment on column public.app_user.disabled_at is
  'Reversible administrative or automatic disciplinary account deactivation. It blocks login and protected booking operations.';
comment on table public.discipline_rule is
  'Administrator-defined progressive discipline rules evaluated on each matching absence or immutable warning.';
comment on table public.disciplinary_action is
  'Immutable result of a discipline rule reaching its threshold for an event.';

commit;
