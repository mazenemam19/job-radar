# Job Radar implementation progress

**Goal:** Make Job Radar a useful, location-agnostic job-search tool, starting with a Germany pilot for an international candidate who does not speak German.

**Branch:** `codex/germany-search-portability`

**Current state:** The Germany pilot migrations have been applied to the live Supabase project. Settings now saves and reloads the per-user profile correctly. The branch contains small, reviewed local commits, including the match explanation, eligibility evidence, and the complete Next 16 dynamic-route compatibility repair. Nothing has been pushed.

## Done locally

- [x] Fix custom-weight score display consistency.
- [x] Stop negative sponsorship wording from becoming a positive relocation signal or hidden blacklist.
- [x] Upgrade Next.js and related tooling to a supported release, including asynchronous dynamic route contexts required by Next 16.
- [x] Normalize posting-level country, city, workplace, employment, language, and authorization attributes in ATS ingestion.
- [x] Preserve source location and ATS details; add URL-based duplicate handling across legacy modes.
- [x] Preserve country/flag labels the location backfill cannot classify; infer new country codes only from the posting location.
- [x] Add a per-user search-profile data contract, Settings controls, and an opt-in Germany onboarding preset.

## Remaining for the Germany pilot

- [x] Review the live `raw_jobs` and `user_settings` schemas against the tracked migrations; preserve existing values for locations the backfill cannot classify.
- [x] Apply the reviewed additive migrations and verify their results in Supabase.
- [x] Make dashboard filtering use each user's country, cities, workplace choices, and job types before the database limit; keep uncertain rows visible.
- [x] Show language and work-authorization clues with their evidence and uncertainty on job results/details.
- [x] Explain briefly why each posting matched the user's search profile.
- [x] Measure Germany coverage in the ATS company catalog: before intake, 239 active sources and 17 with a German company country produced 1,848 stored German-located postings from 32 companies. The catalog now has 244 active sources, including 22 with a German company country.
- [x] Add verified German ATS employers where coverage is missing: AutoScout24, Alpine Eagle, Orcrist Technologies, ecosio, and think-cell are active Greenhouse sources in the global pipeline. The additive, idempotent SQL is tracked in `20261107300000_add_germany_ats_sources.sql` and was applied manually.
- [x] Fold company validation into the ATS intake work; #48 is consolidated into #43.
- [x] Manually verify Settings save/readback, dashboard rebuild, job detail, and tracker in the browser.
- [ ] Verify profile isolation with a second user.
- [x] Update GitHub issues and Project #3: #47 is closed, #43 is the active Germany ATS intake issue, and #48 is closed as consolidated work.
- [ ] Apply and verify `20261107400000_rekey_and_deduplicate_legacy_raw_jobs.sql`. Read-only analysis identified 2,891 pipeline-specific duplicate source records; the migration preserves the newest snapshot, moves any Gemini review before removal, makes review IDs update-cascading, and invalidates result caches for a normal rebuild.
- [ ] Run the 2–4 week pilot and record whether it yields at least three actionable matches per week.
- [ ] Prepare a reviewable PR structure; pushing remains off until explicitly authorized.

## Deferred

- [ ] #53 full diagnostic pipeline.
- [ ] #42 cron rerun/log interface.
- [ ] #44 featured-companies page.
- [ ] #45 salary seeding/conversion; separately revisit the EUR/GBP data-loss risk.
- [ ] #46 visual refresh.
- [ ] Notion integration, broad job-board connectors, and translation.

## Verification log

- [x] Focused unit tests for profile match, eligibility clues, dashboard route, and settings: 23 tests passed.
- [x] Full unit suite: 51 test files and 493 tests passed.
- [x] Browser suite: 35 Playwright tests passed against the existing local server using the separate configured test account.
- [x] Lint: zero errors; 33 pre-existing warnings remain.
- [x] Production build: `next build --webpack` passed. The default Turbopack build cannot spawn its CSS worker inside the sandbox, but the same source compiled, type-checked, and generated all 35 routes with webpack.
- [x] Live Supabase integration: applied the `search_profile` column and profile-aware job-query function; dashboard returned two profile-matched remote postings and left missing country/employment data visible for review.
- [x] Browser flow: saved the Germany profile for `mazenadel19@gmail.com`, reloaded Settings to confirm persistence, opened a job detail, expanded language/work-authorization clues, and checked the empty Tracker route.
- [x] Database report inspection: `raw_jobs` occupies 278 MB for 27,609 rows and drives the 0.31 GB database size. The report shows severe memory commitment (1.43 GB) while physical memory use was about 401 MB; this needs operational follow-up before increasing cron load. A live snapshot showed 1 active and 9 idle client connections, so it does not indicate a connection surge.
- [x] Legacy-ID cleanup preview: 2,891 logical postings are duplicated across historical `local`, `global`, and `visa` pipeline IDs. All 216 Gemini reviews already point at retained rows, so no live review needs moving for the current database. The retained source identity is provider-specific; this avoids treating query-string posting IDs as tracking noise.
