# Verification Log

This file records the evidence for each milestone. We only promote a milestone to `Verified` after its checks are written here.

## Verification Template

Use this format each time a milestone is completed:

```md
## Milestone X: Name
- Date:
- Status:
- Commands run:
- Routes checked:
- Roles checked:
- What passed:
- What could not be verified:
- Follow-up fixes made during verification:
```

---

## Milestone 1: Project Scaffold + Auth

- Date: 2026-06-08
- Status: Verified
- Commands run:
  - `npm run check`
  - `npm run build`
  - `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-admin-invite-function.ps1`
  - `Compress-Archive -Path supabase\functions\admin-invite-staff\* -DestinationPath artifacts\admin-invite-staff-dashboard-upload.zip -Force`
- Routes checked:
  - `/login`
  - `/`
  - `/access-denied`
- Roles checked:
  - Logged-out redirect behavior
  - Access denied route render
- What passed:
  - Type checks passed with no errors or warnings
  - Production build succeeded
  - Logged-out `/` redirected to `/login`
  - Login page rendered successfully
  - Access denied page rendered successfully
- What could not be verified:
  - Successful authenticated shell entry for a real admin, moderator, or guide account
  - Sidebar visibility by live role after login
- Follow-up fixes made during verification:
  - Replaced invalid Tailwind v4 component `@apply card` usage with explicit utility composition

---

## Milestone 2: Dashboard

- Date: 2026-06-11
- Status: Verified
- Commands run:
  - `npm run check`
  - `npm run build`
  - `vite dev --host 127.0.0.1 --port 4174 --strictPort`
- Routes checked:
  - `/`
- Roles checked:
  - Live `admin` dashboard session
  - Role-aware query shaping in server load for `admin`, `moderator`, and `guide`
- What passed:
  - Dashboard server loader implemented against real Supabase tables and repaired column names
  - Dashboard UI implemented with live stat cards, recent activity, upcoming sessions, needs-attention panel, and bookings Realtime subscription
  - Type checks passed with no errors or warnings
  - Production build succeeded
  - Live admin dashboard rendered in the browser with real counts, including `Total Members: 7`
  - Recent activity rendered with onboarding events and member links
  - Upcoming panel rendered safely in its empty state
  - Needs-attention panel rendered live pending-review items
  - Realtime badge showed `connected` in the authenticated dashboard session
- What could not be verified:
  - Live `moderator` and `guide` dashboard sessions still need role-specific smoke testing in later milestones
- Follow-up fixes made during verification:
  - Cleaned pasted mojibake from dashboard strings
  - Adjusted the dashboard copy to avoid invalid Svelte markup
  - Restarted the local dev server on `http://127.0.0.1:4174` to verify the authenticated dashboard against live Supabase data

## Milestone 3: Guides

- Date: 2026-06-11
- Status: Verified
- Commands run:
  - `npm run check`
  - `npm run build`
  - live browser verification against `http://127.0.0.1:4173`
- Routes checked:
  - `/guides`
  - `/team`
- Roles checked:
  - Live `admin` guides session
  - Server-side guard logic for admin-only invite/create and admin-only delete
- What passed:
  - Guides page now loads from real `guide_profiles` and `available_slots` data
  - Search, status filter, pagination wiring, empty state, and summary cards render in the live admin session
  - Team invite surface now renders in the live admin session with the seeded admin account, including staff counts and pending-invite state
  - Add/edit slide-over UI is implemented with enhanced form actions
  - Guide edits are wired for staff, and deletes are wired for admins with pending-invite cleanup behavior
  - Team invites and guide invites are now patched locally to return copyable invite links instead of depending on SMTP delivery
  - `ADMIN_APP_URL` was added to the live Supabase project, unblocking real guide invite generation
  - Live guide invite creation succeeded for a disposable verification guide, and the app returned a working Supabase invite link
  - The pending-invite guide now renders as `Pending setup` in `/guides`, and the summary `Pending Setup` card increments correctly from live data
  - `/team` shows the same disposable guide under `Pending Invites`, proving the invite-first flow is visible across both admin surfaces
  - Live guide edit verification succeeded by updating the disposable guide name/title and confirming inactive-only filtering with the edited row
  - The deployed edge function now finalizes invited staff roles correctly, and a disposable guide account was promoted from `member` to `guide` through the live finalize path
  - Type checks passed with no errors or warnings
  - Production build succeeded
