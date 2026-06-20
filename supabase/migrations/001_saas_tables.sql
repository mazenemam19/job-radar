-- ============================================================
-- Job Radar v2 – SaaS Tables
-- NEVER writes to the existing `storage` table.
-- Run this in your Supabase SQL editor or via supabase db push.
-- ============================================================

-- ── User Profiles ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id                  UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email               TEXT        NOT NULL,
  role                TEXT        NOT NULL DEFAULT 'user'
                                  CHECK (role IN ('admin', 'user')),
  gemini_api_key      TEXT,
  onboarding_complete BOOLEAN     NOT NULL DEFAULT FALSE,
  is_active           BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at      TIMESTAMPTZ
);

-- ── Default Settings (single-row table, id always = 1) ─────
CREATE TABLE IF NOT EXISTS public.default_settings (
  id                  INT         PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  expert_skills       TEXT[]      NOT NULL DEFAULT ARRAY[
    'React','TypeScript','JavaScript','HTML','CSS','Redux',
    'React Query','Zustand','MobX','Tailwind','Material UI',
    'Sass','Next.js','Vite','Webpack'
  ],
  secondary_skills    TEXT[]      NOT NULL DEFAULT ARRAY[
    'Jest','Vitest','Testing Library','React Native',
    'GraphQL','WebSockets','Storybook'
  ],
  bonus_skills        TEXT[]      NOT NULL DEFAULT ARRAY[
    'Node.js','Express','MongoDB','PostgreSQL','AWS',
    'Docker','Git','Redis','Kubernetes'
  ],
  job_age_days        INT         NOT NULL DEFAULT 7,
  pipeline_visa       BOOLEAN     NOT NULL DEFAULT TRUE,
  pipeline_local      BOOLEAN     NOT NULL DEFAULT TRUE,
  pipeline_global     BOOLEAN     NOT NULL DEFAULT TRUE,
  seniority_allow_mid BOOLEAN     NOT NULL DEFAULT FALSE,
  gemini_filter_prompt TEXT,
  scoring_weights     JSONB       NOT NULL DEFAULT '{"skill":0.6,"recency":0.3,"relocation":0.1}',
  score_denominator   INT         NOT NULL DEFAULT 18,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Per-User Settings (overrides per-field) ─────────────────
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id             UUID        PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  uses_defaults       BOOLEAN     NOT NULL DEFAULT TRUE,
  expert_skills       TEXT[],
  secondary_skills    TEXT[],
  bonus_skills        TEXT[],
  job_age_days        INT,
  pipeline_visa       BOOLEAN,
  pipeline_local      BOOLEAN,
  pipeline_global     BOOLEAN,
  seniority_allow_mid BOOLEAN,
  gemini_filter_prompt TEXT,
  scoring_weights     JSONB,
  score_denominator   INT,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── ATS Companies (replaces hardcoded ALL_COMPANIES array) ──
CREATE TABLE IF NOT EXISTS public.ats_companies (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT        NOT NULL,
  ats          TEXT        NOT NULL CHECK (ats IN (
    'greenhouse','lever','ashby','workable','teamtailor',
    'breezy','smartrecruiters','bamboohr','jazzhr'
  )),
  slug         TEXT        NOT NULL,
  country      TEXT        NOT NULL,
  country_flag TEXT        NOT NULL,
  city         TEXT,
  pipeline_visa    BOOLEAN NOT NULL DEFAULT FALSE,
  pipeline_local   BOOLEAN NOT NULL DEFAULT FALSE,
  pipeline_global  BOOLEAN NOT NULL DEFAULT FALSE,
  is_active    BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ats_companies_ats_slug_key UNIQUE (ats, slug)
);

CREATE INDEX IF NOT EXISTS ats_companies_ats_idx ON public.ats_companies (ats);
CREATE INDEX IF NOT EXISTS ats_companies_active_idx ON public.ats_companies (is_active);

-- ── Raw Jobs Pool (shared across all users) ─────────────────
CREATE TABLE IF NOT EXISTS public.raw_jobs (
  id               TEXT        PRIMARY KEY,
  title            TEXT        NOT NULL,
  company          TEXT        NOT NULL,
  location         TEXT        NOT NULL,
  country          TEXT        NOT NULL,
  country_flag     TEXT        NOT NULL,
  url              TEXT        NOT NULL,
  description      TEXT        NOT NULL,
  posted_at        TIMESTAMPTZ,
  fetched_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  date_unknown     BOOLEAN     NOT NULL DEFAULT FALSE,
  is_remote        BOOLEAN     NOT NULL DEFAULT FALSE,
  salary           TEXT,
  mode             TEXT        NOT NULL CHECK (mode IN ('visa','local','global')),
  visa_sponsorship BOOLEAN     NOT NULL DEFAULT FALSE,
  source_name      TEXT,
  ats_type         TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS raw_jobs_fetched_idx ON public.raw_jobs (fetched_at DESC);
CREATE INDEX IF NOT EXISTS raw_jobs_mode_idx    ON public.raw_jobs (mode);

-- ── Per-User Jobs Cache (built lazily on dashboard load) ────
CREATE TABLE IF NOT EXISTS public.user_jobs_cache (
  user_id          UUID        PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  jobs             JSONB       NOT NULL DEFAULT '[]',
  cached_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  raw_pool_version TIMESTAMPTZ,
  pipeline_log     JSONB
);

-- ── Application Tracker ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tracker_entries (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID        NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  job_id             TEXT        NOT NULL,
  job_snapshot       JSONB       NOT NULL,
  status             TEXT        NOT NULL DEFAULT 'applied' CHECK (status IN (
    'applied','interviewing','offer','rejected','ghosted','saved'
  )),
  notes              TEXT,
  applied_at         TIMESTAMPTZ,
  last_status_change TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, job_id)
);

CREATE INDEX IF NOT EXISTS tracker_user_idx   ON public.tracker_entries (user_id, last_status_change DESC);

-- ── Salary Reports ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.salary_reports (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID        REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  role_title         TEXT        NOT NULL,
  years_experience   INT         NOT NULL,
  salary_egp         INT,
  salary_usd         INT,
  currency           TEXT        NOT NULL CHECK (currency IN ('EGP','USD','EUR','GBP')),
  employment_type    TEXT        CHECK (employment_type IN ('full-time','part-time','contract','freelance')),
  work_arrangement   TEXT        CHECK (work_arrangement IN ('onsite','remote','hybrid')),
  pipeline           TEXT        CHECK (pipeline IN ('local','global','visa')),
  reported_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reminder_sent_at   TIMESTAMPTZ,
  last_updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS salary_role_idx     ON public.salary_reports (role_title);
CREATE INDEX IF NOT EXISTS salary_exp_idx      ON public.salary_reports (years_experience);
CREATE INDEX IF NOT EXISTS salary_reported_idx ON public.salary_reports (reported_at DESC);

-- ── Cron Logs V2 ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cron_logs_v2 (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_fetched INT,
  duration_ms   INT,
  errors        TEXT[],
  source_health JSONB,
  trigger       TEXT        CHECK (trigger IN ('github_actions','vercel_cron','manual'))
);

-- ── ATS Submissions (HR self-serve) ─────────────────────────
CREATE TABLE IF NOT EXISTS public.ats_submissions (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name   TEXT        NOT NULL,
  ats_type       TEXT        NOT NULL CHECK (ats_type IN (
    'greenhouse','lever','ashby','workable','teamtailor',
    'breezy','smartrecruiters','bamboohr','jazzhr'
  )),
  slug           TEXT        NOT NULL,
  country        TEXT        NOT NULL,
  country_flag   TEXT        NOT NULL,
  city           TEXT,
  pipeline_visa    BOOLEAN   NOT NULL DEFAULT FALSE,
  pipeline_local   BOOLEAN   NOT NULL DEFAULT FALSE,
  pipeline_global  BOOLEAN   NOT NULL DEFAULT FALSE,
  submitter_email  TEXT,
  status         TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  test_result    JSONB,
  submitted_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at    TIMESTAMPTZ,
  reviewed_by    UUID        REFERENCES public.user_profiles(id)
);

-- ── App Config (single-row, cache invalidation timestamp) ───
CREATE TABLE IF NOT EXISTS public.app_config (
  id           INT         PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_cron_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed the config row on first run
INSERT INTO public.app_config (id, last_cron_at)
VALUES (1, NOW())
ON CONFLICT (id) DO NOTHING;
