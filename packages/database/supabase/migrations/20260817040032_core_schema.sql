begin;

create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create type public.app_role as enum ('student', 'u_staff', 'gym_staff', 'admin');
create type public.booking_status as enum ('reserved', 'confirmed', 'present', 'absent', 'cancelled');

create table public.time_block (
  time_block_id smallint primary key,
  time_block_t0 time not null,
  time_block_t1 time not null,
  display_order smallint not null unique,
  check (time_block_t0 < time_block_t1)
);

create table public.app_user (
  user_id uuid primary key references auth.users(id) on delete restrict,
  user_name text not null check (char_length(trim(user_name)) between 1 and 120),
  identity_hmac bytea not null unique check (octet_length(identity_hmac) = 32),
  role public.app_role not null default 'student',
  allowed_time_block_id smallint references public.time_block(time_block_id),
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (role = 'u_staff' and allowed_time_block_id is not null)
    or (role <> 'u_staff' and allowed_time_block_id is null)
  )
);

create table public.system_settings (
  singleton boolean primary key default true check (singleton),
  standard_capacity smallint not null check (standard_capacity > 0),
  overcapacity_max_above smallint not null check (overcapacity_max_above >= 0),
  n_sessions_per_day smallint not null default 1 check (n_sessions_per_day > 0),
  updated_at timestamptz not null default now(),
  updated_by_user_id uuid references public.app_user(user_id)
);

insert into public.system_settings(singleton, standard_capacity, overcapacity_max_above, n_sessions_per_day)
values (true, 15, 4, 1);

create table public.booking (
  booking_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_user(user_id),
  time_block_id smallint not null references public.time_block(time_block_id),
  booking_date date not null,
  status public.booking_status not null default 'reserved',
  is_overcapacity boolean not null default false,
  booked_at timestamptz not null default now(),
  confirmed_at timestamptz,
  present_at timestamptz,
  absent_at timestamptz,
  cancelled_at timestamptz,
  qr_scanned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, time_block_id, booking_date)
);

create index booking_block_status_idx on public.booking(booking_date, time_block_id, status);
create index booking_user_history_idx on public.booking(user_id, booking_date desc);

create or replace function private.set_updated_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin new.updated_at := now(); return new; end;
$$;

create trigger app_user_set_updated_at before update on public.app_user for each row execute function private.set_updated_at();
create trigger booking_set_updated_at before update on public.booking for each row execute function private.set_updated_at();
create trigger settings_set_updated_at before update on public.system_settings for each row execute function private.set_updated_at();

create or replace function private.is_active_current_user()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.app_user where user_id = auth.uid() and disabled_at is null);
$$;

create or replace function private.current_user_role()
returns public.app_role language sql stable security definer set search_path = '' as $$
  select role from public.app_user where user_id = auth.uid() and disabled_at is null;
$$;

create or replace function private.is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.current_user_role() in ('gym_staff', 'admin');
$$;

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.current_user_role() = 'admin';
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;
revoke all on function private.is_active_current_user() from public, anon;
revoke all on function private.current_user_role() from public, anon;
revoke all on function private.is_staff() from public, anon;
revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_active_current_user(), private.current_user_role(), private.is_staff(), private.is_admin() to authenticated;

alter table public.app_user enable row level security;
alter table public.time_block enable row level security;
alter table public.system_settings enable row level security;
alter table public.booking enable row level security;

create policy app_user_select on public.app_user for select to authenticated using (
  (user_id = auth.uid() and private.is_active_current_user()) or private.is_staff()
);
create policy time_block_select on public.time_block for select to authenticated using (private.is_active_current_user());
create policy settings_select on public.system_settings for select to authenticated using (private.is_active_current_user());
create policy booking_select on public.booking for select to authenticated using (
  (user_id = auth.uid() and private.is_active_current_user()) or private.is_staff()
);

grant select on public.app_user, public.time_block, public.system_settings, public.booking to authenticated;
commit;
