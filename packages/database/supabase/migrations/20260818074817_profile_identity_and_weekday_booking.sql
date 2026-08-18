begin;

create type private.reported_sex as enum (
  'masculino',
  'femenino',
  'otro',
  'prefiero_no_decir'
);

create type private.profile_data_source as enum (
  'self_reported',
  'admin_recorded'
);

create table private.user_institutional_identity (
  user_id uuid primary key references public.app_user(user_id) on delete restrict,
  institutional_username text not null unique,
  last_verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    char_length(institutional_username) between 1 and 120
    and institutional_username = lower(institutional_username)
    and institutional_username !~ '[@[:space:]]'
  )
);

create table private.user_profile_consent (
  user_profile_consent_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_user(user_id) on delete restrict,
  terms_version text not null check (char_length(trim(terms_version)) between 1 and 120),
  consented_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  check (withdrawn_at is null or withdrawn_at >= consented_at)
);

create unique index user_profile_consent_active_user_idx
on private.user_profile_consent(user_id)
where withdrawn_at is null;

create table private.user_personal_profile_revision (
  user_personal_profile_revision_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_user(user_id) on delete restrict,
  user_profile_consent_id uuid not null references private.user_profile_consent(user_profile_consent_id) on delete restrict,
  date_of_birth date not null,
  reported_sex private.reported_sex not null,
  recorded_at timestamptz not null default now(),
  recorded_by_user_id uuid not null references public.app_user(user_id) on delete restrict,
  source private.profile_data_source not null,
  check (date_of_birth < recorded_at::date)
);

create index user_personal_profile_revision_user_recorded_idx
on private.user_personal_profile_revision(user_id, recorded_at desc);

create table private.user_body_measurement (
  user_body_measurement_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_user(user_id) on delete restrict,
  user_profile_consent_id uuid not null references private.user_profile_consent(user_profile_consent_id) on delete restrict,
  height_cm smallint,
  weight_kg numeric(5, 2),
  measured_at timestamptz not null default now(),
  recorded_by_user_id uuid not null references public.app_user(user_id) on delete restrict,
  source private.profile_data_source not null,
  check (height_cm is not null or weight_kg is not null),
  check (height_cm is null or height_cm between 50 and 260),
  check (weight_kg is null or weight_kg between 20 and 350)
);

create index user_body_measurement_user_measured_idx
on private.user_body_measurement(user_id, measured_at desc);

create trigger user_institutional_identity_set_updated_at
before update on private.user_institutional_identity
for each row execute function private.set_updated_at();

alter table private.user_institutional_identity enable row level security;
alter table private.user_profile_consent enable row level security;
alter table private.user_personal_profile_revision enable row level security;
alter table private.user_body_measurement enable row level security;

revoke all on private.user_institutional_identity from public, anon, authenticated;
revoke all on private.user_profile_consent from public, anon, authenticated;
revoke all on private.user_personal_profile_revision from public, anon, authenticated;
revoke all on private.user_body_measurement from public, anon, authenticated;

alter table public.booking
add constraint booking_weekday_check
check (extract(isodow from booking_date) between 1 and 5);

comment on table private.user_institutional_identity is
  'Latest verified institutional username before @. Domains and full email addresses are not persisted.';
comment on table private.user_profile_consent is
  'Append-only evidence that a user accepted a version of the personal-data terms.';
comment on table private.user_personal_profile_revision is
  'Immutable demographic revisions. Age is derived from date_of_birth at query time.';
comment on table private.user_body_measurement is
  'Immutable, consent-backed voluntary body measurements for longitudinal export.';

commit;
