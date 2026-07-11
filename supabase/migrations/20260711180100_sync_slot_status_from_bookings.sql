-- Keep available_slots.status synchronized with booking status transitions.
--
-- This trigger is intentionally idempotent with the existing Admin actions and
-- release_my_slot RPC, which may still update available_slots directly.

create or replace function public.sync_slot_status_from_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (TG_OP = 'INSERT' and NEW.status = 'confirmed') then
    update public.available_slots
       set status = 'booked',
           booked_by = NEW.user_id,
           booked_at = coalesce(booked_at, now())
     where id = NEW.slot_id
       and status = 'open';

    return NEW;
  end if;

  if (TG_OP = 'UPDATE'
      and NEW.status = 'cancelled'
      and OLD.status is distinct from 'cancelled') then
    update public.available_slots s
       set status = 'open',
           booked_by = null,
           booked_at = null
     where s.id = NEW.slot_id
       and s.status = 'booked'
       and (s.starts_at is null or s.starts_at > now())
       and not exists (
         select 1
         from public.bookings b
         where b.slot_id = NEW.slot_id
           and b.status = 'confirmed'
           and b.id <> NEW.id
       );

    return NEW;
  end if;

  if (TG_OP = 'UPDATE'
      and NEW.status = 'completed'
      and OLD.status is distinct from 'completed') then
    update public.available_slots
       set status = 'completed'
     where id = NEW.slot_id;

    return NEW;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_sync_slot_status_from_booking on public.bookings;

create trigger trg_sync_slot_status_from_booking
after insert or update on public.bookings
for each row
execute function public.sync_slot_status_from_booking();
