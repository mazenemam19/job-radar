# Job Radar — Setup Guide

This was a migration guide for moving from a single-user tool to the current
multi-tenant system. That migration is complete — this is now the from-scratch
setup guide for the app as it exists today. (Previously `V2_SETUP.md` — renamed
since "v2" isn't a meaningful distinction anymore; this is just the app.)

---

## 1. Install dependencies

```bash
pnpm install
```

Notable dependencies beyond the Next.js defaults: `@supabase/ssr` (auth),
`recharts` (charts), `gsap` (landing page animation), `dompurify` (sanitizing
job descriptions before rendering), `nodemailer` (email), `ts-node` (running
standalone scripts), `vitest` (tests).

---

## 2. Environment variables

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...

# Required for browser-side auth (@supabase/ssr)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...   # the anon/public key, NOT the service role key

CRON_SECRET=...
SMTP_HOST=...
SMTP_PORT=...
SMTP_USER=...
SMTP_PASS=...

# Used as the base for email links (salary reminders, job alerts) and the
# landing page's CTA. Set this to your real deployed domain.
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

Add the same variables to Vercel's Environment Variables dashboard for production.

---

## 3. Supabase: enable Google OAuth

1. Supabase dashboard → Authentication → Providers → Google → Enable
2. [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials
3. Create an OAuth 2.0 Client ID (Web application)
4. Add Authorized redirect URIs:
   - `https://your-project.supabase.co/auth/v1/callback`
5. Copy the Client ID/Secret into the Supabase Google provider settings
6. **Critical, easy to miss:** Supabase dashboard → Authentication → URL
   Configuration → Redirect URLs. Add `http://localhost:3000/auth/callback`
   for local dev and `https://your-domain.com/auth/callback` for production.
   If this is missing, sign-in silently fails — Supabase redirects to the
   bare Site URL with an unexchanged `?code=...` instead of `/auth/callback`.

---

## 4. Database migrations

Run in order, in the Supabase SQL editor:

```
supabase/migrations/001_saas_tables.sql
supabase/migrations/002_rls_policies.sql
supabase/migrations/003_seed_defaults.sql
supabase/migrations/004_dynamic_filters.sql
```

Then these two, added this session:

```sql
-- Workable rate-limit persistence (previously file-based, didn't survive
-- across serverless invocations)
ALTER TABLE app_config
  ADD COLUMN IF NOT EXISTS workable_blocked jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS workable_budget jsonb DEFAULT '{"visa":999,"global":999,"local":999}'::jsonb;

-- Per-user email alert opt-in
ALTER TABLE default_settings
  ADD COLUMN IF NOT EXISTS email_alerts_enabled boolean DEFAULT true;
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS email_alerts_enabled boolean;
```

**Important:** replace the Gemini filter prompt placeholder in
`003_seed_defaults.sql` with the real default prompt from `src/lib/gemini.ts`
before running, if you haven't already.

---

## 5. Seed ATS companies

Companies can be added one at a time via `/admin/companies`, or in bulk via a
seed script if you have one (the original `scripts/seed-ats-companies.ts` was
a one-time migration script and no longer exists in this repo — it served its
purpose and was removed). Companies can also arrive via the public `/submit`
form, reviewed at `/admin/submissions`.

---

## 6. Set your admin role

After your first sign-in:

```sql
UPDATE public.user_profiles
SET role = 'admin'
WHERE email = 'your-email@gmail.com';
```

**This is the only way to set the admin role.** No API endpoint does it —
deliberately, so it can't be done by anything except direct DB access.

---

## 7. Scheduling

Two GitHub Actions workflows, no Vercel native cron (deliberately consolidated
this session — Vercel's cron and a GitHub Actions workflow were previously
both firing at the same time with no dedup guard, double-running the scrape
every day):

- **`.github/workflows/cron.yml`** — the scrape. `0 9 * * *` and `0 16 * * *`
  (twice daily).
- **`.github/workflows/salary-reminders.yml`** — `0 9 1 * *` (monthly).

Required repo secrets (Settings → Secrets → Actions):

```
CRON_SECRET
VERCEL_PRODUCTION_URL
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SMTP_HOST
SMTP_PORT
SMTP_USER
SMTP_PASS
```

For local/manual runs:

```bash
pnpm run cron               # the scrape, once
pnpm run salary-reminders    # the monthly reminder check, once
```

---

## 8. Run tests

```bash
pnpm exec vitest run
```

Expected: 4 test files, 65 tests passing (`scoring`, `settings`, `runner`, `ats-bridge`).

---

## Architecture notes

### Filtering funnel

Date gate → settings gate (regex, per-user) → Gemini gate (per-user API key
and prompt) → scoring. See `README.md` for the full breakdown. The ingestion
layer (`processJobs` in `ats-utils.ts`) does **not** filter by role/seniority
— that decision belongs entirely to each user's `/settings`, not the scraper.
(This wasn't always true — a hardcoded title filter used to run at ingestion,
silently overriding every user's settings before they were ever consulted.
Removed this session.)

### "Lazy" cache model

- Cron writes raw jobs to `raw_jobs`, bumps `app_config.last_cron_at`.
- Dashboard load compares `user_jobs_cache.cached_at` vs `last_cron_at`.
  Fresh → instant return. Stale → re-run the funnel, re-cache.
- First load after a cron run: ~10-15s (Gemini). Every load after that: instant.

### Security invariants

- `user_profiles.role` defaults to `'user'` for every signup.
- No API endpoint can change `role` — service-role DB access only.
- Admin API routes check role server-side, not just in middleware.

### Workable rate limiting

Budget config and blocked-slugs-from-429s persist in `app_config` (Supabase),
loaded once at the start of each cron run and flushed back at the end. Viewable
read-only on `/admin`. This used to live in `/tmp` JSON files and a plain
in-memory variable — neither survives across serverless invocations, so it
silently reset on every single run. Fixed this session.

---

## Routes

| Route                | Auth             | Description                |
| -------------------- | ---------------- | -------------------------- |
| `/`                  | Public           | Landing page               |
| `/login`             | Public           | Google OAuth               |
| `/onboarding`        | Auth             | Gemini key + profile setup |
| `/dashboard`         | Auth + Onboarded | AI-filtered job feed       |
| `/pipeline`          | Auth + Onboarded | Funnel visualisation       |
| `/tracker`           | Auth + Onboarded | Application tracker        |
| `/salary`            | Auth + Onboarded | Salary crowdsourcing       |
| `/settings`          | Auth + Onboarded | Edit all preferences       |
| `/job/[id]`          | Auth + Onboarded | Job detail page            |
| `/admin`             | Admin only       | Overview + Workable status |
| `/admin/users`       | Admin only       | User management            |
| `/admin/companies`   | Admin only       | ATS companies CRUD         |
| `/admin/defaults`    | Admin only       | Global default settings    |
| `/admin/submissions` | Admin only       | ATS submission review      |
| `/submit`            | Public           | HR company submission form |
