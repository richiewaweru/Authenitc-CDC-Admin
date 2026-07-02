# Decisions Log

## 2026-06-08

### Tailwind setup
- Decision: Keep the scaffold on Tailwind CSS v4 and define the Authentic design tokens in `src/app.css` with theme variables and component classes.
- Why: The Svelte scaffold now defaults to Tailwind v4, and the admin shell only needs a small, centralized token layer for Milestone 1.
- Docs said: The handoff allowed Tailwind v4 or v3 if needed and mentioned a `tailwind.config.js` shape from an older scaffold.

### Node runtime workaround
- Decision: Install dependencies with the bundled Codex Node `24.14.0` runtime instead of the machine default Node `23.5.0`.
- Why: The current Svelte/Vite plugin rejects Node 23 via engine constraints, while the bundled Node 24 satisfies the supported range.
- Docs said: Use the latest stable SvelteKit stack, but did not specify a machine-level Node version.

### Auth flow shape
- Decision: Use a root `hooks.server.ts` plus root `+layout.server.ts` guard, with `/login` and `/access-denied` as the only public routes.
- Why: This keeps session refresh, role checks, and redirect behavior centralized while matching the milestone requirement for a layout-level auth gate.
- Docs said: `+layout.server.ts` should enforce session and role access before rendering the shell.

### Milestone tracking workflow
- Decision: Track milestone status in `MILESTONES.md` and verification evidence in `VERIFICATION.md`, with milestone advancement gated by explicit checks.
- Why: The project handoff is milestone-driven, and we need a visible, repeatable process so partially built work does not get mistaken for completed work.
- Docs said: Build one milestone at a time, verify it, then proceed to the next.

### Dashboard activity source
- Decision: Use `onboarding_responses.updated_at` as the completion timestamp for dashboard onboarding activity, then hydrate member names from `profiles`.
- Why: The nearby consumer app confirms `profiles.onboarding_complete` and `profiles.user_state`, but it does not establish a reliable profile completion timestamp. `onboarding_responses.updated_at` is a stronger event timestamp for recent activity ordering.
- Docs said: Show recent onboarding completions and use real Supabase data, but did not define which timestamp column should anchor the activity feed.

## 2026-06-11

### Guide creation flow
- Decision: Treat new guide creation as invite-first, admin-only work, while keeping existing guide profile edits available to admins and moderators.
- Why: Live verification showed this Supabase project enforces a foreign-key relationship on `guide_profiles.id`, so a free-floating guide row cannot be inserted safely before an auth user exists. Creating guides through the invite flow matches the user's preferred onboarding model and the real database behavior more closely than profile-only creation.
- Docs said: The milestone called for invite-aware guide management, and the user explicitly wanted guides to receive a link, set a password, and then use email/password login.

### Linked guide deletion
- Decision: When an admin deletes a linked guide profile, also demote the linked profile role back to `member` and clear any pending guide invite rows for unlinked email-only records.
- Why: Without that cleanup, a deleted guide could still retain guide access and sign into an orphaned shell with no guide profile attached.
- Docs said: Only admins should delete guides, but the handoff did not define what should happen to a linked staff role after the guide profile is removed.

### Invite delivery method
- Decision: Switch staff onboarding from `inviteUserByEmail()` to Supabase `generateLink({ type: 'invite' })`, then show the secure link directly inside the admin UI for manual delivery.
- Why: The user wanted a link-based setup flow, and live verification showed SMTP-backed invite delivery was the unstable piece blocking Milestone 3. Generated invite links keep the same auth model without relying on the email provider being configured correctly.
- Docs said: Invites should let guides and moderators open a link, set their password, and then log in with email/password.

### Server-side role resolution
- Decision: Resolve the current app role through a shared server helper in each server load/action that needs it instead of relying on `+layout.server.ts` to mutate `locals.role` first.
- Why: Live browser verification exposed that page server loads can run without seeing the role cached by the layout load, which caused the admin-only `/team` route to redirect to `/` incorrectly for a valid admin session.
- Docs said: Role checks should be centralized and consistent across route guards and UI visibility.

### Invite status source of truth
- Decision: Treat a pending `invites` row for a guide email as the source of truth for `pending_setup`, even when `guide_profiles.user_id` is already populated.
- Why: Supabase `generateLink({ type: 'invite' })` creates the auth user before the invited guide finishes password setup, so raw `user_id` presence alone incorrectly labels a still-pending invite as a linked account.
- Docs said: Invite-aware guide flows should reflect whether a staff member has actually completed setup, not just whether the auth record exists.

