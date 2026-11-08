# Job Radar implementation progress

**Goal:** Make Job Radar a useful, location-agnostic job-search tool, starting with a Germany pilot for an international candidate who does not speak German.

**Branch:** `main` (PR #64 merged)

**Current state:** PRs [#61](https://github.com/mazenemam19/job-radar/pull/61), [#62](https://github.com/mazenemam19/job-radar/pull/62), and [#64](https://github.com/mazenemam19/job-radar/pull/64) are merged. The Germany pilot migrations are live, Settings saves/reloads the per-user profile correctly, and the safe 90-day retention cleanup is complete. The focused frontend-source batch is live and its measured impact is recorded below.

## Done locally

- [x] Fix custom-weight score display consistency.
- [x] Stop negative sponsorship wording from becoming a positive relocation signal or hidden blacklist.
- [x] Upgrade Next.js and related tooling to a supported release, including asynchronous dynamic route contexts required by Next 16.
- [x] Normalize posting-level country, city, workplace, employment, language, and authorization attributes in ATS ingestion.
- [x] Preserve source location and ATS details; add URL-based duplicate handling across legacy modes.
- [x] Preserve country/flag labels the location backfill cannot classify; infer new country codes only from the posting location.
- [x] Add a per-user search-profile data contract, Settings controls, and an opt-in Germany onboarding preset.
- [x] Replace opaque backend failures with stable operation codes and local diagnostic detail; release responses retain the code without exposing database internals.
- [x] Bound the dashboard profile RPC to indexed date/location/type filters, then apply text gates in the application before Gemini. This prevents a wider job-age window from timing out before relevant jobs are considered.
- [x] Repair known posting-country display labels and detect standalone/Greenhouse `Remote` locations when the ATS omits workplace metadata.

## Remaining for the Germany pilot

- [x] Review the live `raw_jobs` and `user_settings` schemas against the tracked migrations; preserve existing values for locations the backfill cannot classify.
- [x] Apply the reviewed additive migrations and verify their results in Supabase, including the bounded profile query (`20261107500000`) and posting-country display repair (`20261107600000`).
- [x] Make dashboard filtering use each user's country, cities, workplace choices, and job types before the database limit; keep uncertain rows visible.
- [x] Show language and work-authorization clues with their evidence and uncertainty on job results/details.
- [x] Explain briefly why each posting matched the user's search profile.
- [x] Measure Germany coverage in the ATS company catalog: before intake, 239 active sources and 17 with a German company country produced 1,848 stored German-located postings from 32 companies. After the reviewed source intakes, the live catalog measured 262 active sources, including 40 with a German company country.
- [x] Add verified German ATS employers where coverage is missing: AutoScout24, Alpine Eagle, Orcrist Technologies, ecosio, and think-cell are active Greenhouse sources in the global pipeline. The additive, idempotent SQL is tracked in `20261107300000_add_germany_ats_sources.sql` and was applied manually.
- [x] Verify eight currently relevant frontend feeds that were absent from the live catalog: ResearchGate, AMBOSS, Trading 212, Plentific, Constructor Tech, Almedia, Peec AI, and bunch. Their public feeds expose Berlin, Germany-wide, or Germany-eligible React/frontend roles. The idempotent source migration is `20261107900000_add_verified_germany_frontend_sources.sql`.
- [x] Correct ATS ingestion before enabling that batch: use Ashby's current posting location field, retain Lever requirement sections, prioritize Greenhouse posting locations over board labels, and normalize Bulgaria rather than treating it as an uncertain location.
- [x] Merge the adapter corrections (PR #64), add the eight approved source records, and backfill their feeds without notifications. On 2026-11-08: all eight fetches/upserts succeeded (220 postings: 1 ResearchGate, 18 AMBOSS, 58 Trading 212, 20 Plentific, 32 Constructor Tech, 30 Almedia, 29 Peec AI, and 32 bunch). The Supabase SQL editor repeatedly ran a stale draft and rejected it before mutation, so the idempotent, row-equivalent insert was verified and applied through the configured service-role connection after confirming no records existed.
- [x] Measure the real profile's post-backfill match count. The production-equivalent rebuild invalidated caches, ran the profile's database filters, Gemini review, scoring, and deduplication, and wrote the account cache. Of the new feeds, 25 postings reached the profile's coarse pool, one passed the fast text check, and zero passed the precise gates; the dashboard therefore remains at 12 matches. This is an availability result, not evidence of a stale cache or a claimed shortlist increase.
- [ ] Review the next small, live-validated intake: NetBird, Hawk, and Manex AI. Their public Ashby boards all returned HTTP 200 and are absent from the live catalog. A read-only run through the saved profile found four exact pre-Gemini candidates: two NetBird Berlin/remote hybrid roles with explicit English evidence, Hawk's Munich/Berlin hybrid React role with explicit English evidence, and Manex AI's Munich on-site React/Next.js role with language evidence still unclear. None has negative sponsorship or work-authorization wording; all remain visible as eligibility-uncertain rather than being silently excluded. The additive, idempotent source migration is `20261108000000_add_live_germany_frontend_sources.sql`; do not apply or backfill it until its PR is reviewed and merged.
- [x] Fold company validation into the ATS intake work; #48 is consolidated into #43.
- [x] Manually verify Settings save/readback, dashboard rebuild, job detail, and tracker in the browser. On 2026-11-07, an unchanged save at the real 11-day setting returned the success toast and rebuilt the dashboard to 12 matches; the corrected Doctolib card displayed 🇩🇪 Berlin. That count predates the later source backfills and must not be attributed to them.
- [ ] Verify profile isolation with a second user.
- [x] Update GitHub issues and Project #3: #47 is closed, #43 is the active Germany ATS intake issue, and #48 is closed as consolidated work.
- [ ] Apply and verify the manual rekey script in `supabase/manual-migrations/20261107400000_rekey_and_deduplicate_legacy_raw_jobs.sql`. Read-only analysis identified 2,891 pipeline-specific duplicate source records; it preserves the newest tracker state and Gemini review before removal, makes review IDs update-cascading, and invalidates result caches for a normal rebuild.
- [ ] Run the 2–4 week pilot and record whether it yields at least three actionable matches per week.
- [x] Push the reviewed branch and open draft PR #61; add it to Project #3 as In Progress and link the active ATS intake issue (#43).

## Storage retention follow-up

- [x] Measure production `raw_jobs`: 27,717 rows and 280 MB. 15,173 rows were unseen for 30 days, 11,440 for 60 days, and 8,154 for 90 days; every 90-day candidate is untracked. No rows were unseen for 180 days.
- [x] Add a 90-day tracked-job-safe retention function and invoke it after each cron scrape. The database operation is atomic: it excludes `tracker_entries` within the same delete statement.
- [x] Apply and verify additive migration `20261107700000_prune_stale_raw_jobs.sql` in production. The tracker-ID index and tracked-job-safe retention function were installed on 2026-11-07; no rows were deleted during this step.
- [x] Execute the one-time production cleanup after explicit confirmation: deleted 8,154 untracked 90-day rows, invalidated three dashboard caches, and refreshed the scheduler timestamp. `raw_jobs` fell from 27,717 to 19,563 rows; no stale untracked 90-day candidate remains.
- [ ] Check the database-size trend after the next cron runs. A normal vacuum makes deleted space reusable; it does not necessarily reduce the allocated-disk chart immediately.

## Deferred

- [ ] #53 full diagnostic pipeline.
- [ ] #42 cron rerun/log interface.
- [ ] #44 featured-companies page.
- [ ] #45 salary seeding/conversion; separately revisit the EUR/GBP data-loss risk.
- [ ] #46 visual refresh.
- [ ] Notion integration, broad job-board connectors, and translation.

## Verification log

- [x] Focused unit tests for error diagnostics, settings/dashboard retrieval, ATS location normalization, and profile filtering: 35 tests passed.
- [x] Full unit suite: 52 test files and 498 tests passed.
- [x] Browser suite: 35 Playwright tests passed against the existing local server using the separate configured test account (run in four bounded groups: auth/dashboard, onboarding, settings, pipeline/tracker/salary).
- [x] Lint: zero errors; 33 pre-existing warnings remain.
- [x] Production build: `next build --webpack` passed. The default Turbopack build cannot spawn its CSS worker inside the sandbox, but the same source compiled, type-checked, and generated all 35 routes with webpack.
- [x] Live Supabase integration: applied the `search_profile` column and profile-aware job-query function; dashboard returned two profile-matched remote postings and left missing country/employment data visible for review.
- [x] Browser flow: saved the Germany profile for `mazenadel19@gmail.com`, reloaded Settings to confirm persistence, opened a job detail, expanded language/work-authorization clues, and checked the empty Tracker route.
- [x] Dashboard timeout diagnosis: the previous profile RPC took 15.8 seconds for the 11-day search. The constrained query and in-process precision gates now rebuild the real dashboard successfully instead of returning a generic error.
- [x] Review follow-up: an independent code review identified the legacy country-label mismatch and missing standalone-remote classification. Both were fixed, regression-tested, and manually verified against the live Doctolib posting.
- [x] Copilot review follow-up: canonical writers now reuse matching legacy IDs during the transition; provider query IDs survive dashboard deduplication; source-pipeline controls are editable again; and the destructive rekey is isolated as a manual operation that also preserves tracker entries.
- [x] E2E reliability: onboarding tests now restore the shared test session after each case, preventing an incomplete-onboarding session from leaking into Settings tests.
- [x] CI reliability: the blocked-user browser test now changes only the configured test profile (not its browser session) before asserting the proxy redirect. The focused auth suite passed after this repair.
- [x] Database report inspection: `raw_jobs` occupies 278 MB for 27,609 rows and drives the 0.31 GB database size. The report shows severe memory commitment (1.43 GB) while physical memory use was about 401 MB; this needs operational follow-up before increasing cron load. A live snapshot showed 1 active and 9 idle client connections, so it does not indicate a connection surge.
- [x] Legacy-ID cleanup preview: 2,891 logical postings are duplicated across historical `local`, `global`, and `visa` pipeline IDs. All 216 Gemini reviews already point at retained rows, so no live review needs moving for the current database. The retained source identity is provider-specific; this avoids treating query-string posting IDs as tracking noise.
- [x] Retention preview: live production counts confirm that a 90-day `fetched_at` cutoff removes 8,154 untracked rows without touching a tracker entry. The full suite passed with 53 test files / 503 tests after adding the cron retention call and its failure path.
- [x] Frontend-source rollout: all eight verified provider endpoints returned HTTP 200 and wrote without upsert errors. A direct reconstruction using the same dashboard functions and the real saved profile completed in 17.2 seconds; its funnel was 20,251 total / 5,395 date-qualified / 1,928 DB-side coarse / 61 exact pre-Gemini / 12 Gemini-and-score-qualified. The cached dashboard result is 12, unchanged from before this source batch.
- [x] Next-source discovery: direct Ashby parsing and saved-profile gating verified four exact pre-Gemini candidates from three absent German boards (NetBird, Hawk, and Manex AI). The candidate source records are deliberately kept in a separate three-source migration for review before any production catalog write.
