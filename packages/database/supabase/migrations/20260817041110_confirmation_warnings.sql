begin;

create extension if not exists pg_cron;
create type public.warning_type as enum ('missed_confirmation', 'missed_qr', 'unbooked_attendance');
create type public.booking_event_type as enum ('reserved', 'reactivated', 'cancelled', 'confirmed', 'expired_to_absent', 'qr_check_in', 'visual_check_in', 'visual_absence', 'authorization_consumed', 'attendance_finalized');

create table public.user_warning (
  user_warning_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_user(user_id),
  booking_id uuid references public.booking(booking_id),
  warning_type public.warning_type not null,
  created_at timestamptz not null default now(),
  created_by_user_id uuid references public.app_user(user_id)
);
create unique index user_warning_booking_type_idx on public.user_warning(booking_id, warning_type) where booking_id is not null;
create index user_warning_history_idx on public.user_warning(user_id, created_at desc);

create table public.booking_event (
  booking_event_id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.booking(booking_id),
  event_type public.booking_event_type not null,
  actor_user_id uuid references public.app_user(user_id),
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);
create index booking_event_history_idx on public.booking_event(booking_id, occurred_at);

alter table public.user_warning enable row level security;
alter table public.booking_event enable row level security;
create policy user_warning_select on public.user_warning for select to authenticated using (user_id = auth.uid() or private.is_staff());
create policy booking_event_select on public.booking_event for select to authenticated using (
  private.is_staff() or exists (select 1 from public.booking b where b.booking_id = booking_event.booking_id and b.user_id = auth.uid())
);
grant select on public.user_warning, public.booking_event to authenticated;

create or replace function public.confirm_booking(p_booking_id uuid)
returns public.booking language plpgsql security definer set search_path = '' as $$
declare v_booking public.booking%rowtype; v_start timestamptz;
begin
  select * into v_booking from public.booking where booking_id = p_booking_id and user_id = auth.uid() for update;
  if not found then raise exception 'booking not found'; end if;
  if v_booking.status <> 'reserved' then raise exception 'only reserved bookings can be confirmed'; end if;
  v_start := private.block_starts_at(v_booking.booking_date, v_booking.time_block_id);
  if now() < v_start - interval '4 hours' or now() >= v_start then raise exception 'confirmation is outside its window'; end if;
  update public.booking set status = 'confirmed', confirmed_at = now() where booking_id = p_booking_id returning * into v_booking;
  insert into public.booking_event(booking_id, event_type, actor_user_id) values (p_booking_id, 'confirmed', auth.uid());
  return v_booking;
end;
$$;

create or replace function public.cancel_booking(p_booking_id uuid)
returns public.booking language plpgsql security definer set search_path = '' as $$
declare v_booking public.booking%rowtype;
begin
  select * into v_booking from public.booking where booking_id = p_booking_id and user_id = auth.uid() for update;
  if not found then raise exception 'booking not found'; end if;
  if v_booking.status not in ('reserved', 'confirmed') then raise exception 'booking cannot be cancelled from its current status'; end if;
  if now() >= private.block_starts_at(v_booking.booking_date, v_booking.time_block_id) then raise exception 'past blocks cannot be cancelled'; end if;
  update public.booking set status = 'cancelled', cancelled_at = now() where booking_id = p_booking_id returning * into v_booking;
  insert into public.booking_event(booking_id,event_type,actor_user_id) values(p_booking_id,'cancelled',auth.uid());
  return v_booking;
end;
$$;

create or replace function public.expire_unconfirmed_bookings()
returns integer language plpgsql security definer set search_path = '' as $$
declare v_booking public.booking%rowtype; v_count integer := 0;
begin
  for v_booking in select b.* from public.booking b where b.status = 'reserved' and private.block_starts_at(b.booking_date, b.time_block_id) <= now() for update skip locked loop
    update public.booking set status = 'absent', absent_at = now() where booking_id = v_booking.booking_id;
    insert into public.user_warning(user_id, booking_id, warning_type) values (v_booking.user_id, v_booking.booking_id, 'missed_confirmation') on conflict (booking_id, warning_type) where booking_id is not null do nothing;
    insert into public.booking_event(booking_id, event_type) values (v_booking.booking_id, 'expired_to_absent');
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create or replace function public.finalize_due_attendance()
returns integer language plpgsql security definer set search_path = '' as $$
declare v_booking public.booking%rowtype; v_count integer := 0;
begin
  for v_booking in select b.* from public.booking b where b.status = 'confirmed' and private.block_ends_at(b.booking_date, b.time_block_id) + interval '15 minutes' <= now() for update skip locked loop
    update public.booking set status = 'absent', absent_at = now() where booking_id = v_booking.booking_id;
    insert into public.user_warning(user_id, booking_id, warning_type) values (v_booking.user_id, v_booking.booking_id, 'missed_qr') on conflict (booking_id, warning_type) where booking_id is not null do nothing;
    insert into public.booking_event(booking_id, event_type) values (v_booking.booking_id, 'attendance_finalized');
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.confirm_booking(uuid) from public, anon;
revoke all on function public.cancel_booking(uuid) from public, anon;
revoke all on function public.expire_unconfirmed_bookings(), public.finalize_due_attendance() from public, anon, authenticated;
grant execute on function public.confirm_booking(uuid) to authenticated;
grant execute on function public.cancel_booking(uuid) to authenticated;

do $$ begin
  if not exists (select 1 from cron.job where jobname = 'gusm-expire-unconfirmed') then perform cron.schedule('gusm-expire-unconfirmed', '* * * * *', 'select public.expire_unconfirmed_bookings()'); end if;
  if not exists (select 1 from cron.job where jobname = 'gusm-finalize-attendance') then perform cron.schedule('gusm-finalize-attendance', '* * * * *', 'select public.finalize_due_attendance()'); end if;
end $$;
commit;
