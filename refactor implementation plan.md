# Job Radar — Full Rebuild: Multi-Tenant SaaS

## CRITICAL CONSTRAINT — READ FIRST AND NEVER FORGET

The existing codebase is **reference only**. You must NEVER modify any existing file. All new code goes into new files, new routes, new DB tables. The old app continues to run as-is on its own Supabase `storage` table. The new app runs in parallel in the same repo, using entirely new tables. If you touch an existing file, you have broken this rule.

---

## Project Context

**Repo:** https://github.com/mazenemam19/job-radar

**Live app:** https://job-radar-lyart.vercel.app

**What this is now:** Originally a personal job-hunting dashboard for a Senior React/Next.js engineer in Egypt. We are rebuilding it as a **multi-tenant SaaS** where any developer can sign up, configure their own profile, and get a personalized job feed. The old single-user app stays live as-is for reference.

**Current Stack:** Next.js 14 (App Router), Supabase (PostgreSQL + JSONB), Google Gemini AI (cascading model fallback queue), Nodemailer for email alerts.

---

## Current Architecture (READ-ONLY KNOWLEDGE — DO NOT MODIFY)

### Data Flow

```
source pipelines → regex gates → Gemini LLM filter → mergeJobs → Supabase → dashboard
```

### Cron System

Two triggers hit the same `/api/cron` endpoint:

- GitHub Actions POST at 09:00 UTC (`.github/workflows/cron.yml`)
- Vercel cron GET at 16:00 UTC (`vercel.json`)

### Key Existing Files (touch none of these)

- `src/lib/runner.ts` — main orchestrator, runs all 3 pipelines in parallel, Gemini, mergeJobs, email
- `src/lib/scoring.ts` — all regex gate functions + `scoreJob`
- `src/lib/storage.ts` — `readStore`, `writeStore`, `mergeJobs`, 7-day auto-expiry
- `src/lib/constants.ts` — `EXPERT_SKILLS`, `SECONDARY_SKILLS`, `BONUS_SKILLS`, `PERSONAL_SKILLS`, `computeRecencyScore`, `STAFF_KEYWORDS`, `SKILL_REGISTRY`, `CATEGORY_COLORS`
- `src/lib/sources/ats-utils.ts` — `parseRelativeDate`, all ATS fetcher functions (fetchGreenhouse, fetchLever, fetchAshby, fetchWorkable, fetchTeamtailor, fetchBreezy, fetchSmartRecruiters), Workable rate-limit management
- `src/lib/sources/companies.ts` — `ALL_COMPANIES` array (795 lines): every company's ATS type, slug, country, flag, city, and which pipelines it belongs to
- `src/lib/sources/visa-companies.ts`, `local-companies.ts`, `remote-companies.ts` — pipeline orchestrators that read from `ALL_COMPANIES` and fan out to the correct ATS fetcher
- `src/lib/gemini.ts` — Gemini filter with cascading model fallback queue (`filterJobsWithGemini`, `generateApplicationStrategy`)
- `src/lib/email.ts` — Nodemailer HTML email template
- `src/lib/state.ts` — scan state persistence to Supabase
- `src/components/JobCard.tsx` — renders job cards including score bars and strategy button
- `src/app/api/cron/route.ts` — cron route handler

### Existing DB Table (never write to this from new code)

Table: `storage` — columns: `key TEXT`, `data JSONB`
Current keys in use:

- `jobs-store.json` — approved job store (7-day expiry)
- `raw-market-store.json` — all fetched jobs pre-filter (30-day expiry)
- `scan-state.json` — Workable offset state

### Existing Scoring Logic (hardcoded, reference only)

- `EXPERT_SKILLS` (15 skills, weighted ×3): React, TypeScript, JavaScript, HTML, CSS, Redux, React Query, Zustand, MobX, Tailwind, Material UI, Sass, Next.js, Vite, Webpack
- `SECONDARY_SKILLS` (7 skills, weighted ×1): Jest, Vitest, Testing Library, React Native, GraphQL, WebSockets, Storybook
- `BONUS_SKILLS` (9 skills, unscored): Node.js, Express, MongoDB, PostgreSQL, AWS, Docker, Git, Redis, Kubernetes
- `SCORE_DENOMINATOR = 18`
- Formula: `totalScore = skillMatchScore × 0.6 + recencyScore × 0.3 + relocationBonus × 0.1`
- Recency: `Math.max(0, Math.round(100 - ((Date.now() - ms) / 86400000 / 7) * 100))`

