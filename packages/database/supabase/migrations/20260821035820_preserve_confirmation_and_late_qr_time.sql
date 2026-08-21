begin;

alter table public.booking
  add column late_qr_authorized_at timestamptz,
  add constraint booking_late_qr_authorization_check check (
    late_qr_authorized_at is null or confirmed_at is not null
  );

create or replace function public.create_booking(p_time_block_id smallint, p_booking_date date)
returns public.booking
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user public.app_user%rowtype;
  v_booking public.booking%rowtype;
  v_start timestamptz;
  v_capacity smallint;
  v_daily_limit smallint;
  v_standard_count integer;
  v_daily_count integer;
  v_today date := (now() at time zone 'America/Santiago')::date;
  v_reactivate boolean := false;
  v_auto_confirm boolean := false;
begin
  if not (select private.is_active_current_user()) then
    raise exception 'current terms acceptance required';
  end if;

  select * into v_user
  from public.app_user
  where user_id = (select auth.uid())
    and disabled_at is null;

  if not found then
    raise exception 'active application user not found';
  end if;

  if p_booking_date < v_today or p_booking_date > v_today + 7 then
    raise exception 'booking date must be within the next 7 days';
  end if;

  if p_time_block_id = 7 and v_user.role not in ('u_staff', 'gym_staff', 'admin') then
    raise exception 'time block 7 is restricted to university staff';
  end if;

  if v_user.role = 'u_staff' and v_user.allowed_time_block_id <> p_time_block_id then
    raise exception 'u_staff is restricted to its assigned block';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_booking_date::text || ':' || p_time_block_id::text, 0));

  v_start := private.block_starts_at(p_booking_date, p_time_block_id);
  if v_start is null then
    raise exception 'time block not found';
  end if;

  if now() >= v_start then
    raise exception 'past blocks cannot be reserved';
  end if;

  if exists (
    select 1
    from public.time_block_closure
    where closure_date = p_booking_date
      and time_block_id = p_time_block_id
  ) then
    raise exception 'time block is closed for this date';
  end if;

  v_auto_confirm := now() >= v_start - interval '1 hour';

  select * into v_booking
  from public.booking
  where user_id = (select auth.uid())
    and time_block_id = p_time_block_id
    and booking_date = p_booking_date
  for update;

  if found and v_booking.status = 'reserved' and v_auto_confirm then
    insert into public.user_warning (user_id, booking_id, warning_type)
    values (v_booking.user_id, null, 'missed_confirmation');

    update public.user_warning
    set booking_id = null
    where booking_id = v_booking.booking_id;

    delete from public.booking_event
    where booking_id = v_booking.booking_id;

    delete from public.booking
    where booking_id = v_booking.booking_id;
  elsif found then
    if v_booking.status <> 'cancelled' then
      raise exception 'a booking already exists for this block and date';
    end if;

    v_reactivate := true;
  end if;

  select standard_capacity, n_sessions_per_day into v_capacity, v_daily_limit
  from public.system_settings
  where singleton;

  select count(*) into v_daily_count
  from public.booking
  where user_id = (select auth.uid())
    and booking_date = p_booking_date
    and status <> 'cancelled';

  if v_daily_count >= v_daily_limit then
    raise exception 'daily booking limit reached';
  end if;

  select count(*) into v_standard_count
  from public.booking
  where booking_date = p_booking_date
    and time_block_id = p_time_block_id
    and status in ('reserved', 'confirmed', 'present')
    and is_overcapacity = false;

  if v_standard_count >= v_capacity then
    raise exception 'standard capacity reached';
  end if;

  if v_reactivate then
    update public.booking
    set
      status = case
        when v_auto_confirm then 'confirmed'::public.booking_status
        else 'reserved'::public.booking_status
      end,
      is_overcapacity = false,
      admission_source = 'self_service',
      booked_at = now(),
      confirmed_at = case when v_auto_confirm then now() else null end,
      late_qr_authorized_at = null,
      present_at = null,
      absent_at = null,
      cancelled_at = null,
      qr_scanned_at = null
    where booking_id = v_booking.booking_id
    returning * into v_booking;

    insert into public.booking_event (booking_id, event_type, actor_user_id, metadata)
    values (
      v_booking.booking_id,
      'reactivated',
      (select auth.uid()),
      case when v_auto_confirm then '{"source":"late_booking"}'::jsonb else '{}'::jsonb end
    );
  else
    insert into public.booking (
      user_id,
      time_block_id,
      booking_date,
      status,
      confirmed_at
    )
    values (
      (select auth.uid()),
      p_time_block_id,
      p_booking_date,
      case
        when v_auto_confirm then 'confirmed'::public.booking_status
        else 'reserved'::public.booking_status
      end,
      case when v_auto_confirm then now() else null end
    )
    returning * into v_booking;

    insert into public.booking_event (booking_id, event_type, actor_user_id, metadata)
    values (
      v_booking.booking_id,
      case
        when v_auto_confirm then 'confirmed'::public.booking_event_type
        else 'reserved'::public.booking_event_type
      end,
      (select auth.uid()),
      case when v_auto_confirm then '{"source":"late_booking"}'::jsonb else '{}'::jsonb end
    );
  end if;

  if v_reactivate and v_auto_confirm then
    insert into public.booking_event (booking_id, event_type, actor_user_id, metadata)
    values (
      v_booking.booking_id,
      'confirmed',
      (select auth.uid()),
      '{"source":"late_booking"}'::jsonb
    );
  end if;

  return v_booking;
