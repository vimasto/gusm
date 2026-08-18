begin;

create or replace function public.upsert_institutional_identity(
  p_user_id uuid,
  p_institutional_username text
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_user_id is null then
    raise exception 'institutional identity requires an application user';
  end if;

  if (
    p_institutional_username is null
    or char_length(p_institutional_username) not between 1 and 120
    or p_institutional_username <> lower(p_institutional_username)
    or p_institutional_username ~ '[@[:space:]]'
  ) then
    raise exception 'institutional username is invalid';
  end if;

  insert into private.user_institutional_identity (
    user_id,
    institutional_username,
    last_verified_at
  )
  values (
    p_user_id,
    p_institutional_username,
    now()
  )
  on conflict (user_id) do update
  set
    institutional_username = excluded.institutional_username,
    last_verified_at = excluded.last_verified_at;
end;
$$;

revoke all on function public.upsert_institutional_identity(uuid, text) from public, anon, authenticated;
grant execute on function public.upsert_institutional_identity(uuid, text) to service_role;

comment on function public.upsert_institutional_identity(uuid, text) is
  'Server-only bridge for the service role to update private.user_institutional_identity.';

commit;