- What could not be verified:
  - A second live delete click was not re-driven in the browser after the invite-state patch because the browser control channel became unstable around the confirm dialog; the patch in this run only changed loader/account-state logic, while the delete path had already been live-tested earlier on 2026-06-11 against the same deployed invite-first implementation
- Follow-up fixes made during verification:
  - Moved guide action permission checks off `locals.role` and onto a direct `get_my_role()` lookup so actions work in real requests
  - Centralized server-side role resolution in a shared helper so page loads do not depend on `+layout.server.ts` mutating `locals.role`; this fixed the admin `/team` route bouncing back to `/`
  - Switched new guide creation to the invite-first flow after live database testing showed `guide_profiles.id` cannot be inserted as a free-floating row
  - Added invite-aware delete cleanup so pending guide invites can be revoked from the Guides page
  - Replaced the local edge-function implementation with Supabase `generateLink({ type: 'invite' })` so invite delivery no longer depends on SMTP
  - Added `scripts/deploy-admin-invite-function.ps1` and README deployment instructions so the remote function can be pushed with a single command once a Supabase access token is available
  - Added `SUPABASE_DEPLOY.md` plus `artifacts/admin-invite-staff-dashboard-upload.zip` so the same function can also be deployed from the Supabase Dashboard without CLI auth
  - Loader account-state logic now cross-checks pending guide invites so a pre-created auth user from Supabase invite generation does not show up incorrectly as `Linked account`
  - Extended the deployed edge function to stamp pending staff-role metadata and finalize invited guide/moderator roles during invite acceptance and later login, which fixed real guide accounts getting stuck as `member`
  - Added a direct guide-role route guard so guide sessions are redirected away from `/guides`

## Milestone 4: Slots

- Date: 2026-06-11
- Status: Verified
- Commands run:
  - `npm run check`
  - `npm run build`
  - live browser verification against `http://127.0.0.1:4173`
  - disposable guide-role HTTP verification using a real Supabase email/password session
- Routes checked:
  - `/slots`
  - `/guides` as a negative guide-role route check
- Roles checked:
  - Live `admin` slots session
  - Live disposable `guide` session after invite finalization
- What passed:
  - Slots page was replaced with a real server-backed weekly calendar and list view using `available_slots.slot_date`, `slot_time`, `starts_at`, and `status`
  - Week navigation rendered the expected Jun 8 - 12, 2026 range with working previous/next links
  - Guide filter worked in live admin verification, including an empty filtered view for the disposable guide profile
  - The publish modal created three real open Richie slots on Friday, June 12, 2026, and the weekly summary cards updated immediately
  - List view rendered the published rows correctly with duration, guide label, and open-state badges
  - Staff-only slot actions were verified live: one slot was cancelled, the cancelled summary count incremented, and the badge rendered with the red error styling
  - Disposable verification slots were removed from the live project again through the new list-view remove action, returning the weekly view to a clean empty state
  - Guide-role scoping was verified with a real guide session: `/slots` rendered without a publish button, without the guide filter control, and stayed empty even when a staff guide id was forced into the query string
  - Guide sessions are now redirected away from `/guides`, preserving the admin/moderator-only guide-management boundary
  - Type checks passed with no errors or warnings
  - Production build succeeded
- What could not be verified:
  - The live project did not have booked or completed slot rows available during this milestone pass, so those two status tones were confirmed from the implemented mapping while open and cancelled were verified live
- Follow-up fixes made during verification:
  - Added staff list-view actions for cancelling, reopening, and removing open or cancelled slots so slot management and cleanup can happen inside the milestone surface
  - Fixed invited staff finalization in the remote edge function and browser flows so real guide-role smoke tests could be completed without manual database intervention

## Milestone 5: Bookings

- Date: 2026-06-11
- Status: Verified
- Commands run:
  - `npm run check`
  - `npm run build`
  - `node --check scripts/milestone5-bookings.mjs`
  - `node scripts/milestone5-bookings.mjs`
  - `node scripts/milestone5-bookings.mjs cleanup --tag=milestone5-1781205260760`
  - disposable guide-role HTTP verification using a real Supabase email/password session
