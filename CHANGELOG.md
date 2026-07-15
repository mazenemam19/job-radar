# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

### Fixes

- `jr_get_filtered_raw_jobs`'s `patterns` CTE wasn't materialized, so
  Postgres inlined it and re-ran every `jr_word_boundary_pattern()`/
  `jr_substring_pattern()` call (a `string_agg` + per-term `regexp_replace`
  over the settings arrays) once per row of `raw_jobs` instead of once per
  query — confirmed as `SQLSTATE 57014` ("canceling statement due to
  statement timeout") in Supabase's Postgres logs immediately after PR #60
  merged and its migration was applied. Reproduced and fixed locally via
  `EXPLAIN (analyze, buffers)` against the real schema at 30k/200k-row
  synthetic scale: 935ms → 544ms at 30k rows, 4,059ms → 1,413ms at 200k
  (gap widens with scale, as expected for an O(rows) cost being removed).
  Added `MATERIALIZED` to the CTE; also tightened the function's grants
  (`revoke ... from public, anon, authenticated`, previously only
  `public`). See
  `docs/solutions/bugs/db-filtering-timeout-and-gemini-quota.md`.
- `filterJobsWithGemini` had no persistent decision cache — every cache
  rebuild (every cron run, twice daily) re-sent every still-in-window job
  to Gemini from scratch, even ones already reviewed under the identical
  prompt, in an unpaced sequential batch loop that could burn through a
  model's per-minute quota partway through a cold rebuild — the direct
  cause of jobs randomly showing "⚠ Not AI-reviewed"/"⚠ Gemini quota
  exhausted" despite a valid key. New `user_job_gemini_reviews` table,
  keyed by `(user_id, job_id)` and scoped by a hash of
  `gemini_filter_prompt` (so editing the prompt naturally invalidates old
  decisions); only real decisions are ever persisted, so a job that failed
  open retries on the next rebuild instead of staying stuck unreviewed.
  Added 300ms pacing between batches. `gemini.ts` split into
  `gemini-model-fallback.ts`, `gemini-batch-filter.ts`, and
  `gemini-review-cache.ts` to stay under this project's own
  `max-lines`/`complexity` lint limits once the new logic pushed both over
  their caps. Also fixed `/pipeline`'s "Settings filter" tooltip, which
  still described pre-PR#60 behavior (seniority gate only) instead of the
  five gates it now actually covers. See
  `docs/solutions/bugs/db-filtering-timeout-and-gemini-quota.md`.

- The same tail companies (SmartNews, Elements Interactive, Learnosity, Plan A)
  got skipped on every cron run that hit its time budget, regardless of batch
  size (39 companies one day, 23 the next, same losers both times) — the
  non-Workable dispatch order had no stable sort, so the same companies
  landed in the same array position every run, and the time-budget skip logic
  always drops whichever tasks haven't been dispatched yet. Added a rotating
  dispatch cursor (`dispatch-cursor.ts`): sorts that bucket into a stable
  order and resumes right after the last company actually dispatched last
  run, persisted in `app_config.dispatch_cursor`. Proven (not just asserted)
  to cycle every company through the skipped position exactly once per full
  rotation under a sustained partial-skip pattern — the naive "resume by
  canonical order" version gets stuck oscillating between two companies
  forever. Workable's own dispatch bucket is untouched. See
  `docs/solutions/bugs/issue-52-dispatch-rotation-cursor.md`.
- An active company with both pipelines (`pipeline_local`, `pipeline_global`)
  disabled got zero fetch tasks queued in `fetchAllCompanyJobs`, silently —
  not skipped, not errored, just never dispatched or logged at all.
  `is_active` alone didn't catch this. Added a shared `missingPipeline()`
  check (`companies-table.ts`) used by the public submit route and both admin
  company routes (`POST`, and `PUT` — merged against the row's current state
  first, so a patch touching only one field still gets validated against the
  state it would produce), rejecting the combination instead of accepting it
  silently.
- `FETCH_TIME_BUDGET_MS` only ever stopped _new_ company fetches from being
  queued — already-dispatched fetches ran to completion regardless, so on its
  own it was never a guarantee the fetch phase actually finished by 270s.
  Added `HARD_FETCH_CUTOFF_MS` (250s), a real ceiling on how long
  `runCronJob` waits for the fetch phase before moving on with whatever's
  been fetched so far, landed below the soft budget so in-flight fetches keep
  running in the background instead of being cancelled. Separately: most
  Workable request volume was redundant — every cron run re-fetched every
  open role's detail page unconditionally, even for jobs already on file with
  an unchanged description, very likely most of what tripped Workable's rate
  limiter in the first place. New `known-jobs.ts`: a run-scoped
  `Map<id, description>` loaded once before dispatch; `fetchWorkable` reuses
  the stored description and skips the detail-page network call on a hit. See
  `docs/solutions/bugs/issue-52-504-recurrence-part6.md`.

- Teamtailor's public `jobs.json` now serves JSON Feed
  (`Content-Type: application/feed+json`) for at least some companies
  (confirmed: Full Fabric), which the shared `parseJsonBody()` content-type
  gate rejected outright — `"application/feed+json"` doesn't contain the
  substring `"application/json"` the check looked for, so a valid,
  parseable job listing got discarded as "Non-JSON response." Gate now
  accepts any `+json` structured-syntax suffix (RFC 6839), and
  `teamtailor.ts` gained a parsing branch for the JSON Feed `items[]` shape
  alongside the legacy `data[]` shape. Full Fabric's board is alive and
  correctly configured — this was purely a parser bug, not a dead board.
  Yodo1 (the only other `ats=teamtailor` company) is being moved off the
  ATS pipeline separately and isn't blocked on this fix. See
  `docs/solutions/bugs/issue-52-teamtailor-feed-json.md`.

- `markWorkableSlugsBlocked24h()` (`run-state.ts`) computed one flat cooldown
  expiry and applied it to every slug in a blocked batch, so a group that got
  429'd together also came off cooldown together, ~24h later — walking
  straight back into the same thundering herd that blocked them. A live
  storm (2026-07-08 00:04) blocked 33 slugs together and, per the retest 95
  minutes later, was on track to repeat the cycle on the same ~90-minute
  window the next day. Now jitters each slug's expiry independently in
  `[20h, 28h)`. Same storm run also skipped 39 non-Workable companies
  ("time budget exceeded") because Workable dispatch shared one global
  8-slot concurrency pool (`fetch-jobs.ts`) with every other ATS type — a
  Workable company can hold a slot for up to 90s while only ever making
  progress through 2 internal lanes, so a released batch could occupy 5+ of
  the 8 shared slots and starve dispatch for everyone else. Workable now
  gets its own pool capped at its lane count, run alongside the other-ATS
  pool via `Promise.all` instead of sharing one. Secondary: `workable.ts`'s
  "job detail fetches failed" warning now distinguishes a 429 that exhausted
  retries from a genuine dead/removed link, previously bucketed identically.
  See `docs/solutions/bugs/issue-52-504-recurrence-part5.md`.

- `fetch-jobs.ts`: `withConcurrencyLimit` called every task unconditionally
  before checking the concurrency limit, so the limit only throttled how
  fast the dispatch loop advanced, not how many tasks actually ran —
  measured 217 of 266 companies dispatching concurrently against a
  requested cap of 8 in the 2026-07-05 production log. This is the root
  cause of a cluster of generic `Network/Timeout` errors previously
  suspected to be local network flakiness. Rewritten as a worker-pool
  (`limit` workers pulling from a shared task index); a same-day re-run
  confirmed peak concurrency dropped to exactly 8 and `Network/Timeout`
  errors dropped from 19 to 1. See
  `docs/solutions/bugs/issue-52-429-404-followup-part3.md`.
- ATS fetchers trusted `res.ok` to mean "this body is JSON," which a
  200-status WAF/bot-challenge page defeats, producing a misleading
  `Parse Error: SyntaxError` instead of the real cause (confirmed repro:
  Artefactual Systems Inc. on Breezy). Added `safeFetchJson()` (`http.ts`)
  checking status, then `content-type`, then parsing; migrated `breezy.ts`.
  Rollout now complete: `teamtailor.ts`, `ashby.ts`, `greenhouse.ts`,
  `lever.ts`, `smart-recruiters.ts`, `bamboohr.ts` migrated in full, and
  `workable.ts`'s list-call (its per-job detail-fetch path is untouched on
  purpose — see below). `http.ts`'s `safeFetchJson` was split into
  `parseJsonBody` (takes a `Response | null` directly) + a thin
  `safeFetch`-calling wrapper, so `workable.ts` — which queues/retries its
  own fetches — can reuse the parsing half without duplicating it.
  `teamtailor.ts` additionally gained an explicit `Array.isArray` guard on
  the parsed body's `data` field: `safeFetchJson` only confirms the body
  parsed as JSON, not that it matches the expected shape, and Yodo1's board
  returned valid JSON with no `data` array, crashing the old `data.length`
  on `undefined` — a live instance of this caught during validation, see
  `docs/solutions/bugs/issue-52-429-404-followup-part4.md`. No equivalent
  guard was added to `greenhouse.ts`, `lever.ts`, or `smart-recruiters.ts`,
  which have the same latent shape-trust issue with no fallback — flagged
  in-code, not fixed, with no live evidence of it firing for those three.
  `smart-recruiters.ts`'s per-job detail-fetch loop (left on the old
  pattern, same carve-out as `workable.ts`'s) has a separate pre-existing
  issue: a bad detail response returns `null` and the job is silently
  dropped rather than falling back to a list-level description — also
  flagged, not fixed, out of scope for this rollout.