### Known Bugs in Old Code (aware, not fixing old code — but new code must not repeat these)

- **Issue #3:** `JobCard.tsx` uses `job.recencyScore` (frozen at insert time) instead of computing it live from `job.postedAt`. Fix in new code: always compute live.
- **Issue #4:** Email alerts only fire for `mode === "visa"` jobs. Fix in new code: fire for all new jobs.
- **Issue #5:** `parseRelativeDate` returns `new Date().toISOString()` for empty/unknown dates, making them permanently fresh and immortal in the store. Fix in new code: use `fetchedAt` as `postedAt` when date is unknown, always set `dateUnknown: true`.
- **Issue #6:** `scoreJob` forces `recencyScore: 0` in early-return branches (skill gate failures), and `mergeJobs` has no `totalScore > 0` gate. Fix in new code: compute recency independently; gate on `totalScore > 0` before storing.
- **Regex bug:** `STAFF_KEYWORDS = /\blead|staff|principal|architect|director|vp|head\b/i` — word boundaries only protect `lead` at start and `head` at end. Fix in new code: `/\b(lead|staff|principal|architect|director|vp|head)\b/i`

### ATS Types Supported (each has a custom parser in ats-utils.ts)

`greenhouse`, `lever`, `ashby`, `workable`, `teamtailor`, `breezy`, `smartrecruiters`, `bamboohr`, `jazzhr`

**Important:** Adding a new COMPANY to an existing ATS type is admin-panel-only (DB row). Adding a brand new ATS TYPE always requires writing a new parser function first, then it becomes available in the admin panel.

---

## New Architecture

### Authentication

- **Supabase Auth with Google OAuth** — simplest free option, already using Supabase
- Roles: `admin` | `user`
- Admin role is manually set in DB by the repo owner. There is one admin (the repo owner).
- New users default to `user` role

### Gemini Model: "Lazy C"

The Gemini filter cannot run during the global cron job because each user has their own Gemini API key and their own custom filter prompt. The solution:

1. **Cron runs globally:** Fetches ALL raw jobs from ALL ATS sources → stores them in a shared raw pool (new table: `raw_jobs`) → marks all user caches as stale → cron is done
2. **User opens dashboard:** Check if their `user_jobs_cache` entry is fresh (created after last cron run). If stale → run their personal Gemini filter (using their stored API key and their custom prompt) → apply their scoring settings → cache results in `user_jobs_cache` → return results. If fresh → instant serve from cache.
3. **Result:** First dashboard open after a cron run = 10-15 second wait while Gemini runs. All subsequent opens = instant from cache. Cache invalidated only when new cron run stores new raw data.

This approach stays within Vercel's serverless function timeout constraints and requires zero queue infrastructure.

### Per-User Configuration (Zero Hardcoded Values)

Every value that was hardcoded in `constants.ts` is now DB-driven with per-user override:

**Admin sets defaults** in `default_settings` table → **User can override** any field in `user_settings` table → **If `uses_defaults = true`**, user inherits everything from `default_settings`

Configurable per user:

- `expert_skills`: string[] (their tier 1 skills, weighted ×3 in scoring)
- `secondary_skills`: string[]
- `bonus_skills`: string[]
- `job_age_days`: int (default 7 — some users want 14, 30, etc.)
- `pipeline_visa`: bool, `pipeline_local`: bool, `pipeline_global`: bool
- `seniority_allow_mid`: bool (allow mid-level roles or seniors only)
- `gemini_filter_prompt`: text (their own Gemini filter prompt — full control)
- `scoring_weights`: jsonb `{ skill: number, recency: number, relocation: number }` (must sum to 1)
- `score_denominator`: int (default 18 — denominator for skillMatchScore calculation)

### Onboarding Flow

```
Google OAuth → new user detected?
  → Onboarding screen:
      REQUIRED: Enter Gemini API key (without this, strategy generation and their filter don't work)
      OPTIONAL: "Customize your profile" (fill in skills, preferences, prompt)
             OR "Skip — use platform defaults" (uses admin's default_settings, can customize later)
  → Dashboard loads
  → Profile page always accessible to edit any setting at any time
```

