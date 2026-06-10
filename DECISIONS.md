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