- JazzHR removed entirely (fetcher, `ATSType` union member, submit-form
  option, and all references) — confirmed dead. Two companies (TED,
  Roadpass Digital) were being dispatched twice, once under their real ATS
  (success) and once under a dead `jazzhr` duplicate row (timeout); a third
  duplicate row (Humi Inc) was found via DB check before deleting anything.
  All three duplicate rows removed from `ats_companies`. Separately, 13
  companies confirmed permanently 404ing on their real ATS host (9
  Greenhouse, 3 Lever, 1 Ashby — not all Workable, as first assumed) were
  paused (`is_active = false`).
- `fetchWorkable`: a job's detail page can 404 between the list call and
  the detail fetch (delisted, stale shortcode) and was silently falling
  back to the list description with no visibility. `FetcherResult` gained
  an optional `warnings` field (distinct from `error`) — the company still
  reports success, with a `"N/M job detail fetches failed (dead/removed
links)"` note surfaced separately in `cron_logs_v2` (new `warnings
text[]` column) and the `cron:log` console summary.
- `run-state.ts` / `workable.ts`: `markWorkable429` only ever protected
  _future_ runs — it fed a set that gets flushed to the DB after the fetch
  phase already finished, so a slug that 429'd had zero cooldown for the
  rest of the run that discovered it. Combined with the ceiling-triggered
  give-up path never calling `markWorkable429` at all (confirmed via a live
  local run: 415 429s, 0 "marking blocked" lines), a company with many job
  listings could have every single detail-page request independently
  re-discover the same 429, each paying up to the 90s ceiling — one company
  alone took 562s. `markWorkable429` now blocks immediately for the rest of
  the current run, the ceiling-triggered 429 path now actually calls it, and
  the detail-page fanout checks the block before each request instead of
  only once before the list call. See
  `docs/solutions/bugs/issue-52-504-recurrence-part4.md`.

