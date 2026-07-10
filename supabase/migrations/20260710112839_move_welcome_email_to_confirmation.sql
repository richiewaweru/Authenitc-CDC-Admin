-- Send the member welcome email only after first email confirmation.
--
-- Keep public.handle_new_user() on auth.users INSERT because the live function
-- only creates the required public.profiles row.

do $$
begin
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'handle_new_user'
      and pg_get_function_arguments(p.oid) = ''
  ) then
    raise exception 'Expected public.handle_new_user() to exist before adding the email-confirmation welcome trigger';
  end if;

  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'email_member_on_meeting_link_set'
      and lower(p.prosrc) like '%send-member-email%'
  ) then
    raise exception 'Expected public.email_member_on_meeting_link_set() to contain the existing send-member-email authorization pattern';
  end if;
end $$;

drop trigger if exists on_auth_user_email_confirmed on auth.users;

create or replace function public.email_member_on_email_confirmed()
returns trigger
language plpgsql
security definer
set search_path = public, net
as $$
declare
  v_member_email text;
  v_member_name text;
  v_authorization text;
begin
  select
    coalesce(nullif(trim(p.email), ''), new.email),
    coalesce(
      nullif(trim(p.first_name), ''),
      nullif(trim(p.display_name), ''),
      split_part(coalesce(nullif(trim(p.email), ''), new.email), '@', 1),
      'there'
    )
    into v_member_email, v_member_name
  from public.profiles p
  where p.id = new.id;

  v_member_email := coalesce(v_member_email, new.email);
  v_member_name := coalesce(
    v_member_name,
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    split_part(new.email, '@', 1),
    'there'
  );

  if v_member_email is null or trim(v_member_email) = '' then
    return new;
  end if;

  select (regexp_match(p.prosrc, '"Authorization": "([^"]+)"'))[1]
    into v_authorization
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'email_member_on_meeting_link_set'
    and lower(p.prosrc) like '%send-member-email%'
  order by p.oid
  limit 1;

  if v_authorization is null or trim(v_authorization) = '' then
    raise exception 'Could not resolve send-member-email authorization header from existing email trigger function';
  end if;

  perform net.http_post(
    url := 'https://mgaenmoeyiovwykibemg.supabase.co/functions/v1/send-member-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', v_authorization
    ),
    body := jsonb_build_object(
      'type', 'welcome',
      'userEmail', v_member_email,
      'firstName', v_member_name
    )
  );

  return new;
end;
$$;

revoke all on function public.email_member_on_email_confirmed() from public;

create trigger on_auth_user_email_confirmed
after update of email_confirmed_at on auth.users
for each row
when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
execute function public.email_member_on_email_confirmed();