### Admin Dashboard (role: admin only)

- **Users list:** view all users, activate/block accounts, see last active, see if using defaults or custom profile
- **ATS Companies CRUD:** add/edit/remove companies from the global scrape list — equivalent to editing `companies.ts` but from the UI. Fields: name, ATS type (dropdown of supported types), slug, country, flag, city, pipelines (visa/local/global checkboxes), is_active
- **Default Settings CRUD:** edit every field of `default_settings` — this becomes the fallback for all users who haven't customized
- **Raw Jobs view:** see what the last cron run fetched before any filtering

---

## New Database Schema

All new tables. Never write to the old `storage` table from new code.

```sql
-- Supabase Auth handles auth.users automatically
-- We extend it with a public profile:

CREATE TABLE public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  gemini_api_key TEXT, -- required for filtering and strategy
  onboarding_complete BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ
);

CREATE TABLE public.default_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- single row
  expert_skills TEXT[] DEFAULT ARRAY['React','TypeScript','JavaScript','HTML','CSS','Redux','React Query','Zustand','MobX','Tailwind','Material UI','Sass','Next.js','Vite','Webpack'],
  secondary_skills TEXT[] DEFAULT ARRAY['Jest','Vitest','Testing Library','React Native','GraphQL','WebSockets','Storybook'],
  bonus_skills TEXT[] DEFAULT ARRAY['Node.js','Express','MongoDB','PostgreSQL','AWS','Docker','Git','Redis','Kubernetes'],
  job_age_days INT DEFAULT 7,
  pipeline_visa BOOLEAN DEFAULT TRUE,
  pipeline_local BOOLEAN DEFAULT TRUE,
  pipeline_global BOOLEAN DEFAULT TRUE,
  seniority_allow_mid BOOLEAN DEFAULT FALSE,
  gemini_filter_prompt TEXT, -- the full default filter prompt (same content as current hardcoded prompt in gemini.ts)
  scoring_weights JSONB DEFAULT '{"skill": 0.6, "recency": 0.3, "relocation": 0.1}',
  score_denominator INT DEFAULT 18,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.user_settings (
  user_id UUID PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  uses_defaults BOOLEAN DEFAULT TRUE, -- if true, read from default_settings for all null fields
  expert_skills TEXT[],     -- null = use default
  secondary_skills TEXT[],  -- null = use default
  bonus_skills TEXT[],      -- null = use default
  job_age_days INT,         -- null = use default
  pipeline_visa BOOLEAN,    -- null = use default
  pipeline_local BOOLEAN,   -- null = use default
  pipeline_global BOOLEAN,  -- null = use default
  seniority_allow_mid BOOLEAN, -- null = use default
  gemini_filter_prompt TEXT,   -- null = use default
  scoring_weights JSONB,       -- null = use default
  score_denominator INT,       -- null = use default
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.ats_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  ats TEXT NOT NULL CHECK (ats IN ('greenhouse','lever','ashby','workable','teamtailor','breezy','smartrecruiters','bamboohr','jazzhr')),
  slug TEXT NOT NULL,
  country TEXT NOT NULL,
  country_flag TEXT NOT NULL,
  city TEXT,
  pipeline_visa BOOLEAN DEFAULT FALSE,
  pipeline_local BOOLEAN DEFAULT FALSE,
  pipeline_global BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.raw_jobs (
  id TEXT PRIMARY KEY, -- same id as Job.id (hash of url)
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT NOT NULL,
  country TEXT NOT NULL,
  country_flag TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT NOT NULL,
  posted_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  date_unknown BOOLEAN DEFAULT FALSE,
  is_remote BOOLEAN DEFAULT FALSE,
  salary TEXT,
  mode TEXT NOT NULL CHECK (mode IN ('visa','local','global')),
  visa_sponsorship BOOLEAN DEFAULT FALSE,
  source_name TEXT,
  ats_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON public.raw_jobs (fetched_at DESC);
CREATE INDEX ON public.raw_jobs (mode);

CREATE TABLE public.user_jobs_cache (
  user_id UUID PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  jobs JSONB NOT NULL DEFAULT '[]', -- array of scored Job objects
  cached_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  raw_pool_version TIMESTAMPTZ, -- matches the latest fetched_at in raw_jobs when cache was built
  pipeline_log JSONB -- stores the funnel counts for pipeline visualization
);

CREATE TABLE public.tracker_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  -- Full job snapshot stored at time of tracking (survives job expiry from raw_jobs)
  job_id TEXT NOT NULL, -- original Job.id
  job_snapshot JSONB NOT NULL, -- { title, company, url, location, mode, totalScore, matchedSkills, postedAt, countryFlag, country }
  status TEXT NOT NULL DEFAULT 'applied' CHECK (status IN ('applied','interviewing','offer','rejected','ghosted','saved')),
  notes TEXT,
  applied_at TIMESTAMPTZ,
  last_status_change TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, job_id)
);

CREATE TABLE public.salary_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL, -- nullable for anonymity
  role_title TEXT NOT NULL,
  years_experience INT NOT NULL,
  salary_egp INT, -- monthly in EGP
  salary_usd INT, -- monthly in USD (for remote/global roles)
  currency TEXT NOT NULL CHECK (currency IN ('EGP','USD','EUR','GBP')),
  employment_type TEXT CHECK (employment_type IN ('full-time','part-time','contract','freelance')),
  work_arrangement TEXT CHECK (work_arrangement IN ('onsite','remote','hybrid')),
  pipeline TEXT CHECK (pipeline IN ('local','global','visa')),
  reported_at TIMESTAMPTZ DEFAULT NOW(),
  -- Monthly reminder tracking
  reminder_sent_at TIMESTAMPTZ,
  last_updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON public.salary_reports (role_title);
CREATE INDEX ON public.salary_reports (years_experience);
CREATE INDEX ON public.salary_reports (reported_at DESC);

CREATE TABLE public.cron_logs_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_fetched INT,
  duration_ms INT,
  errors TEXT[],
  source_health JSONB, -- per-source counts and status
  trigger TEXT CHECK (trigger IN ('github_actions','vercel_cron','manual'))
);
```

