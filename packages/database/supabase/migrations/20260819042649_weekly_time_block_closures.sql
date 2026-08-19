begin;

create table public.weekly_time_block_closure (
  iso_weekday smallint not null check (iso_weekday between 1 and 7),
  time_block_id smallint not null references public.time_block(time_block_id),
  created_at timestamptz not null default now(),
  created_by_user_id uuid not null references public.app_user(user_id),
  primary key (iso_weekday, time_block_id)
);

create index weekly_time_block_closure_created_by_user_idx
on public.weekly_time_block_closure(created_by_user_id);

alter table public.weekly_time_block_closure enable row level security;

create policy weekly_time_block_closure_select
on public.weekly_time_block_closure
for select to authenticated
using ((select private.is_active_current_user()));

grant select on public.weekly_time_block_closure to authenticated;

create or replace function private.enforce_weekly_time_block_closure()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status in ('reserved', 'confirmed') and exists (
    select 1
    from public.weekly_time_block_closure
    where iso_weekday = extract(isodow from new.booking_date)::smallint
      and time_block_id = new.time_block_id
  ) then
    raise exception 'time block is closed on this weekday';
  end if;

  return new;
end;
$$;

create trigger booking_enforce_weekly_time_block_closure
before insert or update of booking_date, time_block_id, status
on public.booking
for each row
execute function private.enforce_weekly_time_block_closure();

create or replace function public.create_weekly_time_block_closure(
  p_time_block_id smallint,
  p_iso_weekday smallint
)
returns public.weekly_time_block_closure
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_closure public.weekly_time_block_closure%rowtype;
begin
  if not (select private.is_admin()) then
    raise exception 'administrator role required';
  end if;

  if p_iso_weekday not between 1 and 7 then
    raise exception 'weekday must use ISO numbering from 1 through 7';
  end if;

  if not exists (
    select 1
    from public.time_block
    where time_block_id = p_time_block_id
  ) then
    raise exception 'time block not found';
  end if;

  if exists (
    select 1
    from public.booking
    where time_block_id = p_time_block_id
      and extract(isodow from booking_date)::smallint = p_iso_weekday
      and status in ('reserved', 'confirmed')
  ) then
    raise exception 'active bookings must be resolved before closing a weekly time block';
  end if;

  insert into public.weekly_time_block_closure (
    iso_weekday,
    time_block_id,
    created_by_user_id
  )
  values (p_iso_weekday, p_time_block_id, (select auth.uid()))
  on conflict (iso_weekday, time_block_id) do update
  set created_by_user_id = excluded.created_by_user_id
  returning * into v_closure;

  return v_closure;
end;
$$;

create or replace function public.remove_weekly_time_block_closure(
  p_time_block_id smallint,
  p_iso_weekday smallint
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select private.is_admin()) then
    raise exception 'administrator role required';
  end if;

  delete from public.weekly_time_block_closure
  where time_block_id = p_time_block_id
    and iso_weekday = p_iso_weekday;

  return found;
end;
$$;

revoke all on function private.enforce_weekly_time_block_closure() from public, anon, authenticated;
revoke all on function public.create_weekly_time_block_closure(smallint, smallint) from public, anon;
revoke all on function public.remove_weekly_time_block_closure(smallint, smallint) from public, anon;
grant execute on function public.create_weekly_time_block_closure(smallint, smallint) to authenticated;
grant execute on function public.remove_weekly_time_block_closure(smallint, smallint) to authenticated;

comment on table public.weekly_time_block_closure is
  'Recurring closure rule administered by an admin. Date-specific closures remain in time_block_closure.';

commit;