end;
$$;

create or replace function public.admit_current_staff_block_user(
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_admission_source public.booking_admission_source
)
returns public.booking
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window record;
  v_target public.app_user%rowtype;
  v_booking public.booking%rowtype;
  v_settings public.system_settings%rowtype;
  v_standard_count integer;
  v_overcapacity_count integer;
  v_other_daily_count integer;
  v_is_overcapacity boolean := p_admission_source = 'staff_overcapacity';
begin
  perform private.require_current_staff(p_actor_user_id);

  if p_admission_source not in ('staff_exception', 'staff_overcapacity') then
    raise exception 'staff admission source is required';
  end if;

  v_target := private.require_current_terms_user(p_target_user_id);
  select * into v_window from private.require_open_current_check_in_window();

  if v_window.time_block_id = 7 and v_target.role not in ('u_staff', 'gym_staff', 'admin') then
    raise exception 'time block 7 is restricted to university staff';
  elsif v_target.role = 'u_staff' and v_target.allowed_time_block_id <> v_window.time_block_id then
    raise exception 'u_staff is restricted to its assigned block';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_window.booking_date::text || ':' || v_window.time_block_id::text, 0)
  );

  select * into v_booking
  from public.booking as booking
  where booking.user_id = p_target_user_id
    and booking.booking_date = v_window.booking_date
    and booking.time_block_id = v_window.time_block_id
  for update;

  if found and v_booking.status = 'present' then
    raise exception 'user attendance is already registered';
  elsif found and v_booking.status = 'confirmed' then
    raise exception 'user already has a confirmed booking';
  end if;

  select * into v_settings from public.system_settings where singleton;

  select
    count(*) filter (where booking.is_overcapacity = false),
    count(*) filter (where booking.is_overcapacity = true)
  into v_standard_count, v_overcapacity_count
  from public.booking as booking
  where booking.booking_date = v_window.booking_date
    and booking.time_block_id = v_window.time_block_id
    and booking.status in ('reserved', 'confirmed', 'present')
    and booking.booking_id is distinct from v_booking.booking_id;

  if p_admission_source = 'staff_exception' and v_standard_count >= v_settings.standard_capacity then
    raise exception 'standard capacity is exhausted; use staff_overcapacity';
  elsif p_admission_source = 'staff_overcapacity' and v_standard_count < v_settings.standard_capacity then
    raise exception 'standard capacity remains; use staff_exception';
  elsif p_admission_source = 'staff_overcapacity' and v_overcapacity_count >= v_settings.overcapacity_max_above then
    raise exception 'overcapacity limit reached';
  end if;

  select count(*) into v_other_daily_count
  from public.booking as booking
  where booking.user_id = p_target_user_id
    and booking.booking_date = v_window.booking_date
    and booking.status <> 'cancelled'
    and booking.booking_id is distinct from v_booking.booking_id;

  if v_other_daily_count >= v_settings.n_sessions_per_day then
    raise exception 'daily booking limit reached';
  end if;

  if found then
    update public.booking
    set
      status = 'confirmed',
      is_overcapacity = v_is_overcapacity,
      admission_source = p_admission_source,
      booked_at = now(),
      confirmed_at = now(),
      late_qr_authorized_at = now(),
      present_at = null,
      absent_at = null,
      cancelled_at = null,
      qr_scanned_at = null
    where booking_id = v_booking.booking_id
    returning * into v_booking;
  else
    insert into public.booking (
      user_id,
      time_block_id,
      booking_date,
      status,
      is_overcapacity,
      admission_source,
      confirmed_at,
      late_qr_authorized_at
    )
    values (
      p_target_user_id,
      v_window.time_block_id,
      v_window.booking_date,
      'confirmed',
      v_is_overcapacity,
      p_admission_source,
      now(),
      now()
    )
    returning * into v_booking;
  end if;

  insert into public.booking_event (booking_id, event_type, actor_user_id, metadata)
  values (
    v_booking.booking_id,
    'confirmed',
    p_actor_user_id,
    jsonb_build_object('admission_source', p_admission_source, 'staff_admitted', true)
  );

  if p_admission_source = 'staff_exception' then
    insert into public.user_warning (user_id, booking_id, warning_type, created_by_user_id)
    values (p_target_user_id, v_booking.booking_id, 'unbooked_attendance', p_actor_user_id)
    on conflict (booking_id, warning_type) where booking_id is not null do nothing;
  end if;

  delete from private.staff_block_admission_request
  where user_id = p_target_user_id
    and booking_date = v_window.booking_date
    and time_block_id = v_window.time_block_id;

  return v_booking;