- `src/app/submit/page.tsx`: `ATS_TYPES` (the ATS-type `<select>`'s options —
  value, label, slug-hint) was defined inline in the component, a
  pre-existing violation of this repo's react-component-architecture
  convention (constants always move out of component files). Extracted to
  `src/lib/constants.ts`, next to the existing `VALID_ATS`. No behavior
  change. See `docs/solutions/bugs/issue-52-429-404-followup-part4.md`.

- `runner.ts`: zero logging existed for any step between the upsert phase and
  the end of the function — `app_config` update, `flushWorkable429sToDB`,
  `flushDomainCountsToDB`, and the `cron_logs_v2` insert itself all only
  logged on failure, and three of the four didn't even log that. `cron_logs_v2`
  has had no successful row since 2026-07-02 despite scheduled runs
  continuing on both daily triggers, and there was no way to tell from the
  logs which of these four steps — or something after all of them — was
  where the run stopped reaching the DB. Added a success-path log line after
  each step, matching the existing `[cron] <phase> done (+Xms)` pattern from
  the fetch/upsert phases. This is diagnostic only — it does not fix a known
  root cause, because there isn't a confirmed one yet; it exists so the next
  hard-killed run leaves an exact line of death instead of requiring another
  round of guessing.
- `runner.ts`: the `cron_logs_v2` insert's own error was discarded — the
  destructured `error` was never read, so a failing insert into the table
  that exists specifically to record run failures was itself invisible.
  Now captured and logged.
- `flushDomainCountsToDB` / `flushWorkable429sToDB` (`run-state.ts`): the
  empty-input early return in both was a silent no-op with no log line,
  indistinguishable in the log from "never reached this line at all." Both
  now log which branch they took.

- `queueByHost` (`http.ts`), shared by Greenhouse/Lever/Ashby/SmartRecruiters/
  JazzHR/Breezy/Teamtailor: was a single fully-serial chain per host — the
  same shape of bug Workable had before its own fix above, just never
  exercised hard enough to notice. This is why the 504 came back after the
  Workable lane pool and cron time budget both shipped: SmartRecruiters'
  per-company detail-page fanout (`pLimit(5)`) funnels into this same shared
  host queue across every SmartRecruiters company in the run, so it scales
  wall-clock time the same way Workable used to. Replaced with a
  `HOST_LANE_COUNT`-lane pool per host, mirroring `WORKABLE_LANE_COUNT`.
