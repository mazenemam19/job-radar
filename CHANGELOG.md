# Changelog

All notable changes to this project are documented in this file.

## [2.1.0] - 2025-07-02

### Refactoring

- `ats-bridge.ts`: replaced the 9-branch ATS-type switch with a fetcher lookup
  map (complexity 21 → resolved, audit row #8)

### Testing

- Added dispatch coverage for all 9 ATS fetcher types and the unknown-ATS
  error path in `ats-bridge.test.ts`

## [2.0.0] - 2025-07-02

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

### Security

- Added security headers
- Stop leaking raw Supabase error messages to clients
- Migrate user-scoped routes off service-role client (RLS enforcement)
- Admin companies ID complexity fix

### Refactoring

- Phase 1: Shared foundations (pure addition, zero behavior change)
- Phase 2: Split AdminComponents.tsx into one file per component
- Phase 3: Styles and a{css, a11y cleanup
- Phase 4: Migrate user-scoped routes off service-role client
- Phase 5: Stop leaking raw Supabase error messages to clients
- Phase 6: Process scaffolding from codebase audit
- Split landing page into server + client components
- Migrate /tmp to supabase for persistence
- Settings form refactor

### Testing

- Added Playwright e2e testing infrastructure
- Added regression suite for safeFetch per-host queue and 429 retry
- Added coverage for api-errors, constants, jobs/[id], tracker
- Added coverage for POST /api/submit
- Added salary route unit tests (ilike sanitization, 404/500 handling)
- Added passesGlobalModeGate unit tests
- Added onboarding staleness bug tests
- Added email notification tests for cron job

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
