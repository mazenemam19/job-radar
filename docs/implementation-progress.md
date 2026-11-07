# Job Radar implementation progress

**Goal:** Make Job Radar a useful, location-agnostic job-search tool, starting with a Germany pilot for an international candidate who does not speak German.

**Branch:** `codex/germany-search-portability`

**Current state:** The code work is committed locally in 15 small commits. The live Supabase schema is missing `user_settings.search_profile`, so Settings saves that include the new profile currently fail. No database migration has been applied yet.

## Done locally

- [x] Fix custom-weight score display consistency.
- [x] Stop negative sponsorship wording from becoming a positive relocation signal or hidden blacklist.
- [x] Upgrade Next.js and related tooling to a supported release.
- [x] Normalize posting-level country, city, workplace, employment, language, and authorization attributes in ATS ingestion.
- [x] Preserve source location and ATS details; add URL-based duplicate handling across legacy modes.
- [x] Preserve country/flag labels the location backfill cannot classify; infer new country codes only from the posting location.
- [x] Add a per-user search-profile data contract, Settings controls, and an opt-in Germany onboarding preset.

## Remaining for the Germany pilot

- [x] Review the live `raw_jobs` and `user_settings` schemas against the tracked migrations; preserve existing values for locations the backfill cannot classify.
- [ ] Apply the reviewed additive migrations and verify their results in Supabase.
- [ ] Make dashboard filtering use each user's country, cities, workplace choices, and job types before the database limit; keep uncertain rows visible.
- [ ] Show language and work-authorization clues with their evidence and uncertainty on job results/details.
- [ ] Explain briefly why each posting matched the user's search profile.
- [ ] Measure Germany coverage in the ATS company catalog and add verified German employers where coverage is missing.
- [ ] Fold company validation into the ATS intake work.
- [ ] Manually verify Settings save/readback, dashboard rebuild, job detail, tracker, and unrelated-user profile isolation in the browser.
- [ ] Update GitHub issues #43, #47, and #48 and refresh the project board through `gh` after the related changes are verified.
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

- [x] Last local test run: 49 test files, 485 tests passed.
- [x] Last lint run: zero errors; existing warnings remain.
- [x] Last production build passed.
- [ ] Live Supabase integration and browser flow verification: pending.