### Local invite callback secret
- Decision: Set the Supabase Edge Function secret `ADMIN_APP_URL` to the active local admin URL used for verification.
- Why: The `admin-invite-staff` function needs a concrete redirect target for invite links, and the live project was failing new guide creation until `ADMIN_APP_URL=http://127.0.0.1:4173` was added in Supabase.
- Docs said: Invite links should return staff to the admin app callback flow so they can finish password setup and sign in with email/password.

### Slot week scoping
- Decision: Build the Slots page around `slot_date` for week boundaries and calendar bucketing, while still carrying `starts_at` through for downstream detail use.
- Why: The repaired schema explicitly preserves both `slot_date` and `slot_time` alongside `starts_at`, and using the date-only fields avoids timezone drift when staff are scanning or publishing a Monday-Friday weekly grid.
- Docs said: The slots milestone should use the repaired `available_slots` columns and show a calendar-first weekly view.

### Slot publish duplicate handling
- Decision: Treat `(guide_id, slot_date, slot_time)` as the duplicate key in app logic and skip existing rows during bulk publish instead of trying to mutate or overwrite them.
- Why: The schema source of truth does not define an app-managed uniqueness constraint here, and skipping duplicates keeps bulk publishing safe without surprising edits to existing booked or completed slots.
- Docs said: The publish flow should bulk insert new `available_slots`, but it did not specify how duplicate slot requests should be resolved.

### Staff invite finalization
- Decision: Stamp a `pending_staff_role` into auth `app_metadata` during invite generation, then finalize the actual `profiles.role` through the edge function during invite acceptance and ordinary login.
- Why: Live verification showed Supabase invite acceptance was linking `guide_profiles.user_id` correctly but leaving `profiles.role='member'`, which sent invited guides to access denied even after setting a password.
- Docs said: Invited guides and moderators should complete setup from a secure link, then immediately use email/password as staff accounts.

### Guide management route guard
- Decision: Redirect authenticated guides away from `/guides` even if they manually enter the URL.
- Why: The sidebar already hid guide-management routes from guides, but live guide-role verification showed the page loader itself still rendered for guide sessions until the explicit guard was added.
- Docs said: Guide management is for admins and moderators, while guides should stay scoped to their own slots, bookings, and members.

### Milestone 5 verification seed script
- Decision: Add a service-role-backed `scripts/milestone5-bookings.mjs` helper for repeatable Bookings milestone seed and cleanup.
- Why: The live project currently has no booking rows to exercise the detail panel and status actions, and the Supabase dashboard SQL path proved unreliable under in-app automation. A small seed/cleanup script keeps the remaining Milestone 5 verification deterministic once a local `SUPABASE_SERVICE_ROLE_KEY` is available.
- Docs said: High-risk milestones should be verified against live Supabase data before we advance.

### Local env precedence for verification helpers
- Decision: Make the Milestone 5 seed helper merge `.env` and `.env.local`, with `.env.local` taking precedence and quoted values normalized.
- Why: The local service-role key was stored in `.env.local`, and the raw quoted value would otherwise be passed to Supabase as an invalid API key.
- Docs said: Verification helpers should work against the actual local project conventions instead of assuming a single env file.

### Bookings schema alignment
- Decision: Extend the shared `bookings` database typing and the verification seed payloads to include `slot_date`, `slot_time`, and `duration_minutes`.
- Why: Live service-role inserts showed the repaired database still requires those booking columns even though the older local type file had not modeled them yet.
- Docs said: `supabase-repair.sql` is the schema source of truth when there is any mismatch with older app assumptions.

### Staff profile mutations
- Decision: Route member suspend and promote actions through a server-side service-role Supabase client after verifying the caller's app role.
- Why: Live Milestone 6 verification showed the current `profiles` RLS update path can recurse on itself for staff-driven profile mutations, which broke suspend even though the page and permissions were correct. Narrow server-side admin writes keep the UI working without asking the app to rewrite database policy.
- Docs said: `supabase-repair.sql` is the schema source of truth and app code should adapt to the repaired project rather than trying to patch schema behavior at runtime.

### Milestone 6 verification seed script
- Decision: Add `scripts/milestone6-members.mjs` for disposable member creation, guide-linked booking setup, and cleanup.
- Why: The live project did not have a safe existing record that covered all four Milestone 6 checks at once. A repeatable seed made it possible to verify onboarding panels, guide scoping, suspend/restore, promotion, and final cleanup without touching real member accounts.
- Docs said: High-risk milestone checks should be performed against live Supabase data before advancing.

