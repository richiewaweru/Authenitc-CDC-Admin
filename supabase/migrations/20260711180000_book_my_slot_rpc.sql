-- Atomic member booking RPC.
--
-- Deploy only after confirming the active Supabase project is mgaenmoeyiovwykibemg.
--
-- Error contract:
--   28000 - not authenticated
--   P0002 - slot not found, no longer open, or in the past
--   P0001 - member already has an active confirmed booking
--   23505 - unique violation / double-booking race

create or replace function public.book_my_slot(
  p_slot_id uuid
)
returns table (
  booking_id uuid,
  meeting_link text,
  starts_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_slot record;
  v_active_booking uuid;
  v_new_booking_id uuid;
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select
      s.id,
      s.guide_id,
      s.slot_date,
      s.slot_time,
      s.starts_at,
      s.duration_minutes,
      s.status,
      s.meeting_link
    into v_slot
  from public.available_slots s
  where s.id = p_slot_id
  for update;

  if not found then
    raise exception 'Slot not found' using errcode = 'P0002';
  end if;

  if v_slot.status <> 'open' then
    raise exception 'Slot is no longer available' using errcode = 'P0002';
  end if;

  if v_slot.starts_at is not null and v_slot.starts_at <= now() then
    raise exception 'Slot is in the past' using errcode = 'P0002';
  end if;

  select b.id
    into v_active_booking
  from public.bookings b
  where b.user_id = v_user
    and b.status = 'confirmed'
  limit 1;

  if v_active_booking is not null then
    raise exception 'Member already has an active booking' using errcode = 'P0001';
  end if;

  insert into public.bookings (
    user_id,
    guide_id,
    slot_id,
    slot_date,
    slot_time,
    duration_minutes,
    meeting_link,
    status,
    payment_status,
    amount_paid,
    currency
  ) values (
    v_user,
    v_slot.guide_id,
    p_slot_id,
    v_slot.slot_date,
    v_slot.slot_time,
    coalesce(v_slot.duration_minutes, 30),
    v_slot.meeting_link,
    'confirmed',
    'pending',
    0,
    'usd'
  )
  returning id into v_new_booking_id;

  update public.available_slots
     set status = 'booked',
         booked_by = v_user,
         booked_at = now()
   where id = p_slot_id;

  return query
    select v_new_booking_id, v_slot.meeting_link, v_slot.starts_at;
end;
$$;

revoke all on function public.book_my_slot(uuid) from public;
grant execute on function public.book_my_slot(uuid) to authenticated;