### Row-Level Security

Enable RLS on all new tables. Users can only read/write their own rows. Admin bypasses RLS via service role key.

---

## Features to Build

### Pipeline Visualization (per-user, post-filter)

After a user's Gemini filter runs and their cache is built, store `pipeline_log` in `user_jobs_cache.pipeline_log`:

```json
{
  "total_fetched": 847,
  "after_date_filter": 312,
  "after_settings_filter": 89,
  "after_gemini": 23,
  "cached_at": "2026-06-19T09:15:00Z"
}
```

The **Pipeline View page** renders this as a visual funnel:

```
[ 847 fetched ] ──→ [ 312 after date filter ] ──→ [ 89 after settings ] ──→ [ 23 after your Gemini ] = your dashboard
```

Each node is a big circle showing the count. Arrows between them. Hovering a node shows what was filtered: e.g., "removed 535 jobs older than 7 days." This gives users insight into why their dashboard shows fewer jobs than expected and lets them tune their settings.

### Application Tracker

Accessible from the main dashboard and as its own page/route.

- **"Track this" button** on every job card → opens a modal → choose status (Applied/Saved/Interviewing/etc.) → optionally add notes and applied date → saves to `tracker_entries` with full job snapshot
- **Tracker page** shows all tracked jobs as cards with status badges, sorted by last activity
- **Status updates** directly from tracker cards (dropdown)
- **Pie chart** showing distribution of statuses (Applied, Interviewing, Offer, Rejected, Ghosted, Saved) so user can see where they're getting stuck
- Tracked jobs persist even after the job expires from `raw_jobs`

### Salary Crowdsourcing

- **Salary page** — users can submit: role title, years experience, salary, currency, arrangement (remote/onsite/hybrid), pipeline (local/global/visa)
- Data is anonymized — user_id stored but not displayed; queries aggregate across users
- **Visualization:** salary range graphs by role and experience band. Example: "Senior React Dev in Egypt, 5 years experience → EGP 25,000 – 45,000/month (based on 12 reports)"
- **Monthly email reminder** via Nodemailer: "Update your salary data — it helps everyone get compensated fairly." If user doesn't update, their last entry is assumed still accurate (noted in UI as "last updated X months ago")
- Reminder uses admin's SMTP credentials (same env vars from existing `.env.local`)

### Landing Page (Milestone 3)

Built using the **Antigravity Design** pattern (see design section below). For non-authenticated visitors:

