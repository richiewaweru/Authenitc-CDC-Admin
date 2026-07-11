-- One-time reconciliation for slots that drifted open while a confirmed booking exists.
--
-- This intentionally fixes only the safe direction. Slots marked booked with no
-- confirmed booking require manual review before reopening or deletion.

update public.available_slots s
   set status = 'booked',
       booked_by = b.user_id,
       booked_at = coalesce(s.booked_at, b.created_at, now())
  from public.bookings b
 where b.slot_id = s.id
   and b.status = 'confirmed'
   and s.status = 'open';
