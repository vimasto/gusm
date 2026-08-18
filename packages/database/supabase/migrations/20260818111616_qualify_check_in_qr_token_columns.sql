begin;

create or replace function public.issue_check_in_qr(
  p_user_id uuid,
  p_token_hash bytea
)
returns table (
  state text,
  qr_token_id uuid,
  booking_date date,
  time_block_id smallint,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window record;
  v_token private.check_in_qr_token%rowtype;
begin
  if octet_length(p_token_hash) <> 32 then
    raise exception 'check-in token hash must have exactly 32 bytes';
  end if;

  if not exists (
    select 1
    from public.app_user as app_user
    join public.system_settings as system_settings on system_settings.singleton
    where app_user.user_id = p_user_id
      and app_user.disabled_at is null
      and app_user.accepted_terms_version = system_settings.current_terms_version
  ) then
    raise exception 'active user with current terms acceptance is required';
  end if;

  select * into v_window from private.current_check_in_qr_window();

  if found then
    if not exists (
      select 1
      from public.booking as booking
      where booking.user_id = p_user_id
        and booking.booking_date = v_window.booking_date
        and booking.time_block_id = v_window.time_block_id
        and booking.status = 'confirmed'
    ) then
      return query select 'no_current_booking'::text, null::uuid, null::date, null::smallint, null::timestamptz;
      return;
    end if;

    update private.check_in_qr_token as check_in_token
    set revoked_at = now()
    where check_in_token.user_id = p_user_id
      and check_in_token.booking_date = v_window.booking_date
      and check_in_token.time_block_id = v_window.time_block_id
      and check_in_token.scanned_at is null
      and check_in_token.revoked_at is null;

    insert into private.check_in_qr_token (
      user_id,
      booking_date,
      time_block_id,
      token_hash,
      expires_at
    )
    values (
      p_user_id,
      v_window.booking_date,
      v_window.time_block_id,
      p_token_hash,
      least(
        now() + interval '45 seconds',
        private.block_starts_at(v_window.booking_date, v_window.time_block_id) + interval '15 minutes'
      )
    )
    returning * into v_token;

    return query
    select
      'ready'::text,
      v_token.qr_token_id,
      v_token.booking_date,
      v_token.time_block_id,
      v_token.expires_at;
    return;
  end if;

  if exists (
    select 1
    from public.booking as booking
    where booking.user_id = p_user_id
      and booking.booking_date = (now() at time zone 'America/Santiago')::date
      and booking.status = 'absent'
      and now() >= private.block_starts_at(booking.booking_date, booking.time_block_id) + interval '15 minutes'
      and now() < private.block_ends_at(booking.booking_date, booking.time_block_id)
  ) then
    return query select 'arrived_too_late'::text, null::uuid, null::date, null::smallint, null::timestamptz;
    return;
  end if;

  return query select 'outside_window'::text, null::uuid, null::date, null::smallint, null::timestamptz;
end;
$$;

revoke all on function public.issue_check_in_qr(uuid, bytea) from public, anon, authenticated;
grant execute on function public.issue_check_in_qr(uuid, bytea) to service_role;

comment on function public.issue_check_in_qr(uuid, bytea) is
  'Server-only QR issuer. Tokens are valid only during the first 15 minutes of the bound block and require a confirmed booking.';

commit;
