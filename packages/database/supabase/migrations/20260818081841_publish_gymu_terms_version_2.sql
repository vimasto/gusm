begin;

update public.system_settings
set current_terms_version = 2
where singleton;

comment on column public.system_settings.current_terms_version is
  'Current global terms version. Version 2 publishes the approved GYMU terms for the Sala de Musculacion.';

commit;
