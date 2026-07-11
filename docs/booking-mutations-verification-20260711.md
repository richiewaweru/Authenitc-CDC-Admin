# Booking Mutations Verification - 2026-07-11

Supabase project: `mgaenmoeyiovwykibemg`

## Release RPC Diagnosis

Reproduced from a disposable live verification booking on 2026-07-11. Updating a confirmed booking to `cancelled` initially failed with:

- Message: `invalid input syntax for type time: "your scheduled time"`
- Context: direct `bookings.status = 'cancelled'` update during trigger verification
- Root cause: `email_member_on_booking_cancelled()` used `COALESCE(NEW.slot_time, 'your scheduled time')`, which coerced the fallback text into the `time` column type.
- Fix: migration `20260711180300_fix_booking_email_slot_time_cast.sql` patches `email_member_on_booking_cancelled()` and `email_member_on_meeting_link_set()` to use `NEW.slot_time::text`.
- Post-fix result: direct cancellation reopens the future slot, and authenticated `release_my_slot` returns `(booking_id, slot_id)` successfully.

Still capture these fields from Dashboard logs when Richie triggers the failing Consumer cancel/change flow:

- Postgres log SQLSTATE:
- Postgres log message:
- Postgres log detail:
- API/PostgREST response:
- Affected member id:
- Affected slot id:
- Affected booking id:
- Latest `retire_past_bookings_hourly` run:

Use these SQL checks during the repro:

```sql
select id, user_id, guide_id, slot_id, status, cancelled_at, created_at
from public.bookings
where user_id = '<member-uuid>'
order by created_at desc
limit 10;

select id, guide_id, status, booked_by, booked_at, starts_at, slot_date, slot_time
from public.available_slots
where id = '<slot-uuid>';

select *
from cron.job_run_details
where jobname = 'retire_past_bookings_hourly'
order by start_time desc
limit 5;
```

## Drift Reconciliation

Read-only live preview from Supabase JS service-role query on 2026-07-11:

- Confirmed bookings: `1`
- Slots referenced by confirmed bookings: `1`
- Open slots with confirmed bookings: `1`
- Booked slots without confirmed bookings: `0`
- Drifted booking: `e25dd8e6-e47f-4a9f-808c-f772f6ef191f`
- Drifted slot: `cbc55640-66a2-42d0-a517-0501bcc0d74c`

Post-migration read-only check:

- Confirmed bookings: `1`
- Open slots with confirmed bookings: `0`
- Booked slots without confirmed bookings: `0`

Migration `20260711180200_reconcile_booking_slot_status.sql` corrects the safe drift direction:

- `available_slots.status = 'open'`
- linked `bookings.status = 'confirmed'`

Manual review remains required for slots marked `booked` with no confirmed booking:

```sql
select s.id, s.status, s.booked_by, s.booked_at
from public.available_slots s
left join public.bookings b on b.slot_id = s.id and b.status = 'confirmed'
where s.status = 'booked'
  and b.id is null;
```

## RLS Audit

Live policy audit after `20260711180400_remove_member_slot_update_policy.sql`:

- Direct member `UPDATE` policy `slots_book_member` was present before the audit fix.
- `slots_book_member` was dropped.
- Remaining `UPDATE` policies are guide-owned-slot and staff scoped:
  - `guides_update_own_slots`
  - `slots_update_own_guide`
  - `slots_update_staff`
- Remaining `DELETE` policies are guide-owned-slot and staff scoped:
  - `guides_delete_own_slots`
  - `slots_delete_own_guide`
  - `slots_delete_staff`

```sql
select policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'available_slots'
order by cmd, policyname;
```

Result: no member-scoped direct `UPDATE` or `DELETE` policy on `available_slots`.

## Deployment And Acceptance

- [x] `supabase db push --linked` against linked project `mgaenmoeyiovwykibemg`
- [x] `book_my_slot` succeeds for an authenticated member and open future slot.
- [x] The created booking is `confirmed` and copies slot date/time/duration/meeting link.
- [x] The booked slot has `status = 'booked'`, `booked_by`, and `booked_at`.
- [x] Existing active booking returns `P0001`.
- [x] Missing or non-open slot returns `P0002`.
- [x] Unauthenticated call returns `28000`.
- [x] Direct confirmed booking insert books the linked slot through the trigger.
- [x] Transition to `cancelled` reopens a future slot when no other confirmed booking exists.
- [x] Authenticated `release_my_slot` cancels the booking and reopens the slot.
- [x] Transition to `completed` marks the linked slot completed.
- [x] Final post-RLS smoke: authenticated `book_my_slot` still books through SECURITY DEFINER and `release_my_slot` still reopens the slot.
- [ ] Admin Bookings page realtime behavior remains intact.
