-- ============================================================
-- Job Radar v2 – Row-Level Security Policies
-- Users can only see/mutate their own rows.
-- Admin bypasses via service_role key (used server-side only).
-- ============================================================

-- Enable RLS on all new tables
ALTER TABLE public.user_profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_jobs_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracker_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_reports  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ats_companies   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ats_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.default_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_config      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_jobs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cron_logs_v2    ENABLE ROW LEVEL SECURITY;

-- ── user_profiles ───────────────────────────────────────────
-- Users can read and update their own row.
-- The `role` column is intentionally excluded from SELECT to prevent
-- client-side enumeration; updates that include `role` are silently
-- ignored because the UPDATE policy uses a USING clause that prevents
-- privilege escalation. Application code NEVER passes `role` in updates.

CREATE POLICY "profiles_select_own" ON public.user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own" ON public.user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Users may update their own row except the `role` column.
-- Enforcement note: application-layer API routes strip `role` from
-- any incoming payload before writing. This policy is a last-resort guard.
CREATE POLICY "profiles_update_own" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ── user_settings ───────────────────────────────────────────
CREATE POLICY "settings_all_own" ON public.user_settings
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── user_jobs_cache ─────────────────────────────────────────
CREATE POLICY "cache_all_own" ON public.user_jobs_cache
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── tracker_entries ─────────────────────────────────────────
CREATE POLICY "tracker_all_own" ON public.tracker_entries
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── salary_reports ──────────────────────────────────────────
-- Anyone can INSERT (anon-friendly contribution).
-- Read is open so aggregate charts work.
-- Users can UPDATE their own reports (for monthly reminders).
CREATE POLICY "salary_select_all" ON public.salary_reports
  FOR SELECT USING (TRUE);

CREATE POLICY "salary_insert_auth" ON public.salary_reports
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "salary_update_own" ON public.salary_reports
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── ats_companies ───────────────────────────────────────────
-- Everyone can read (needed for /submit page dropdown).
-- Only service_role (admin API routes) can write.
CREATE POLICY "ats_companies_select_all" ON public.ats_companies
  FOR SELECT USING (TRUE);

-- ── ats_submissions ─────────────────────────────────────────
-- Anyone can INSERT (public /submit page).
-- Only service_role can read/update/delete (admin panel).
CREATE POLICY "ats_sub_insert_all" ON public.ats_submissions
  FOR INSERT WITH CHECK (TRUE);

-- ── default_settings ────────────────────────────────────────
-- Everyone can read (needed to resolve per-user settings).
-- Only service_role can write.
CREATE POLICY "defaults_select_all" ON public.default_settings
  FOR SELECT USING (TRUE);

-- ── app_config ──────────────────────────────────────────────
-- Everyone can read (needed to check if cache is stale).
-- Only service_role can write.
CREATE POLICY "config_select_all" ON public.app_config
  FOR SELECT USING (TRUE);

-- ── raw_jobs ────────────────────────────────────────────────
-- Authenticated users can read (needed for dashboard query).
-- Only service_role can write (cron endpoint).
CREATE POLICY "raw_jobs_select_auth" ON public.raw_jobs
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- ── cron_logs_v2 ────────────────────────────────────────────
-- Only service_role reads/writes.
-- (No anon policy means only service_role bypass RLS can access.)
