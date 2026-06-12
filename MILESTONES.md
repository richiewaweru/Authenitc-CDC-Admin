# Authentic Admin Milestone Tracker

This file is the source of truth for build progress. We only move to the next milestone after:

1. The milestone implementation is complete.
2. The verification checklist for that milestone passes.
3. Any notable tradeoffs or workarounds are logged in `DECISIONS.md`.
4. This tracker is updated with the new status and verification date.

## Status Legend

- `Not Started`: no milestone work intentionally underway
- `In Progress`: active implementation
- `Blocked`: cannot proceed without external input, credentials, or environment changes
- `Ready for Verification`: implementation done, final checks pending
- `Verified`: checks passed and the milestone is accepted

## Current State

- Current verified baseline: `Milestone 10`
- Current active target: `None - milestone track complete`
- Tracking rule: no milestone advancement without updating `VERIFICATION.md`

## Milestone Board

| Milestone | Name | Status | Owner | Verified On | Notes |
|---|---|---|---|---|---|
| 1 | Project Scaffold + Auth | Verified | Codex | 2026-06-08 | SvelteKit scaffold, Supabase auth wiring, role guard shell, placeholder routes |
| 2 | Dashboard (Home) | Verified | Codex | 2026-06-11 | Verified in a live admin session with real counts, activity panels, and connected Realtime |
| 3 | Guides Page | Verified | Codex | 2026-06-11 | Live invite-link flow verified after setting `ADMIN_APP_URL`; pending setup state now comes from invite-aware loader logic |
| 4 | Slots Page | Verified | Codex | 2026-06-11 | Live admin and guide-role verification passed, including publish flow, week navigation, guide scoping, and cleanup actions |
| 5 | Bookings Page | Verified | Codex | 2026-06-11 | Live admin complete/cancel actions passed; guide-owned booking scope verified; temporary verification rows cleaned up |
| 6 | Members Page | Verified | Codex | 2026-06-11 | Live admin and guide-scope verification passed, including suspend/restore, promotion, onboarding detail, and cleanup |
| 7 | Team Management | Verified | Codex | 2026-06-12 | Live admin promotion/invite flow verified; guide access guard and moderator removal verified with real authenticated app requests |
| 8 | Notifications | Verified | Codex | 2026-06-12 | Bell, unread count, slide-over panel, deep links, and authenticated fallback feed verified live |
| 9 | Responsive Layout | Verified | Codex | 2026-06-12 | Desktop, tablet, and mobile shell/page polish verified across core routes |
| 10 | Final Review | Verified | Codex | 2026-06-12 | Admin and guide walkthroughs, CRUD checks, route guards, and cleanup verified with disposable Supabase data |

## Exit Criteria By Milestone

### Milestone 1: Project Scaffold + Auth
- `npm run dev` starts clean
- `/` redirects to `/login` when logged out
- staff users can enter the shell
- non-staff users see access denied
- placeholder routes render inside the shell

### Milestone 2: Dashboard
- stat cards show real data without schema errors
- recent activity renders safely
- upcoming and needs-attention panels render safely
- bookings Realtime subscription connects

### Milestone 3: Guides
- guide create/edit works
- search and status filtering work
- admin-only delete behavior is enforced
- summary cards render from real data

### Milestone 4: Slots
- published slots appear correctly
- week navigation is correct
- guide filtering is correct
- guide role is read-only and scoped

### Milestone 5: Bookings
- bookings table renders correctly
- tabs and filters work
- detail panel loads correct data
- complete/cancel actions update booking and slot state correctly

### Milestone 6: Members
- member list renders correctly
- member detail renders alignment/profile data correctly
- suspend/promote actions work
- guide scoping is enforced

### Milestone 7: Team Management
- admin-only access is enforced
- moderator promotion/removal works
- guide invite/linking flow works
- pending invites can be seen and managed

### Milestone 8: Notifications
- unread count works
- new realtime events create notifications
- notification links navigate correctly

### Milestone 9: Responsive Layout
- desktop layout is stable
- tablet layout is usable
- mobile layout is usable
- no horizontal overflow on core routes

### Milestone 10: Final Review
- admin walkthrough passes
- guide walkthrough passes
- CRUD flows pass
- RLS behavior is sane
- `DECISIONS.md` is complete enough for handoff

## Working Rules

- Only one milestone may be `In Progress` at a time.
- If a milestone has partial work but is not verified, it does not count as done.
- If repo work appears ahead of the tracker, reconcile it during that milestone rather than assuming completion.
