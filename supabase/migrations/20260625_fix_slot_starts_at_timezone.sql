-- One-time fix: recalculate starts_at for all slots from slot_date + slot_time
-- Interprets slot_date + slot_time as America/New_York and stores as UTC
--
-- This is safe to run multiple times - it recalculates from the source columns.

UPDATE public.available_slots
SET starts_at = (
  (slot_date || 'T' || slot_time)::TIMESTAMP
  AT TIME ZONE 'America/New_York'
)
WHERE slot_date IS NOT NULL
  AND slot_time IS NOT NULL;
