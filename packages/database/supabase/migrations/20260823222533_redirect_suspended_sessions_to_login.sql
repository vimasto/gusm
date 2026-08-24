begin;

create or replace function public.get_current_access_state()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user public.app_user%rowtype;
  v_terms_version integer;
begin
  if (select auth.uid()) is null then
    return 'unauthenticated';
  end if;

  select * into v_user
  from public.app_user
  where user_id = (select auth.uid());

  if not found then
    return 'unauthenticated';
  elsif v_user.disabled_at is not null then
    return 'disabled';
  end if;

  select current_terms_version into v_terms_version
  from public.system_settings
  where singleton;

  if v_user.accepted_terms_version is distinct from v_terms_version then
    return 'terms_required';
  end if;

  return 'active';
end;
$$;

revoke all on function public.get_current_access_state() from public, anon;
grant execute on function public.get_current_access_state() to authenticated;

comment on function public.get_current_access_state() is
  'Authenticated user access state for proxy routing. It intentionally exposes no account data.';

commit;
