begin;

drop policy user_warning_select on public.user_warning;
create policy user_warning_select on public.user_warning for select to authenticated using (
  (
    user_id = (select auth.uid())
    and (select private.is_active_current_user())
  )
  or (select private.is_staff())
);

drop policy booking_event_select on public.booking_event;
create policy booking_event_select on public.booking_event for select to authenticated using (
  (select private.is_staff())
  or (
    (select private.is_active_current_user())
    and exists (
      select 1
      from public.booking as booking
      where booking.booking_id = booking_event.booking_id
        and booking.user_id = (select auth.uid())
    )
  )
);

commit;
