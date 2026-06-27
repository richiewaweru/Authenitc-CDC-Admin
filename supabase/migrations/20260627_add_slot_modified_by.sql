ALTER TABLE public.available_slots
  ADD COLUMN IF NOT EXISTS modified_by UUID REFERENCES auth.users(id);
