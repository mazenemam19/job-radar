# Test Coverage Plan — API Routes & Lib Files

## Goal
Add test coverage for 16 uncovered API routes + 2 uncovered lib files (`api-errors.ts`, `constants.ts`).

## Existing patterns (from `src/lib/__tests__/`)
- Mock `next/headers` → `cookies: () => ({ getAll: () => [], set: () => {} })`
- Mock `../supabase/server` → `createServerClient: () => mockServerDb` + `getUser: vi.fn()`
- Mock `../supabase/admin` → `createAdminClient: () => mockAdminDb`
- `mockQuery(data, error)` helper → chainable `.select().eq().single()` etc.
- Import route handlers dynamically: `const { GET } = await import("../../app/api/...")`
- Auth: `getUser` mock returns `{ id, email }` or `null` for unauth tests

## Test file map

| # | File | Tests |
|---|------|-------|
| 1 | `src/lib/__tests__/api-errors.test.ts` | `dbErrorResponse`: logs context+message, returns 500 + generic message. `catchErrorResponse`: Error instance, non-Error (string), null/undefined |
| 2 | `src/lib/__tests__/constants.test.ts` | `VALID_ATS` contains all 9 types, `VALID_STATUSES` contains all 6, `COUNTRY_MAP` has EG→🇪🇬, `COUNTRY_FLAGS` has SA→🇸🇦 |
| 3 | `src/app/api/jobs/[id]/route.test.ts` | GET: 401 unauth, 404 not found, 200 returns job from cache |
| 4 | `src/app/api/settings/route.test.ts` | GET: 401, 200 returns resolved+raw+profile. PATCH: 401, 400 invalid JSON, 200 saves settings, strips role, handles gemini key |
| 5 | `src/app/api/tracker/route.test.ts` | GET: 401, 200 returns entries. POST: 401, 400 missing fields, 200 upserts, defaults status to "saved" |
| 6 | `src/app/api/tracker/[id]/route.test.ts` | PATCH: 401, 200 updates. DELETE: 401, 200 deletes |
| 7 | `src/app/api/submit/route.test.ts` | POST: 400 missing fields, 201 success, 429 rate limit, validates ATS type |
| 8 | `src/app/api/strategy/route.test.ts` | POST: 401, 200 returns strategy, handles Gemini failure gracefully |
| 9 | `src/app/api/salary/route.test.ts` | Already exists — extend with POST tests (401, 201 insert) |
| 10 | `src/app/api/cron/route.test.ts` | POST: 401 missing CRON_SECRET, 200 runs cron (mock fetchers) |
| 11 | `src/app/api/dashboard/route.test.ts` | GET: 401, 200 returns cached jobs, 200 rebuilds when stale |
| 12 | `src/app/api/admin/companies/route.test.ts` | GET: 403 non-admin, 200 returns companies. POST: 403, 400 missing fields, 201 creates |
| 13 | `src/app/api/admin/companies/[id]/route.test.ts` | PUT: 403, 200 updates. DELETE: 403, 200 deletes |
| 14 | `src/app/api/admin/users/route.test.ts` | GET: 403, 200 returns users. PATCH: 403, 200 updates role |
| 15 | `src/app/api/admin/submissions/route.test.ts` | GET: 403, 200 returns submissions. PATCH: 403, 200 updates status |
| 16 | `src/app/api/admin/defaults/route.test.ts` | PUT: 403, 200 updates defaults |
| 17 | `src/app/api/account/route.test.ts` | Already exists — verify coverage is complete |

## Sequencing
1. Lib tests first (no route dependencies): api-errors, constants
2. Simple routes next: jobs/[id], submit, tracker
3. Medium: settings, strategy, salary (extend), tracker/[id]
4. Complex: dashboard, cron
5. Admin routes (all follow same requireAdmin pattern)

## Validation gate (after each file)
`npx vitest run src/path/to/test.ts` → pass

## Final gate (after all)
`npx tsc --noEmit` · `npx eslint --fix` · `npx vitest run` (full) · `npx next build`
