begin;

create or replace function public.cancel_booking(p_booking_id uuid)
returns public.booking
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.booking%rowtype;
  v_start timestamptz;
begin
  if not (select private.is_active_current_user()) then
    raise exception 'current terms acceptance required';
  end if;

  select * into v_booking
  from public.booking
  where booking_id = p_booking_id
    and user_id = (select auth.uid())
  for update;

  if not found then
    raise exception 'booking not found';
  end if;

  if v_booking.status not in ('reserved', 'confirmed') then
    raise exception 'booking cannot be cancelled from its current status';
  end if;

  v_start := private.block_starts_at(v_booking.booking_date, v_booking.time_block_id);
  if now() >= v_start then
    raise exception 'past blocks cannot be cancelled';
  end if;

  if v_booking.status = 'confirmed' and now() >= v_start - interval '1 hour' then
    raise exception 'confirmed bookings cannot be cancelled during the last hour before the block';
  end if;

  update public.booking
  set status = 'cancelled', cancelled_at = now()
  where booking_id = p_booking_id
  returning * into v_booking;

  insert into public.booking_event (booking_id, event_type, actor_user_id)
  values (p_booking_id, 'cancelled', (select auth.uid()));

  return v_booking;
end;
$$;

revoke all on function public.cancel_booking(uuid) from public, anon;
grant execute on function public.cancel_booking(uuid) to authenticated;

comment on function public.cancel_booking(uuid) is
  'Users may cancel reserved bookings until the start. Confirmed bookings lock one hour before the block to prevent last-minute capacity hoarding.';

commit;