- Full glassmorphism, floating card animations, GSAP scroll effects
- Shows a **read-only demo** of what the dashboard looks like (fake seeded job data)
- Shows the pipeline visualization with example numbers
- CTA: "Sign in with Google — get your own personalized feed"
- Stats section: "X jobs scraped today from Y companies across Z ATS platforms"
- Feature highlights: per-user filtering, AI strategy, tracker, salary data

---

## Milestone Plan

### Milestone 1: Foundation

1. Supabase Auth with Google OAuth — new middleware protecting new routes
2. Create all new DB tables (SQL migrations) — zero impact on existing `storage` table
3. Seed `default_settings` with exact values from current `constants.ts`
4. Seed `ats_companies` from `ALL_COMPANIES` array in `companies.ts` (one-time migration script)
5. New cron handler (`/api/v2/cron`) — reads from `ats_companies` DB table instead of hardcoded array, fetches all jobs, writes to `raw_jobs` table, marks all user caches stale. Old `/api/cron` stays untouched.
6. Per-user dashboard: on load, if cache stale → run Gemini (user's key + user's prompt) + scoring (user's settings) → write `user_jobs_cache` → return jobs. Apply Issues #3-#6 fixes in new code.
7. Admin dashboard: Users list, ATS Companies CRUD, Default Settings CRUD
8. Onboarding flow: Google login → Gemini key → skip/customize → dashboard
9. User settings page: edit all profile fields

### Milestone 2: Tracker, Salary, Pipeline View

1. Pipeline visualization page (reads from `user_jobs_cache.pipeline_log`)
2. Application tracker (tracker_entries table, track button on job cards, tracker page, pie chart)
3. Salary reports: submission form, aggregate visualization by role/exp/pipeline
4. Monthly email reminder system for salary updates

### Milestone 3: Landing Page

1. Apply Antigravity Design skill (see below)
2. Read-only demo with seeded fake data
3. Stats from real data (total companies scraped, jobs found today, etc.)
4. Full GSAP scroll animations, glassmorphism cards, floating elements

---

## Design Skills to Use

### For Dashboard UI

Apply the `frontend-design` skill. The existing app already has a dark theme (`#08080f` background, indigo accents `#6366f1`). New pages should match this aesthetic.

### For Landing Page (Milestone 3)

Apply the **Antigravity Design** skill. Full spec:

**Stack:** React/Next.js + Tailwind + Custom CSS + GSAP + ScrollTrigger
**Principles:**

- Weightlessness: cards appear to float, layered drop-shadows
- Spatial Depth: Z-axis layering with CSS `perspective`
- Glassmorphism: `backdrop-filter: blur(12px)`, semi-transparent borders
- Isometric Snapping for dashboard preview cards

**Motion Rules:**

- All state changes minimum `0.3s ease-out`
- GSAP ScrollTrigger: elements float in from Y-axis with slight rotation on scroll
- Card grid stagger: `0.1s` delay per card (domino entrance)
- Parallax: background slower than foreground
- Always disable animations for `prefers-reduced-motion: reduce`
- Use `will-change: transform` for GPU offload; never animate `box-shadow` or `filter` continuously

---

## Environment Variables

All new code uses the same `.env.local` keys already in the project. Do not add new env var names or rename existing ones:

```
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
GEMINI_API_KEY=...         -- used for admin/default fallback only
CRON_SECRET=...
SMTP_HOST=...
SMTP_PORT=...
SMTP_USER=...
SMTP_PASS=...
NOTIFY_TO=...
```

User Gemini keys are stored in `user_profiles.gemini_api_key` in the DB, NOT in env vars.

---

## Implementation Notes

### Resolving User Settings

When filtering/scoring for a user, merge their settings with defaults:

```typescript
async function resolveUserSettings(userId: string): Promise<ResolvedSettings> {
  const defaults = await getDefaultSettings();
  const userSettings = await getUserSettings(userId);
  if (!userSettings || userSettings.uses_defaults) return defaults;
  // Per-field: use user's value if non-null, else fall back to default
  return {
    expert_skills: userSettings.expert_skills ?? defaults.expert_skills,
    secondary_skills: userSettings.secondary_skills ?? defaults.secondary_skills,
    // ... etc for all fields
  };
}
```

### Cache Invalidation

After each successful cron run (new raw_jobs written), set a global `last_cron_at` timestamp in a single-row `app_config` table. When serving a user's dashboard, compare `user_jobs_cache.cached_at` to `app_config.last_cron_at`. If cache is older → rebuild.

### Job Deduplication in raw_jobs

Job ID is a hash of the URL (same logic as current codebase). Use `INSERT ... ON CONFLICT (id) DO UPDATE SET fetched_at = NOW()` to avoid duplicates while keeping the freshest `fetched_at`.

### ATS Migration Note

The new cron reads from `ats_companies` table instead of `ALL_COMPANIES` array. The fetcher functions in `ats-utils.ts` remain exactly the same (they accept an `ATSConfig` object). You just pass a DB row cast to `ATSConfig` instead of a hardcoded array entry. Do not modify `ats-utils.ts`.

### Gemini Filter Prompt Storage

The `default_settings.gemini_filter_prompt` field should be seeded with the exact prompt text currently in `gemini.ts` (the `callGemini` function's prompt string). Users can edit this from their profile page.

### Tracker Job Snapshot

The `tracker_entries.job_snapshot` JSONB field must contain enough data to render a mini job card independently without querying `raw_jobs`:

```typescript
interface TrackerJobSnapshot {
  title: string;
  company: string;
  url: string;
  location: string;
  country: string;
  countryFlag: string;
  mode: "visa" | "local" | "global";
  totalScore: number;
  matchedSkills: string[];
  postedAt: string;
}
```

---

## HR ATS Submission (Public, No Auth Required)

A public-facing page (no login needed) where HR managers can submit their company for scraping. This drives organic growth of the ATS company list.

### Submission Flow

1. HR visits `/submit` (public route, zero auth)
2. Fills in: company name, ATS type (dropdown populated from the 9 supported types), ATS slug (the unique identifier their ATS uses — shown with a helper explaining what a slug is per ATS type), country, city, pipelines they want to appear in
3. On submit → row inserted into `ats_submissions` table with `status: 'pending'`
4. HR sees a confirmation: "Submitted. Our team will review and test it."

### Admin Review Flow

Admin panel has a "Submissions" section showing all pending submissions. For each submission:

- **Auto-test button** — triggers a live test: the system calls the ATS API with the provided slug, checks if it returns at least one valid job with expected fields. Reports back: ✅ Working (X jobs found) or ❌ Failed (error message shown).
- **Approve** → moves to `ats_companies` as `is_active: true`
- **Edit** → admin can fix the slug before approving (common case: HR gives wrong slug format)
- **Reject/Remove** → deletes the submission

### New Table

```sql
CREATE TABLE public.ats_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  ats_type TEXT NOT NULL CHECK (ats_type IN ('greenhouse','lever','ashby','workable','teamtailor','breezy','smartrecruiters','bamboohr','jazzhr')),
  slug TEXT NOT NULL,
  country TEXT NOT NULL,
  country_flag TEXT NOT NULL,
  city TEXT,
  pipeline_visa BOOLEAN DEFAULT FALSE,
  pipeline_local BOOLEAN DEFAULT FALSE,
  pipeline_global BOOLEAN DEFAULT FALSE,
  submitter_email TEXT, -- optional, in case admin needs to follow up
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  test_result JSONB, -- stores last auto-test result: { ok: bool, jobsFound: int, error: string, testedAt: string }
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.user_profiles(id)
);
```

### Auto-Test Implementation

The test endpoint (`/api/admin/test-ats-submission`) is admin-auth-protected. It takes a submission ID, constructs the appropriate ATS API call using the existing fetcher functions from `ats-utils.ts` (read-only — do not modify the file, just call the exported functions), and returns the result. No jobs are stored during a test run.

---

## Admin Role Security — Critical

- `user_profiles.role` **defaults to `'user'`** for every new signup. No exceptions.
- The `role` field can **only be changed to `'admin'`** via direct Supabase dashboard access or service role key. There is zero API endpoint in this application that allows role escalation.
- RLS policy on `user_profiles`: users can read and update their own row **except the `role` column**. The `role` column is immutable from the application layer.
- No signup flow, onboarding flow, invite flow, or settings page should ever expose or accept a `role` field from user input.
- If an API request attempts to set `role: 'admin'` in any payload, it is silently ignored — the application never passes `role` to any upsert or update query.
