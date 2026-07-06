# Supabase Function Deployment

This project currently needs the remote `admin-invite-staff` Edge Function deployed before staff invite email delivery can be fully verified.

## Option 1: CLI Deploy

Use this when you have a Supabase personal access token available.

```powershell
$env:SUPABASE_ACCESS_TOKEN="<your-token>"
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-admin-invite-function.ps1
```

This deploys `admin-invite-staff` to project `mgaenmoeyiovwykibemg`.

## Option 2: Dashboard Deploy

Use this when CLI auth is unavailable in the current environment.

1. Open your Supabase project dashboard.
2. Go to `Edge Functions`.
3. Click `Deploy a new function`.
4. Choose the editor flow.
5. Upload the zip artifact at `artifacts/admin-invite-staff-dashboard-upload.zip`, or paste the contents of `supabase/functions/admin-invite-staff/index.ts`.
6. Name the function `admin-invite-staff`.
7. Deploy the function.

## After Deployment

Verify these flows in the admin app:

1. Open `/guides`.
2. Create a guide invite and confirm the recipient receives the invite email.
3. Open `/team`.
4. Create or refresh a moderator or guide invite and confirm a fresh invite email is sent.
5. If guide creation succeeds, continue the Milestone 3 CRUD checks and update `VERIFICATION.md`.