- Routes checked:
  - `/bookings`
  - `/bookings?tab=pending_pay&status=confirmed&payment=pending&range=next_30_days&page=1`
  - `/bookings?booking=b825393b-2ed1-4680-8d78-1864271ea0c3`
  - `/bookings?booking=0164e86c-97d4-44d2-9d15-351ce519356c`
  - `/bookings` as a logged-out redirect check
- Roles checked:
  - Live `admin` bookings session
  - Live disposable `guide` session against `/bookings`
  - Logged-out protected-route behavior
- What passed:
  - Bookings server load and page UI are implemented against live `bookings`, `available_slots`, `profiles`, and `guide_profiles` data
  - Type checks passed with no errors or warnings
  - Production build succeeded
  - Logged-out `/bookings` still redirects away from the protected shell
  - Live admin Bookings page rendered successfully in the app shell on `http://127.0.0.1:4174`
  - Query-param filter state rendered correctly for the `pending_pay`, `confirmed`, `pending`, and `next_30_days` combination
  - Live seeded bookings rendered in the table with correct counts, payment badges, status badges, and detail-panel data
  - The `Mark Complete` action succeeded against a live pending booking, reduced `Active Sessions` from `2` to `1`, changed the booking status to `completed`, and updated the linked slot status to `completed`
  - The `Cancel Booking` action succeeded against a live paid booking, reduced `Active Sessions` from `1` to `0`, changed the booking status to `cancelled`, persisted the cancellation reason, and updated the linked slot status to `cancelled`
  - Direct service-role readback confirmed the final live booking states (`completed`, `cancelled`) and the final linked slot states (`completed`, `cancelled`)
  - A guide-owned verification booking confirmed guide scoping: the assigned guide could load their booking detail, saw `Mark Complete`, saw the guide-only note, and did not receive the guide filter control or the `Cancel Booking` action
  - `scripts/milestone5-bookings.mjs` now provides repeatable seed and cleanup for future booking verification passes and successfully cleaned all three temporary bookings plus their slots after verification
- What could not be verified:
  - Live `moderator`-session browser verification was not re-driven separately because the admin actions and shared staff route behavior were already proven end to end with real data in this pass
- Follow-up fixes made during verification:
  - Re-exported `BookingStatus` and `PaymentStatus` from `$lib/types` so the Bookings route uses the same shared schema types as the rest of the app
  - Cleaned the Bookings pagination copy and removed the stale mojibake character
  - Added a dedicated Milestone 5 seed/cleanup script so live booking verification does not depend on fragile dashboard SQL automation
  - Updated the seed helper to read `.env.local`, normalize quoted secrets, and match the repaired `bookings` schema by including `slot_date`, `slot_time`, and `duration_minutes`

## Milestone 6: Members

- Date: 2026-06-11
- Status: Verified
- Commands run:
  - `npm run check`
  - `npm run build`
  - `node --check scripts/milestone6-members.mjs`
  - `node scripts/milestone6-members.mjs seed --guide-email=codex-guide-1781186073204@example.com`
  - `node scripts/milestone6-members.mjs cleanup --tag=milestone6-1781232864986`
  - disposable guide-role HTTP verification using a real Supabase email/password session
- Routes checked:
  - `/members`
  - `/members/e85b6771-4b99-4139-85f5-5cf0d97e1e6e`
  - `/members/0d39c231-de2e-4925-980c-d9b7a13e4c1a` as a negative guide-scope check
- Roles checked:
  - Live `admin` members session
  - Live disposable `guide` session against `/members` and `/members/[id]`
- What passed:
  - Members directory and member detail routes were implemented against live `profiles`, `bookings`, `guide_profiles`, `onboarding_responses`, and `preferences` data
  - Type checks passed with no errors or warnings
  - Production build succeeded
  - Live admin `/members` rendered successfully with real member counts, search, filters, onboarding summary cards, and deep links into member detail
  - The seeded verification member rendered live in the directory with the linked guide label and booking summary
  - Live admin member detail rendered the seeded onboarding responses and preferences fields from Supabase without column mismatches
  - The `Suspend member access` action succeeded live, showed the suspended badge and success message, then `Restore member access` succeeded and returned the member to normal state
  - The `Promote to moderator` action succeeded live, updated the role badge to `moderator`, removed member-only actions on reload, and dropped the promoted account from the members directory
  - Guide-role scoping passed through direct authenticated route checks: the guide saw the seeded member in `/members`, could open that member detail, did not receive suspend or promote actions, and received a `404` for an unrelated member detail route
  - `scripts/milestone6-members.mjs` successfully cleaned the disposable booking, slot, onboarding, preferences, profile, and auth user after verification