- `safeFetch` and `fetchWorkableUrl`: added a 90s total-wall-clock ceiling
  per call, independent of retry count. Without it, a single persistently-429
  or slow host could hold its lane for close to the full theoretical worst
  case (4 attempts × 45s timeout + 3 × 30s backoff ≈ 270s) — and because a
  lane is a serial chain, every other request queued behind it in that lane
  waits for the whole thing, regardless of the cron's own dispatch-time
  deadline (`fetch-jobs.ts`), which has no power over work already in flight.
- Added `console.log`/`console.error`/`console.warn` at the per-request layer
  (`safeFetch`, `fetchWorkableUrl`), per-company dispatch layer
  (`fetch-jobs.ts`), and per-phase layer (`runner.ts`) — there was previously
  zero logging anywhere in the fetch pipeline, so when Vercel hard-kills a
  run at 300s, the function dies before the `cron_logs_v2` insert ever runs
  and nothing is recorded anywhere. See
  `docs/solutions/bugs/issue-52-504-recurrence-part3.md`.
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

- Moved date, seniority, excluded-keywords, blacklisted-locations, and
  global-mode filtering out of `buildFeed()`/JS and into a single Postgres
  RPC, `jr_get_filtered_raw_jobs` (PR #60,
  `docs/solutions/features/2026-07-11-db-level-job-filtering.md`) —
  replaces the old `.select("*").in("mode", ...).order().limit(2000)` call
  in `dashboard/route.ts` with pre-filtered results plus a funnel object
  (`total_fetched`, `after_date_filter`, `after_settings_filter_coarse`).
  Required-keywords and skill-match stay in JS as a precision recheck on
  the DB's coarse superset — the boilerplate-window/distinct-match logic
  behind `hasMeaningfulKeywordMatch` doesn't translate cleanly to SQL (see
  the plan doc, §2.3). Shipped without its own regression test for the RPC
  call path and without the query-performance check the plan doc itself
  flagged as outstanding (Task 1's `EXPLAIN ANALYZE`) — both gaps, and
  their consequences, are covered in
  `docs/solutions/bugs/db-filtering-timeout-and-gemini-quota.md`.
- `e2e-login/route.ts` (`POST`): kept unchanged per the safety rules in `AGENTS.md`
  ("The e2e-login route works as-is. Do not modify it") (row #24 exempt).
- `verify-domain-counts-coverage.ts`: decomposed IIFE complexity by splitting
  stats logging, task building, delta reporting, and Breezy/Teamtailor status checks
  into helper functions; replaced local limiter with imported `withConcurrencyLimit`
  (complexity 20 → resolved, audit row #23).
- `tracker/[id]/route.ts` (`PATCH`): fields extraction and validation helper
  `buildTrackerPatch` moved to `lib/tracker-route.ts` (complexity 11 →
  resolved, audit row #22).
- `CompaniesTable.tsx`: split into a thin render layer, a stateful hook
  (`hooks/useCompaniesTable.ts` — owns load/save/delete/edit state) and
  pure logic (`lib/companies-table.ts` — `filterCompanies`, `formFromRow`,
  `EMPTY_FORM`) (154 lines/no tests → resolved, audit row #21).
- `submit/route.ts` (`POST`): four sequential required-field guards replaced
  with a single `validateSubmitPost` call; `countryFlag` lookup extracted —
  both moved to `lib/submit-route.ts` (complexity 13 → resolved, audit row #20).
- `salary/route.ts`: `aggregateSalaries` + its helpers (`pickAmount`,
  `bucketExperience`) and `validateSalaryPost` extracted to
  `lib/salary-route.ts`; POST body validation replaced with a single
  `validateSalaryPost` call (complexity 13×2 → resolved, audit row #19).
- `dashboard/route.ts` (`GET`): rebuild pipeline (date → settings →
  global-mode → Gemini → score → merge) extracted into `buildFeed()` in
  `lib/dashboard-route.ts`; enabled-pipeline list into `enabledModes()`.
  Handler is now: auth → cache check → fetch raw → `buildFeed` → write cache
  → respond (complexity 13 → resolved, audit row #18).
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

- Added `gemini-review-cache.test.ts` (9 tests): cache-hit reuse without
  calling Gemini, cache-hit on a cached fail, only-uncached-jobs-get-called,
  fail-open results (quota exhausted, missing idx) deliberately never
  persisted, cache-read failure treated as empty rather than blocking the
  request, a prompt change reaching Gemini again, and multi-batch handling
  — direct coverage for the persistent review cache added in
  `docs/solutions/bugs/db-filtering-timeout-and-gemini-quota.md`.
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
