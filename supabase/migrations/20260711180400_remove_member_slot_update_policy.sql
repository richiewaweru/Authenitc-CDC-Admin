-- Members book slots through SECURITY DEFINER RPCs only.
-- Direct available_slots UPDATE access caused Consumer-side drift and 403s.

drop policy if exists slots_book_member on public.available_slots;
