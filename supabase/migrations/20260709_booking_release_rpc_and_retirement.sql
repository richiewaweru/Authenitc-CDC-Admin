-- Booking release/reschedule RPC and past-booking retirement.
--
-- Deploy only after confirming the active Supabase project is mgaenmoeyiovwykibemg.
-- The status CHECK blocks below preserve existing allowed values and add "expired"
-- only when the current constraint does not already allow it.

do $$
declare
  v_constraint_name name;
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.bookings'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
      and pg_get_constraintdef(oid) not ilike '%expired%'
  ) then
    select conname
      into v_constraint_name
    from pg_constraint
    where conrelid = 'public.bookings'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
    order by conname
    limit 1;

    execute format('alter table public.bookings drop constraint %I', v_constraint_name);
    alter table public.bookings
      add constraint bookings_status_check
      check (status in ('confirmed', 'completed', 'cancelled', 'no_show', 'approved', 'rejected', 'expired'));
  end if;
end $$;

do $$
declare
  v_constraint_name name;
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.available_slots'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
      and pg_get_constraintdef(oid) not ilike '%expired%'
  ) then
    select conname
      into v_constraint_name
    from pg_constraint
    where conrelid = 'public.available_slots'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
    order by conname
    limit 1;

    execute format('alter table public.available_slots drop constraint %I', v_constraint_name);
    alter table public.available_slots
      add constraint available_slots_status_check
      check (status in ('open', 'booked', 'cancelled', 'completed', 'closed', 'expired'));
  end if;
end $$;

create or replace function public.release_my_slot(
  p_slot_id uuid,
  p_reason text default 'Released by member'
)
returns table (booking_id uuid, slot_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_booking_id uuid;
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select b.id
    into v_booking_id
  from public.bookings b
  where b.slot_id = p_slot_id
    and b.user_id = v_user
    and b.status = 'confirmed'
  limit 1;

  if v_booking_id is null then
    raise exception 'No active booking found for this slot' using errcode = 'P0002';
  end if;

  update public.bookings
     set status = 'cancelled',
         cancelled_at = now(),
         cancel_reason = coalesce(nullif(p_reason, ''), 'Released by member'),
         updated_at = now()
   where id = v_booking_id;

  update public.available_slots
     set status = 'open',
         booked_by = null,
         booked_at = null
   where id = p_slot_id
     and status = 'booked'
     and (starts_at is null or starts_at > now());

  return query select v_booking_id, p_slot_id;
end;
$$;

revoke all on function public.release_my_slot(uuid, text) from public;
grant execute on function public.release_my_slot(uuid, text) to authenticated;

create or replace function public.retire_past_bookings()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.bookings b
     set status = 'expired',
         updated_at = now()
    from public.available_slots s
   where b.slot_id = s.id
     and b.status = 'confirmed'
     and s.starts_at < now() - interval '2 hours';

  update public.available_slots s
     set status = 'expired'
   where s.status = 'booked'
     and s.starts_at < now() - interval '2 hours';
end;
$$;

revoke all on function public.retire_past_bookings() from public;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'retire_past_bookings_hourly') then
    perform cron.unschedule('retire_past_bookings_hourly');
  end if;
end $$;

select cron.schedule(
  'retire_past_bookings_hourly',
  '0 * * * *',
  $$select public.retire_past_bookings();$$
);

do $$
begin
  if exists (select 1 from cron.job where jobname = 'prune_cron_history_daily') then
    perform cron.unschedule('prune_cron_history_daily');
  end if;
end $$;

select cron.schedule(
  'prune_cron_history_daily',
  '30 3 * * *',
  $$delete from cron.job_run_details where end_time < now() - interval '7 days';$$
);

select public.retire_past_bookings();
