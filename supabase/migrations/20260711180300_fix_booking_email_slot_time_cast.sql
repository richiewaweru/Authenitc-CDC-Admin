-- Fix booking email triggers that cast the fallback text "your scheduled time"
-- to the slot_time column type.
--
-- The live trigger functions include deployment-specific HTTP headers, so this
-- migration patches the existing function definitions in place instead of
-- checking those headers into source control.

do $$
declare
  v_function_name name;
  v_definition text;
  v_next_definition text;
begin
  foreach v_function_name in array array[
    'email_member_on_booking_cancelled',
    'email_member_on_meeting_link_set'
  ] loop
    select pg_get_functiondef(p.oid)
      into v_definition
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = v_function_name
      and p.pronargs = 0;

    if v_definition is null then
      raise notice 'Function public.%() does not exist; skipping', v_function_name;
      continue;
    end if;

    v_next_definition := replace(
      v_definition,
      'v_slot_time := COALESCE(NEW.slot_time, ''your scheduled time'');',
      'v_slot_time := COALESCE(NEW.slot_time::text, ''your scheduled time'');'
    );

    if v_next_definition = v_definition then
      raise notice 'Function public.%() did not need slot_time fallback patch', v_function_name;
      continue;
    end if;

    execute v_next_definition;
  end loop;
end $$;
