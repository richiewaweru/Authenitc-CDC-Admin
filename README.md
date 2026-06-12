# Authenitc-CDC-Admin

Admin application for the Authentic CDC project, built with SvelteKit, TypeScript, Tailwind CSS, and Supabase.

## Project Tracking

- Milestone status lives in [MILESTONES.md](./MILESTONES.md)
- Verification evidence lives in [VERIFICATION.md](./VERIFICATION.md)
- Architecture and implementation tradeoffs live in [DECISIONS.md](./DECISIONS.md)

## Getting Started

Install dependencies:

```sh
npm install
```

Create a local `.env` file from `.env.example` and fill in your Supabase values:

```sh
Copy-Item .env.example .env
```

Start the development server:

```sh
npm run dev
```

## Scripts

```sh
npm run dev
npm run build
npm run preview
npm run check
```

## Supabase Function Deploy

Milestone 3 currently depends on the remote `admin-invite-staff` Edge Function being updated to the latest invite-link flow.

Set a Supabase personal access token, then run:

```powershell
$env:SUPABASE_ACCESS_TOKEN="<your-token>"
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-admin-invite-function.ps1
```

This deploys the function to project `mgaenmoeyiovwykibemg` and prints the next verification steps for `/guides` and `/team`.

If you want to target a different project or function name:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-admin-invite-function.ps1 -ProjectRef "<project-ref>" -FunctionName "<function-name>"
```

If CLI auth is unavailable, use the Dashboard fallback in [SUPABASE_DEPLOY.md](./SUPABASE_DEPLOY.md).
