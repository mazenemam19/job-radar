# AGENTS.md — Job Radar

## Project Notes

- Next.js 14 + Supabase ATS aggregator
- Multi-tenant: shared raw_jobs → per-user pipeline (date filter → settings → Gemini → score)
- Cron scrapes ATS APIs → raw_jobs table → users see personalized results on dashboard
- Two pipelines: "local" (Egypt) and "global" (worldwide remote). "visa" was collapsed to "global".

## Code Quality Rules

- **NEVER use `any` (or `as any`)** anywhere in the codebase. All typings must be strict. Use `unknown` and type guards.
- Comments describe **current behavior**, not history. No "FIX #", "Bug N", "Feature Request N", or "Tier N" labels.
- No self-referential comment tags like "I1:", "I2:" etc — describe what the test/code does.

## Git Rules

- **NEVER push without explicit user confirmation**
- Always run `pnpm run test`, `pnpm run lint`, and `pnpm run build` before committing
- Use worktree for parallel work: `git worktree add -b <branch> ../<dir> main`
- Run `pnpm install` in each worktree before building/testing

## Testing

- Unit tests: `src/lib/__tests__/*.test.ts` — mock Supabase, test route handlers directly via HTTP Request objects
- Run: `pnpm test`
- Mock pattern: helper returns a thenable chain; `await` resolves to `{ data, error }`

## Windows Quirks

- `/usr/bin/sh` is a broken Windows stub — use `bash` in husky hooks
- `~` resolves to `C:\Users\<user>` (not AppData\Local\hermes)

## Solved Problems

- `docs/solutions/<category>/` — root-cause writeups for non-trivial bugs and
  integrations (bugs/, integrations/, architecture/, performance/, tooling/).
  Check here before re-investigating something that smells like it's happened
  before.

## Data Flow

- cron → fetchCompany() → processJobs() → raw_jobs (global table)
- user opens dashboard → passesDateGate → passesSettingsGate → passesGlobalModeGate → filterJobsWithGemini → scoreJob → user_jobs_cache
- Email sent from cron after scrape (generic "scan complete", no job listings)

## Security

- Salary route: sanitize user input before ilike (strip % and \_)
- Workable detail fetch: 30s timeout
- DELETE company: clean up raw_jobs first

## Login / Auth

### Current State

- App has **only Google OAuth** login (`signInWithOAuth`) — no email/password, no OTP
- Login page (`src/app/login/page.tsx`) — single "Continue with Google" button
- Auth callback (`src/app/auth/callback/route.ts`) — exchanges code, upserts user_profiles, redirects to /onboarding or /dashboard
- Middleware (`src/middleware.ts`) — protects /dashboard, /admin, /pipeline, /salary, /settings, /tracker, /onboarding. Unauthenticated users are redirected to /login.
- `ONBOARDING_EXEMPT` set: `["/onboarding", "/login"]`

### How to Test Auth (working)

1. Ensure `.env.local` has `E2E_TEST_SECRET` and `TEST_USER_EMAIL`
2. Start dev server: `node_modules/.bin/next dev -p 3000`
3. Create a test HTML page in `public/` that POSTs to `/api/test/e2e-login` with `x-e2e-secret` header, then redirects to `/dashboard`
4. Navigate browser to the test page and click the button
5. Verify: dashboard loads with user email + "Sign out" button visible
6. **Important:** `browser_console` returns `null` for async operations — use test HTML pages or check `document.cookie` synchronously after an await
7. The route uses `generateLink({ type: "magiclink" })` + `verifyOtp({ type: "magiclink", token_hash })` — cookies are set automatically via `createServerClient()`'s `setAll` mechanism

### Lesson Learned — Why Previous Attempts Failed

The code was NEVER broken. The e2e-login route at `src/app/api/test/e2e-login/route.ts` was always correct. Every failure was environmental:

1. **Wrong E2E_TEST_SECRET** — A truncated secret was hardcoded in the test HTML. The real secret is 64 chars. The route returned `{ error: "not found" }` on every request.
2. **Missing .env.local** — The worktree had no `.env.local`, so `E2E_TEST_SECRET` was undefined → route 404s.
3. **No node_modules** — `pnpm install` hadn't been run in the worktree.
4. **Wrong Next.js version** — `npx next dev` downloaded Next.js 16 (Turbopack), incompatible with the project. Must use `node_modules/.bin/next` (v14.2.35).
5. **Never verified cookie landed** — Test HTML used `window.location.href = '/dashboard'` immediately after fetch without checking `document.cookie` first.

**The rule for future work:**

- Before modifying ANY code, verify: `.env.local` exists, `node_modules` installed, dev server running with `node_modules/.bin/next`
- Before claiming something doesn't work, test with `curl` first (eliminates browser issues)
- If a route returns `{ ok: true }` but browser doesn't stay authenticated, check `document.cookie` before navigating
- Don't rewrite working code unless you've identified the specific root cause
- **The e2e-login route works as-is. Do not modify it.**

### Key Constraints

- Cannot use Google OAuth in automated testing (bot detection, real credentials needed)
- Supabase `signInWithPassword` does NOT set cookies in route handlers (SSR `setAll` fails silently)
- `E2E_TEST_SECRET` must match exactly between server env and client request

### Open Questions / TODO

## User Skills — DO NOT EDIT

- User skills are installed in the agent's skills directory
- If you need to save project notes, conventions, or reminders: put them in THIS FILE (AGENTS.md)
- **NEVER modify, patch, or rewrite user skills** — they are personal configuration
- If a skill is missing steps or has errors, tell the user — don't fix it for them