### Team management execution path
- Decision: Move Team Management onto local SvelteKit server loads and form actions backed by the service-role helper instead of depending on a separately deployed edge function for day-to-day admin actions.
- Why: Milestone 7 needed to be testable immediately in the local app, and the invite, revoke, promote, and remove flows all map cleanly onto the repaired schema without another database or function change. Keeping the route local also lets the UI, route guard, and invite-aware guide state evolve together.
- Docs said: The app should adapt to the repaired schema in place, avoid app-driven schema mutations, and advance milestone by milestone with live verification before moving on.

### Notification delivery fallback
- Decision: Keep layout-level Supabase Realtime subscriptions in the shell, but add a staff-only `/api/notifications` polling fallback for new bookings and onboarding-ready profiles.
- Why: During live Milestone 8 verification on 2026-06-12, the shell channel reached `SUBSCRIBED` but the project still did not emit booking insert events into the browser. The fallback preserves the intended bell and panel experience in the current environment without removing the realtime path.
- Docs said: Milestone 8 called for layout-level realtime subscriptions, an in-memory notification store, and live bell/panel behavior before advancing.

### Responsive shell breakpoint policy
- Decision: Use three shell states: full sidebar on desktop, icon-only sidebar on tablet, and bottom navigation plus minimal top bar on mobile.
- Why: Live Milestone 9 verification showed the desktop shell already carried the needed density, while tablet needed more content space and mobile needed the top bar simplified to bell plus avatar to keep the layout usable.
- Docs said: Milestone 9 required desktop, tablet, and mobile polish without changing the established admin visual language.

### Mobile data-surface fallback
- Decision: Replace table-first mobile layouts with stacked cards and agenda views for core admin surfaces instead of relying on horizontal scroll.
- Why: Live verification on `390x844` showed Team and Members would still overflow unless long labels wrapped and dense tables were converted into card-based layouts that fit the narrow viewport.
- Docs said: Milestone 9 required mobile usability and no horizontal overflow on core routes.

### Final review verification harness
- Decision: Close Milestone 10 with a repeatable `scripts/final-review.mjs` harness that seeds disposable staff/member data, exercises authenticated app routes with real Supabase SSR cookies, verifies key cross-role actions, and then cleans everything up.
- Why: The final review needed concrete proof for both admin and guide walkthroughs without disturbing the existing browser session or relying on manual dashboard setup each time. A disposable harness makes the handoff evidence repeatable and keeps the live project clean after verification.
- Docs said: The last milestone should verify admin and guide smoke tests, CRUD behavior, and RLS sanity before the project is considered complete.

## 2026-06-27

### Consumer slot service verification scope
- Decision: Complete the admin-panel slot ownership changes in this workspace and record the consumer-app verification as blocked by missing source files here, instead of inventing or patching a consumer service path that does not exist locally.
- Why: The goal spec references `src/services/slotService.ts` for the consumer app, but this repository only contains the admin app and no matching consumer service or `ChooseSlot` implementation to inspect.
- Docs said: Verify `fetchGuidesFromSupabase()` and `fetchSlotsFromSupabase()` in the consumer app and remove any role filter if present.

### Resend template payload deployment
- Decision: Deploy the Resend payload-shape fix for `send-member-email`, `send-booking-confirmation`, and `send-meeting-reminder` on 2026-06-27 so transactional email delivery should work for sends after this deployment timestamp.
- Why: Resend rejected the old top-level `template_id` and `variables` payload with `422 Missing html or text field`; nesting them under `template` matches the API shape these functions already intend to use.
- Docs said: Keep the helper signatures and callers unchanged, patch only the request body shape, and record the deployment date so delivery behavior is easy to compare before and after the fix.

## 2026-07-02

### Admin meeting-link action location
- Decision: Add the booking-level `updateMeetingLink` action to `src/routes/bookings/+page.server.ts` while moving Slots page forms to a new slot-level `updateSlotMeetingLink` action.
- Why: The Phase 3 brief described an existing booking drawer action, but inspection showed `updateMeetingLink` only existed on the Slots route and wrote directly to `bookings`.
- Docs said: The slot should be canonical, and the booking drawer should remain an editable per-booking override.

### Available slot meeting-link typing
- Decision: Extend local generated database types with `available_slots.meeting_link`.
- Why: The applied migration added the column, but the checked-in type file only modeled `bookings.meeting_link`, which would otherwise reject slot inserts and updates at compile time.
- Docs said: `phase3_slot_meeting_link.sql` has already been run, so app code should target the repaired schema.
