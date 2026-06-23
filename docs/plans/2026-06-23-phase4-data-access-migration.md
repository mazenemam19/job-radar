# Phase 4 — Data-access client migration

Source: Job Radar Full Codebase Audit, Phase 4. RLS confirmed enabled with
working own-row policies on `user_jobs_cache`, `user_settings`,
`user_profiles`, `tracker_entries`, `salary_reports` (salary additionally has
a public-read policy for the aggregate-chart feature — `qual: true` on
`salary_select_all`).

## Decision: migrate vs. keep service-role

A route/table moves from `createAdminClient()` to `createServerClient()`
**only if every table it touches is user-owned and RLS-confirmed.** Global,
not-user-owned tables (`raw_jobs`, `app_config`, `default_settings`) keep the
service-role client regardless of which route calls them — that's not a
security gap, it's the documented purpose of `createAdminClient()`
("operations that need to see/write other users' data" / cron-shared state).
`ats_submissions` (no session at all — public endpoint) is excluded outright.

## Tasks

1. **`src/app/api/salary/route.ts`** — GET and POST → `createServerClient()`.
   Only table: `salary_reports`. GET relies on `salary_select_all` (public),
   so behavior (all reports, anonymized + aggregated, 2+ threshold) is
   unchanged. POST relies on `salary_insert_auth`; app always sets
   `user_id: user.id` from the session, so it satisfies an
   `auth.uid() = user_id` check if one exists. Residual unknown: exact
   `WITH CHECK` expression wasn't queried — flagged for a post-merge smoke
   test of a real submission, not a blocker.

2. **`src/app/api/strategy/route.ts`** — `createServerClient()`. Only table:
   `user_profiles` (own-row select). Clean.

3. **`src/app/api/tracker/route.ts`** — `createServerClient()`. Only table:
   `tracker_entries` (`tracker_all_own`, ALL). Clean.

4. **`src/app/api/tracker/[id]/route.ts`** — `createServerClient()`. Same
   table/policy as #3. The `.eq("user_id", user.id)` app-layer guard becomes
   a defense-in-depth duplicate of the RLS check rather than the only line
   of defense — kept as-is as comments explain.

5. **`src/app/api/jobs/[id]/route.ts`** — `createServerClient()`. Only table:
   `user_jobs_cache` (`cache_all_own`, ALL). Clean.

6. **`src/app/api/settings/route.ts`** — `createServerClient()`. Tables:
   `user_settings`, `user_profiles`, `user_jobs_cache` — all RLS-confirmed
   own-row. Clean.

7. **`src/lib/settings.ts`** — split, not a wholesale swap:
   - `getDefaultSettings()` → **unchanged**, stays on `createAdminClient()`
     (`default_settings` is a single shared config row, not user-owned).
   - `getUserSettingsRow()` → `createServerClient()`.
   - `saveUserSettings()` → `createServerClient()`.
     Both called only from route handlers (confirmed via grep — no cron
     caller), so `cookies()` is always in a valid request scope.

8. **`src/app/api/dashboard/route.ts`** — split, not a wholesale swap:
   - `user_profiles` (update `last_active_at`, select `gemini_api_key`) and
     `user_jobs_cache` (select cache/previousCache, upsert) →
     `createServerClient()`.
   - `raw_jobs` and `app_config` → **unchanged**, stay on
     `createAdminClient()` (global scraped-job pool and cron metadata, not
     user-owned, not in the RLS-confirmed table list).

9. **`src/app/api/submit/route.ts`** — **excluded from this phase.** It's an
   unauthenticated public endpoint by design (no `getUser()` call at all).
   There is no session, so `createServerClient()` would run as the `anon`
   role. If `ats_submissions`'s insert policy is scoped to `authenticated`
   (the naming `salary_insert_auth`-style convention elsewhere suggests this
   is likely the house style), switching this route breaks the public
   submission form outright. This was miscategorized in the original
   Phase 4 list — it's not a "per-user data via service role" problem, it's
   a legitimately anonymous write. The real follow-up for this route is
   already tracked separately (Phase 7: rate limiting).

10. **`src/lib/__tests__/settings.test.ts`** — update to mock both
    `createAdminClient` (for `default_settings`) and `createServerClient`
    (for `user_settings`) separately, and mock `next/headers` `cookies()`
    so `createServerClient()` doesn't throw outside a request context.

## Verification

No new behavior, so no new tests beyond the mock-target fix in task 10. Gate:
`tsc --noEmit` clean, `vitest run` green, `next build` clean. Each task
committed individually before moving to the next, per the audit's own
"don't batch this phase" instruction.
