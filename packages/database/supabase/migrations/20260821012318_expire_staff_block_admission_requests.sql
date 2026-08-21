begin;

create or replace function public.expire_staff_block_admission_requests()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  delete from private.staff_block_admission_request
  where expires_at <= now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from cron.job
    where jobname = 'gymu-expire-staff-block-admission-requests'
  ) then
    perform cron.schedule(
      'gymu-expire-staff-block-admission-requests',
      '* * * * *',
      'select public.expire_staff_block_admission_requests()'
    );
  end if;
end;
$$;

revoke all on function public.expire_staff_block_admission_requests() from public, anon, authenticated;

comment on function public.expire_staff_block_admission_requests() is
  'Removes expired current-block admission requests. Requests are an ephemeral operational signal, not an attendance record.';

commit;
