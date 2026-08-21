begin;

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

  if v_prefix !~ '^[a-z0-9._+-]{2,80}$' then
    raise exception 'institutional username prefix must contain 2 to 80 lowercase username characters without a domain';
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

revoke all on function public.search_current_staff_block_users(uuid, text) from public, anon, authenticated;
grant execute on function public.search_current_staff_block_users(uuid, text) to service_role;

comment on function public.search_current_staff_block_users(uuid, text) is
  'Server-only staff lookup by a literal institutional username prefix in the active QR window.';

commit;