end;
$$;

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
  v_normal_window record;
  v_active_window record;
  v_booking public.booking%rowtype;
  v_token private.check_in_qr_token%rowtype;
begin
  if octet_length(p_token_hash) <> 32 then
    raise exception 'check-in token hash must have exactly 32 bytes';
  end if;

  perform private.require_current_terms_user(p_user_id);

  select * into v_normal_window from private.current_check_in_qr_window();

  if found then
    select * into v_booking
    from public.booking as booking
    where booking.user_id = p_user_id
      and booking.booking_date = v_normal_window.booking_date
      and booking.time_block_id = v_normal_window.time_block_id
      and booking.status = 'confirmed';

    if not found then
      return query select 'no_current_booking'::text, null::uuid, null::date, null::smallint, null::timestamptz;
      return;
    end if;

    update private.check_in_qr_token
    set revoked_at = now()
    where user_id = p_user_id
      and booking_date = v_normal_window.booking_date
      and time_block_id = v_normal_window.time_block_id
      and scanned_at is null
      and revoked_at is null;

    insert into private.check_in_qr_token (
      user_id,
      booking_date,
      time_block_id,
      token_hash,
      expires_at
    )
    values (
      p_user_id,
      v_normal_window.booking_date,
      v_normal_window.time_block_id,
      p_token_hash,
      least(
        now() + interval '45 seconds',
        private.block_starts_at(v_normal_window.booking_date, v_normal_window.time_block_id) + interval '15 minutes'
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

  select * into v_active_window from private.current_active_time_block();

  if found then
    select * into v_booking
    from public.booking as booking
    where booking.user_id = p_user_id
      and booking.booking_date = v_active_window.booking_date
      and booking.time_block_id = v_active_window.time_block_id
      and booking.status = 'confirmed'
      and booking.late_qr_authorized_at > now() - interval '5 minutes';

    if found then
      update private.check_in_qr_token
      set revoked_at = now()
      where user_id = p_user_id
        and booking_date = v_active_window.booking_date
        and time_block_id = v_active_window.time_block_id
        and scanned_at is null
        and revoked_at is null;

      insert into private.check_in_qr_token (
        user_id,
        booking_date,
        time_block_id,
        token_hash,
        expires_at
      )
      values (
        p_user_id,
        v_active_window.booking_date,
        v_active_window.time_block_id,
        p_token_hash,
        least(
          now() + interval '45 seconds',
          private.block_ends_at(v_active_window.booking_date, v_active_window.time_block_id),
          v_booking.late_qr_authorized_at + interval '5 minutes'
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

    return query select 'arrived_too_late'::text, null::uuid, null::date, null::smallint, null::timestamptz;
    return;
  end if;

  return query select 'outside_window'::text, null::uuid, null::date, null::smallint, null::timestamptz;
end;
$$;

create or replace function public.reauthorize_current_staff_block_qr(
  p_actor_user_id uuid,
  p_target_user_id uuid
)
returns public.booking
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window record;
  v_booking public.booking%rowtype;
begin
  perform private.require_current_staff(p_actor_user_id);
  perform private.require_current_terms_user(p_target_user_id);
  select * into v_window from private.require_open_current_check_in_window();

  if now() < v_window.block_starts_at + interval '15 minutes' then
    raise exception 'late QR reauthorization is available after the ordinary check-in window closes';
  end if;

  select * into v_booking
  from public.booking as booking
  where booking.user_id = p_target_user_id
    and booking.booking_date = v_window.booking_date
    and booking.time_block_id = v_window.time_block_id
    and booking.status = 'confirmed'
  for update;

  if not found then
    raise exception 'a confirmed booking is required for late QR reauthorization';
  end if;

  update public.booking
  set late_qr_authorized_at = now()
  where booking_id = v_booking.booking_id
  returning * into v_booking;

  insert into public.booking_event (booking_id, event_type, actor_user_id, metadata)
  values (
    v_booking.booking_id,
    'confirmed',
    p_actor_user_id,
    '{"late_qr_reauthorized":true}'::jsonb
  );

  return v_booking;
end;
$$;

revoke all on function public.create_booking(smallint, date) from public, anon, authenticated;
revoke all on function public.admit_current_staff_block_user(uuid, uuid, public.booking_admission_source) from public, anon, authenticated;
revoke all on function public.issue_check_in_qr(uuid, bytea) from public, anon, authenticated;
revoke all on function public.reauthorize_current_staff_block_qr(uuid, uuid) from public, anon, authenticated;
grant execute on function public.create_booking(smallint, date) to authenticated;
grant execute on function public.admit_current_staff_block_user(uuid, uuid, public.booking_admission_source) to service_role;
grant execute on function public.issue_check_in_qr(uuid, bytea) to service_role;
grant execute on function public.reauthorize_current_staff_block_qr(uuid, uuid) to service_role;

comment on column public.booking.late_qr_authorized_at is
  'Latest staff authorization for a QR outside the ordinary first 15 minutes. It preserves confirmed_at as the original confirmation timestamp.';
comment on function public.admit_current_staff_block_user(uuid, uuid, public.booking_admission_source) is
  'Server-only current-block staff action. Creates or reactivates a confirmed booking, records its audited admission source, and authorizes QR issuance for five minutes.';
comment on function public.issue_check_in_qr(uuid, bytea) is
  'Issues ordinary QR only through block start plus 15 minutes. Afterwards it requires a staff QR authorization from the preceding five minutes.';
comment on function public.reauthorize_current_staff_block_qr(uuid, uuid) is
  'Server-only late-arrival fallback. It grants an existing confirmed attendee five minutes to issue and scan a QR without changing confirmation time, admission source, or capacity.';

commit;
