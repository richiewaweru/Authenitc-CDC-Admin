# Email Confirmation Flow Part A Working Notes

Date: 2026-07-10
Repo: `C:\Projects\Authentic Admin`
Supabase project ref: `mgaenmoeyiovwykibemg`

## Local diagnostics

- Local repo search found one welcome-email Edge Function branch: `supabase/functions/send-member-email/index.ts`, payload type `welcome`, using `TEMPLATE_MEMBER_WELCOME`.
- Local repo search found no migration that defines the live `auth.users` signup trigger or `public.handle_new_user()`. That trigger/function appears to predate the checked-in migrations or was created through the Supabase dashboard/SQL editor.
- Existing pg_cron style is in `supabase/migrations/20260709_booking_release_rpc_and_retirement.sql`: unschedule by job name before scheduling, SQL-only lowercase migration style.
- The local Supabase metadata links this repo to project ref `mgaenmoeyiovwykibemg`.

## Live diagnostics status

Run from this shell after a Supabase access token was supplied.

- `auth.users` triggers before migration:
  - `on_auth_user_created`: `AFTER INSERT`, `EXECUTE FUNCTION handle_new_user()`
  - `on_auth_user_created_invite`: `AFTER INSERT`, `EXECUTE FUNCTION handle_invite_on_signup()`
  - `on_auth_user_deleted`: `BEFORE DELETE`, `EXECUTE FUNCTION handle_user_deleted()`
- `supabase_functions.hooks` query failed because relation `supabase_functions.hooks` does not exist in this project.
- Candidate functions:
  - `public.handle_new_user`
  - `public.handle_user_deleted`
  - `public.notify_staff_on_onboarding_complete`
- Live `public.handle_new_user()` only inserts into `public.profiles (id, email, display_name)` and returns `NEW`; it does not send welcome email.
- Live SQL search for `welcome`, `send-member-email`, and `net.http_post` found only booking/meeting-link email functions, not a database-side welcome sender.

## Welcome email source

The pre-verification welcome email was not found in live database triggers, live SQL functions, or local Admin repo callers. The Admin repo still owns `send-member-email`, and Part A adds a database-side confirmation trigger so the canonical backend send path is now first email confirmation. If a pre-confirmation welcome email still appears after deployment, inspect the consumer repo or Resend automations for an additional caller.

## Migration behavior

- `20260710112839_move_welcome_email_to_confirmation.sql` expects the live database to have `public.handle_new_user()` and the existing `public.email_member_on_meeting_link_set()` email trigger function.
- It keeps `on_auth_user_created` in place so profile rows still exist immediately after signup.
- It creates `public.email_member_on_email_confirmed()` and adds `on_auth_user_email_confirmed` as an `AFTER UPDATE OF email_confirmed_at` trigger.
- The new trigger uses a `WHEN` clause so it only fires on the first `email_confirmed_at` transition from `NULL` to non-`NULL`.
- The new function posts to the existing `send-member-email` Edge Function with payload type `welcome`.
- The function derives the Edge Function Authorization header from the existing live email trigger function at runtime, so no service-role key is committed into the repo.

## Dashboard changes to make

Completed through the Supabase Management API on 2026-07-10.

Supabase Dashboard -> Authentication -> Emails -> Templates -> Confirm signup now contains:

```html
<h2>Welcome to Authentic</h2>
<p>Confirm your email address to activate your account and continue onboarding.</p>
<p>
  <a href="https://app.authenticcdc.com/auth/confirm?token_hash={{ .TokenHash }}&type=signup">
    Confirm my email
  </a>
</p>
<p>If the button doesn't work, paste this link into your browser:</p>
<p>https://app.authenticcdc.com/auth/confirm?token_hash={{ .TokenHash }}&type=signup</p>
<p>This link expires in 24 hours. If you didn't sign up for Authentic, you can safely ignore this email.</p>
```

Also verify:

- Site URL: `https://app.authenticcdc.com` verified.
- Redirect URLs include `https://app.authenticcdc.com/auth/confirm` verified.

## Verification status

- `supabase db push --linked` applied:
  - `20260710112839_move_welcome_email_to_confirmation.sql`
  - `20260710112840_cron_sweep_unconfirmed_users.sql`
- Post-deploy trigger check:
  - `on_auth_user_created`: `AFTER INSERT`, `EXECUTE FUNCTION handle_new_user()`
  - `on_auth_user_created_invite`: `AFTER INSERT`, `EXECUTE FUNCTION handle_invite_on_signup()`
  - `on_auth_user_deleted`: `BEFORE DELETE`, `EXECUTE FUNCTION handle_user_deleted()`
  - `on_auth_user_email_confirmed`: `AFTER UPDATE`, `EXECUTE FUNCTION email_member_on_email_confirmed()`
- Post-deploy cron check:
  - `sweep_unconfirmed_users`, schedule `15 3 * * *`, active `true`
- New functions verified present:
  - `public.email_member_on_email_confirmed`
  - `public.sweep_unconfirmed_users`
- End-to-end verification is still pending Part B deployment in `C:\Projects\Authentic`.
