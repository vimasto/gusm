begin;

create index booking_availability_standard_active_idx
  on public.booking (booking_date, time_block_id)
  where status in ('reserved', 'confirmed', 'present')
    and is_overcapacity = false;

create or replace function public.get_booking_week_availability(p_week_start date)
returns table (
  booking_date date,
  time_block_id smallint,
  time_block_t0 time,
  time_block_t1 time,
  standard_capacity smallint,
  standard_count integer,
  current_booking_id uuid,
  current_booking_status public.booking_status,
  current_booking_is_overcapacity boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'America/Santiago')::date;
  v_current_week_start date := date_trunc('week', v_today::timestamp)::date;
begin
  if not (select private.is_active_current_user()) then
    raise exception 'current terms acceptance required';
  end if;

  if p_week_start not in (
    v_current_week_start - 7,
    v_current_week_start,
    v_current_week_start + 7
  ) then
    raise exception 'week is outside the booking calendar range';
  end if;

  return query
  with booking_days as (
    select generate_series(p_week_start, p_week_start + 4, interval '1 day')::date as booking_date
  )
  select
    booking_days.booking_date,
    time_block.time_block_id,
    time_block.time_block_t0,
    time_block.time_block_t1,
    system_settings.standard_capacity,
    count(booking.booking_id) filter (
      where booking.status in ('reserved', 'confirmed', 'present')
        and booking.is_overcapacity = false
    )::integer as standard_count,
    current_booking.booking_id,
    current_booking.status,
    current_booking.is_overcapacity
  from booking_days
  cross join public.time_block
  cross join public.system_settings
  left join public.booking
    on booking.booking_date = booking_days.booking_date
    and booking.time_block_id = time_block.time_block_id
  left join lateral (
    select
      own_booking.booking_id,
      own_booking.status,
      own_booking.is_overcapacity
    from public.booking as own_booking
    where own_booking.user_id = (select auth.uid())
      and own_booking.booking_date = booking_days.booking_date
      and own_booking.time_block_id = time_block.time_block_id
  ) as current_booking on true
  group by
    booking_days.booking_date,
    time_block.time_block_id,
    time_block.time_block_t0,
    time_block.time_block_t1,
    system_settings.standard_capacity,
    current_booking.booking_id,
    current_booking.status,
    current_booking.is_overcapacity
  order by booking_days.booking_date, time_block.display_order;
end;
$$;

revoke all on function public.get_booking_week_availability(date) from public, anon;
grant execute on function public.get_booking_week_availability(date) to authenticated;

create or replace function private.broadcast_booking_availability_invalidation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current public.booking%rowtype;
  v_previous public.booking%rowtype;
begin
  if tg_op = 'DELETE' then
    v_current := old;
  else
    v_current := new;
  end if;

  perform realtime.send(
    '{}'::jsonb,
    'invalidate',
    format('booking-availability:%s:%s', v_current.booking_date, v_current.time_block_id),
    true
  );

  if tg_op = 'UPDATE'
    and (old.booking_date, old.time_block_id) is distinct from (new.booking_date, new.time_block_id) then
    v_previous := old;

    perform realtime.send(
      '{}'::jsonb,
      'invalidate',
      format('booking-availability:%s:%s', v_previous.booking_date, v_previous.time_block_id),
      true
    );
  end if;

  return null;
end;
$$;

drop trigger if exists booking_availability_invalidation on public.booking;
create trigger booking_availability_invalidation
after insert or delete or update of status, is_overcapacity, booking_date, time_block_id
on public.booking
for each row
execute function private.broadcast_booking_availability_invalidation();

drop policy if exists booking_availability_broadcast_select on realtime.messages;
create policy booking_availability_broadcast_select
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and realtime.topic() ~ '^booking-availability:[0-9]{4}-[0-9]{2}-[0-9]{2}:[1-9]$'
  and (select private.is_active_current_user())
);

comment on function public.get_booking_week_availability(date) is
  'Returns five operational days of booking counts and only the caller''s reservation state. It accepts only the previous, current, or next Santiago calendar week.';

comment on function private.broadcast_booking_availability_invalidation() is
  'Broadcasts private per-date and per-block availability invalidations without exposing booking rows.';

commit;
