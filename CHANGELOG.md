# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

### Fixes

- Workable fetcher: the single fully-serial request queue introduced to fix the
  July 2 429 recurrence scaled wall-clock time linearly with total request count,
  turning a ~150s cron run into a 300s Vercel timeout (504). Replaced with a
  2-lane bounded pool (`WORKABLE_LANE_COUNT`, round-robin) — throughput scales
  with lane count while every request still staggers behind the others in its
  lane, so it isn't the unstaggered burst that caused the original 429s.
- Cron route (`/api/cron`): fetch phase now runs against an explicit 270s
  deadline (`FETCH_TIME_BUDGET_MS` in `runner.ts`) instead of an unbounded
  concurrency-limited loop. Companies not yet dispatched when the deadline
  passes are recorded as `"<company> (<mode>): Skipped — time budget exceeded"`
  in `errors`/`cron_logs_v2` rather than silently missing; already-dispatched
  fetches are left to finish rather than cancelled. `maxDuration = 300` added
  to the route explicitly (matches the existing Hobby + Fluid Compute ceiling —
  doesn't raise it, just stops relying on an implicit default).

### Refactoring

- `LandingContent.tsx`: three data-driven sections (demo job cards, pipeline
  funnel, feature grid) extracted into their own components —
  `DemoJobCards.tsx`, `PipelineFunnel.tsx`, `FeatureGrid.tsx` — each owning
  its own static data. No behavior change; page still prerenders static
  (203 lines/max-lines-per-function warning → resolved, audit row #16)
- Workable fetcher: single host-keyed request queue (was keyed by job mode,
  letting local/global requests race on the same host) shared by list and
  detail-page calls; detail calls now get the same 429 retry/backoff as the
  list call instead of bypassing rate-limiting entirely
- `safeFetch`: retry budget 2 → 3, backoff cap 15s → 30s so a longer
  `Retry-After` value is honored in full instead of truncated
- `scoring.ts`: `passesSettingsGate`'s five sequential checks (seniority,
  excluded keywords, required keywords, blacklisted locations, skill match)
  split into individually exported, individually testable gate functions
  composed with `&&` (complexity 14 → resolved, audit row #12)
- `job/[id]/page.tsx`: tags row and score-breakdown JSX (previously inline,
  duplicating logic already split out of `JobCard.tsx` in row #9) extracted
  into `JobDetailBadges.tsx` (new — untruncated variant of `JobBadges`, since
  the detail page has room to show the full skill lists) and the existing
  `JobScoreBreakdown.tsx` is now reused as-is (232 lines/complexity 14 → 164
  lines, resolved, audit row #13)
- `DashboardClient.tsx`: split into a thin render layer, a stateful hook
  (`hooks/useDashboardFeed.ts` — owns fetch/rebuild/tracked-ids state) and
  pure logic (`lib/dashboard-client.ts` — mode counting, pipeline filtering);
  loading state, error state, and the filter tab bar extracted into
  `DashboardLoadingState.tsx`, `DashboardErrorState.tsx`, `FilterTabs.tsx`;
  `FilterMode` moved out of the component file into `lib/types.ts` (172
  lines, complexity 14 → resolved, audit row #14)
- `gemini.ts`: `callGemini` and `generateApplicationStrategy` each hand-rolled
  the same "try each model in MODEL_QUEUE, bail immediately on an invalid
  key, otherwise fall through and track whether every failure was
  quota-related" loop; extracted once into `callWithModelFallback` /
  `tryModelCall`. `filterBatch` split into `buildResultMap` (idx
  validation/dedup + missing-decision logging) and `failOpenResultMap`
  (whole-batch failure path) so the batch-level try/catch stays simple
  (complexity 11/14/11 → resolved, audit row #15)

### Testing

- `workable-rate-limit.test.ts`: replaced tests asserting full serialization
  (`spread > Nms`) with tests asserting a `maxActive` concurrency counter
  bounded by `WORKABLE_LANE_COUNT` — the old assertions defined "correct" as
  "takes at least N seconds of pure stagger," which is what caused the 504,
  not a regression guard against it.
- `cron-fetch-jobs.test.ts`: added coverage proving the dispatch loop stops
  starting new fetches once a mocked clock crosses the deadline, and that nothing
  is skipped when every fetch finishes inside it.
- Added direct coverage for `passesExcludedKeywordsGate`,
  `passesRequiredKeywordsGate`, `passesBlacklistedLocationsGate`, and
  `passesSkillMatchGate` in `scoring.test.ts` (audit row #12)
- Added `dashboard-client.test.ts` covering `computeModeCounts` and
  `filterJobsByMode` extracted from `DashboardClient.tsx` (audit row #14)
- Added direct coverage for `generateApplicationStrategy` (success,
  model-fallback, invalid-key short-circuit, quota exhaustion) — previously
  untested (audit row #15)

## [2.1.1] - 2026-07-02

### Refactoring

- `SubmissionsTable.tsx`: extracted the per-row render (metadata, test-result
  badge, action buttons vs. status badge) into `SubmissionRow.tsx`, dropping
  the `rows.map` callback's branching out of the parent function
  (complexity 14 → resolved, audit row #11)
- `admin/submissions/[id]/route.ts`: extracted the approval side-effect into
  `lib/admin/approve-submission.ts` and the update-patch builder into
  `lib/admin/build-submission-patch.ts` (complexity 16 → resolved, audit row #10)

### Testing

- Added `build-submission-patch.test.ts` and `approve-submission.test.ts`
  covering the logic extracted from `admin/submissions/[id]/route.ts`

## [2.1.0] - 2026-07-02

### Refactoring

- `settings.ts`: `mergeWithDefaults` rewritten from field-by-field branches to
  a table-driven loop over `SIMPLE_MERGE_FIELDS`, isolating the two fields
  that need special handling (`gemini_filter_prompt`'s fallback floor,
  `scoring_weights`' normalisation) from the rest (complexity 23 → resolved,
  audit row #6)
- `AdminComponents/DefaultsForm.tsx`: split into a thin render layer, a
  stateful hook (`hooks/useDefaultsForm.ts`), and pure logic
  (`lib/defaults-form.ts`) (320 lines, complexity 21 → resolved, audit row #7)
- `ats-bridge.ts`: replaced the 9-branch ATS-type switch with a fetcher lookup
  map (complexity 21 → resolved, audit row #8)
- `JobCard.tsx`: split the tags row, expanded score panel, and action buttons
  into `JobBadges`, `JobScoreBreakdown`, and `JobCardActions`; moved the live
  score recompute into `computeLiveDisplayScore` (`lib/scoring.ts`) and the
  posted-date label into `lib/job-display.ts` — both were duplicated verbatim
  in `job/[id]/page.tsx`, which now imports the same helpers instead
  (complexity 19 → resolved, audit row #9)

### Testing

- Added `defaults-form.test.ts` covering the logic extracted from
  `DefaultsForm.tsx`
- Added dispatch coverage for all 9 ATS fetcher types and the unknown-ATS
  error path in `ats-bridge.test.ts`
- Added `compute-live-display-score.test.ts` and `job-display.test.ts`
  covering the score/date logic extracted from `JobCard.tsx`

## [2.0.0] - 2026-07-02

### Breaking Changes

- Removed visa pipeline (collapsed into global pipeline) - `refactor(types): one source of truth for JobMode`
- Removed hardcoded AGE_CAP_DAYS cutoff - now fully configurable via user settings

### Features

- Per-user seniority configuration in `/settings` - users can select junior/mid/senior/staff levels independently
- Per-user timezone/region filtering for global pipeline
- REMIND_AFTER_DAYS configurable via environment variable
- Build caching and maxFailures in cron job
- Two-query approach for salary reminders script
- Last admin protection - prevents admin from deactivating their own account
- Self-service account deletion in settings
- Email alerts toggle separated from salary reminders
- Review badge added to alert emails

### Fixes

- Rate-limit ATS fetchers hitting shared-host APIs (per-host queue + 429 retry)
- Gemini key settings UI issues
- Salary reminder yml failing due to package.json lookup
- Workable fetch timeout to prevent hangs
- Atomic increment for domain_counts flush
- Updating default profile values no longer changes user data
- Split email-alerts toggle, gated salary cron on it
- Redirect unauthenticated users to /login + sign out blocked users
- Job cutoff issue fix
- Clean up raw_jobs when deleting a company
- Add timeout to Workable detail fetch
- Remove hardcoded AGE_CAP_DAYS cutoff
- Salary reminders script uses two-query approach
- `cron_logs_v2.errors` could never contain a `429` — `fetchCompany()` caught
  every fetcher's own error internally but the dispatch switch only pulled
  `result.jobs` and discarded `result.error`, hardcoding `error: null`
  unconditionally; a rate-limited company and a company with zero open roles
  were indistinguishable in the log until this was fixed (issue #52 follow-up)

### Security

- Added security headers
- Stop leaking raw Supabase error messages to clients
- Migrate user-scoped routes off service-role client (RLS enforcement)

### Chores

- Upgraded runtime to Node 24: `engines.node` set to `>=24`, `@types/node`
  bumped, `.nvmrc` pinned, CI workflows updated. Node 24 ships a native
  global `WebSocket`, which eliminates the Supabase Realtime startup crash
  that previously required the `ws` package workaround on Node 20
- Added `.eslintrc.json` complexity/size rules (`max-lines-per-function`,
  `complexity`, `max-lines`, all set to `warn`) and created
  `src/docs/AUDIT_STATUS.md` to track the resulting fix queue
- Added the quality-gate skill doc

### Refactoring

- Phase 1: Shared foundations (pure addition, zero behavior change)
- Phase 2: Split AdminComponents.tsx into one file per component
- Phase 3: Styles and a{css, a11y cleanup
- Phase 4: Migrate user-scoped routes off service-role client
- Phase 5: Stop leaking raw Supabase error messages to clients
- Phase 6: Process scaffolding from codebase audit
- Split landing page into server + client components
- Migrate /tmp to supabase for persistence
- `admin/defaults/route.ts`: extracted request validation and patch
  construction into `lib/admin/build-defaults-patch.ts` (complexity 47 →
  resolved, audit row #1)
- `ats-utils.ts`: split the 815-line/complexity-16 file into smaller,
  independently-testable functions (audit row #2)
- `admin/companies/[id]/route.ts`: extracted patch-building into
  `lib/admin/build-company-patch.ts` (complexity 26 → resolved, audit row #4)
- `SettingsForm.tsx`: split into a thin render layer, a stateful hook
  (`hooks/useSettingsForm.ts`), and pure logic (`lib/settings-form.ts`)
  (605 lines, complexity 21, 29 useState → resolved, audit row #3)
- `runner.ts`: extracted `fetch-jobs.ts`, `send-scan-notifications.ts`, and
  `upsert-raw-jobs.ts` into `lib/cron/`, each independently tested
  (complexity 24, 160-line function → resolved, audit row #5)

### Testing

- Added Playwright e2e testing infrastructure
- Added regression suite for safeFetch per-host queue and 429 retry
- Added coverage for api-errors, constants, jobs/[id], tracker
- Added coverage for POST /api/submit
- Added salary route unit tests (ilike sanitization, 404/500 handling)
- Added passesGlobalModeGate unit tests
- Added onboarding staleness bug tests
- Added email notification tests for cron job
- Fixed settings e2e test toggle selectors, removed a dead visa-pipeline
  reference from the suite, added a GET timeout

## [2.0.0-alpha] - Initial alpha release

### Features

- Multi-tenant job-hunting SaaS
- Personalized, scored job feed across all enabled pipelines
- Pipeline funnel visualization (/pipeline)
- Kanban-style application tracker (/tracker)
- Community-sourced salary explorer (/salary)
- Per-user skills, seniority, keyword rules, pipelines, and Gemini prompt (/settings)
- Public form to suggest new companies (/submit)
- Admin panel for users, companies, global defaults, pending submissions
- Nine ATS integrations: Greenhouse, Lever, Ashby, Workable, Teamtailor, Breezy, SmartRecruiters, BambooHR, JazzHR
- Three-stage filtering pipeline: Date → Settings (regex) → Gemini
- Per-user Gemini API key for AI filtering
- Email alerts (scan complete + monthly salary reminders)
- GitHub Actions scheduling (twice daily + monthly)