- What could not be verified:
  - A live `moderator` browser session was not re-driven separately because the admin-only promote flow and the shared staff member-detail behavior were already proven end to end in this pass
- Follow-up fixes made during verification:
  - Added a server-side service-role helper for staff profile mutations after live RLS recursion blocked member suspend actions through the session-scoped client
  - Tightened the member-detail action visibility so suspend and promote controls disappear once a profile is no longer a `member`

## Milestone 7: Team Management

- Date: 2026-06-12
- Status: Verified
- Commands run:
  - `npm run check`
  - `npm run build`
  - live in-app browser verification against `http://127.0.0.1:4174/team`
  - authenticated app-route verification using real Supabase email/password sessions and SSR auth cookies
- Routes checked:
  - `/team`
- Roles checked:
  - Live `admin` Team Management session
  - Authenticated disposable `admin` route check against `/team`
  - Authenticated disposable `guide` route check against `/team`
- What passed:
  - Team Management was moved onto local SvelteKit server load/actions backed by the service-role helper, so the page now runs without requiring another edge-function deploy
  - Type checks passed with no errors or warnings
  - Production build succeeded
  - Live admin `/team` rendered successfully with real admins, guides, pending invites, and the permissions overview panel
  - Guide account state rendered correctly from live data, including `Linked account` for the completed guide and `Pending setup` for the invite-aware guide row
  - Live admin promotion of existing member `rmish@gmail.com` succeeded from the Team modal and moved the member into the Moderators section
  - A new moderator invite was created successfully for a disposable email and appeared under Pending Invites from live Supabase data
  - Authenticated app-route verification confirmed `/team` returns `200` for an admin session and redirects a guide session with `303` to `/`
  - Authenticated app-route verification confirmed the `removeModerator` action demotes a moderator back to `member`
  - Disposable verification invite and disposable verification admin were cleaned up after the milestone pass
- What could not be verified:
  - The in-app browser control channel became unstable around the native `confirm()` dialog on the Remove button, so the final removal click was verified through a real authenticated app POST instead of a second browser click
- Follow-up fixes made during verification:
  - Replaced the old client-only Team implementation with a server-backed loader/actions route using the local service-role client
  - Added invite refresh, invite revoke, moderator removal, and invite-aware guide status shaping directly in `src/routes/team/+page.server.ts`
  - Rebuilt `src/routes/team/+page.svelte` around enhanced forms, admin-only team sections, pending invite management, and the permissions overview surface

## Milestone 8: Notifications

- Date: 2026-06-12
- Status: Verified
- Commands run:
  - `npm run check`
  - `npm run build`
  - live in-app browser verification against `http://127.0.0.1:4174/bookings`
  - disposable booking inserts and cleanup using the local `SUPABASE_SERVICE_ROLE_KEY`
- Routes checked:
  - `/bookings`
  - `/api/notifications`
- Roles checked:
  - Live `admin` shell session with notification bell and panel
- What passed:
  - Layout-level notification wiring now exists in the shared shell, including the bell button, unread count badge, slide-over panel, mark-all-read action, and deep links into the relevant route
  - Type checks passed with no errors or warnings
  - Production build succeeded
  - The notification panel rendered live from the shell and showed the empty state cleanly before any new events
  - After a fresh post-reload booking insert, the bell count incremented to `1` in the live browser
  - The panel rendered the new booking notification with member and guide labels
  - Clicking the live notification navigated to `/bookings?booking=f6f57523-9107-4e9a-bfbb-155db895a562` and opened the correct booking detail panel
  - Disposable verification bookings and slots were removed again after the milestone pass
- What could not be verified:
  - The live Supabase `postgres_changes` bookings insert channel subscribed successfully but did not emit new booking events into the browser during this milestone pass, so the user-facing verification relied on the authenticated fallback feed while keeping the realtime subscriptions in place
- Follow-up fixes made during verification:
  - Added `src/lib/stores/notifications.ts` for the in-memory notification store and unread state
  - Added `src/lib/components/NotificationPanel.svelte` and connected it to the shell bell in `src/lib/components/AppShell.svelte`
  - Added the staff-only `src/routes/api/notifications/+server.ts` fallback feed so new bookings still surface in the panel when the live project does not deliver bookings insert events over the Realtime channel

