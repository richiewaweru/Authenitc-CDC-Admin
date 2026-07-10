-- Delete stale, unconfirmed auth users so fake signup attempts do not
-- accumulate indefinitely.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'sweep_unconfirmed_users') then
    perform cron.unschedule('sweep_unconfirmed_users');
  end if;
end $$;

create or replace function public.sweep_unconfirmed_users()
returns void
language plpgsql
security definer
set search_path = auth, public
as $$
begin
  delete from auth.users
  where email_confirmed_at is null
    and created_at < now() - interval '7 days';

  delete from cron.job_run_details
  where end_time < now() - interval '30 days';
end;
$$;

revoke all on function public.sweep_unconfirmed_users() from public;

select cron.schedule(
  'sweep_unconfirmed_users',
  '15 3 * * *',
  $$select public.sweep_unconfirmed_users();$$
);