## Milestone 9: Responsive Layout

- Date: 2026-06-12
- Status: Verified
- Commands run:
  - `npm run check`
  - `npm run build`
  - live in-app browser verification against `http://127.0.0.1:4174`
- Routes checked:
  - `/`
  - `/bookings`
  - `/guides`
  - `/slots?view=calendar&week=2026-06-08`
  - `/members`
  - `/team`
- Roles checked:
  - Live `admin` shell session across desktop, tablet, and mobile breakpoints
- What passed:
  - Type checks passed with no errors or warnings
  - Production build succeeded
  - Desktop dashboard layout remained stable with the full sidebar, search bar, and header profile summary
  - Tablet verification at `900x900` confirmed the icon-only sidebar state while keeping the shell usable and the page content stable
  - Mobile verification at `390x844` confirmed the reduced top bar, bottom navigation, and Home-only `Manage Team` shortcut card
  - `/bookings`, `/guides`, `/members`, and `/team` all rendered without horizontal overflow on mobile after card-stack adjustments
  - `/bookings` and `/guides` now swap to mobile card layouts instead of depending on desktop tables
  - `/slots` now keeps the mobile publish panel full width and swaps calendar/list data into mobile-friendly agenda cards when slot rows exist
  - Text cleanup removed the visible mojibake separators and symbol artifacts from Members and Team
- What could not be verified:
  - The mobile calendar fallback note on `/slots` could not be rendered in this pass because the live week under test had no slot rows; the mobile agenda path and lack of horizontal overflow were still verified against the route shell and list data rendering logic
- Follow-up fixes made during verification:
  - Converted the shell sidebar to an icon-only tablet state while keeping labels on large screens
  - Hid mobile-only header clutter by removing the search field and role badge from the smallest breakpoint and showing the avatar-only state instead
  - Added mobile card stacks for Bookings and Guides and mobile-safe card sizing for Members and Team
  - Added a mobile agenda presentation for Slots and widened mobile slide-over panels to use the full screen width
  - Fixed mobile overflow in Team and Members by forcing long emails and staff labels to wrap safely

## Milestone 10: Final Review

- Date: 2026-06-12
- Status: Verified
- Commands run:
  - `npm run check`
  - `npm run build`
  - `node --check scripts/final-review.mjs`
  - `node scripts/final-review.mjs run`
- Routes checked:
  - Admin: `/`, `/guides`, `/slots`, `/bookings?booking=...`, `/members/[id]`, `/team`
  - Guide: `/`, `/slots`, `/bookings?booking=...`, `/members`, `/members/[id]`
  - Negative checks: `/guides`, `/team`, and an unrelated `/members/[id]` under a guide session
- Roles checked:
  - Disposable `admin`
  - Disposable `guide`
- What passed:
  - Type checks passed with no errors or warnings
  - Production build succeeded
  - The final-review helper seeded disposable admin, guide, member, slots, and bookings against live Supabase data without schema mismatches
  - Admin walkthrough passed for dashboard, guides, slots, bookings detail, member detail, and team management routes
  - Guide walkthrough passed for dashboard, slots, bookings detail, members list, and guide-scoped member detail routes
  - Guide negative access checks passed: `/guides` and `/team` redirected to `/`, and an unrelated member detail returned `404`
  - CRUD checks passed: guide `Mark Complete`, admin `Cancel Booking`, and admin member suspend/restore all succeeded and persisted the expected booking, slot, and profile state
  - Direct readback confirmed the completed booking and slot, the cancelled booking and slot, the stored cancel reason, and the final restored member state
  - Guide-scoped anon verification only returned the seeded guide-owned bookings, giving a final sanity check on scoped data visibility
  - Disposable verification bookings, slots, profiles, supporting rows, invites, and auth users were cleaned up again after the run
- What could not be verified:
  - Live booking insert notifications over the native Realtime channel still depend on the Milestone 8 fallback feed in this project environment, but that does not block the final admin or guide walkthroughs
- Follow-up fixes made during verification:
  - Added `scripts/final-review.mjs` as a repeatable end-to-end verification and cleanup harness
  - Rewrote `src/routes/members/[id]/+page.svelte` in clean ASCII to remove the last visible mojibake artifacts before final handoff
