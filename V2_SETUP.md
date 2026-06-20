# Job Radar v2 — Setup Guide

This document covers every step needed to deploy the v2 SaaS layer alongside the existing app.
**The existing app is never touched.** All new code goes into new files.

---

## 1. Install new dependencies

```bash
# Core auth
pnpm add @supabase/ssr

# Charts (Milestone 2)
pnpm add recharts

# GSAP (Milestone 3 landing page)
pnpm add gsap

# Testing
pnpm add -D vitest @vitest/coverage-v8 @vitejs/plugin-react jsdom

# Script runner
pnpm add -D tsx
```

---

## 2. New environment variables

Your existing `.env.local` has `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
Add these two new keys (required for `@supabase/ssr` browser auth):

```bash
# Same value as SUPABASE_URL — the NEXT_PUBLIC_ prefix exposes it to the browser
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co

# The anon/public key from Supabase > Settings > API
# This is NOT the service role key — it's the safe public key
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Optional: set this for salary reminder and landing page CTA links
NEXT_PUBLIC_APP_URL=https://job-radar-v2.vercel.app
```

Also add to Vercel's Environment Variables dashboard.

---

## 3. Supabase: enable Google OAuth

1. Supabase dashboard → Authentication → Providers → Google → Enable
2. Go to [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials
3. Create an OAuth 2.0 Client ID (Web application)
4. Add Authorized redirect URIs:
   - `https://your-project.supabase.co/auth/v1/callback`
5. Copy the Client ID and Client Secret back into the Supabase Google provider settings

---

## 4. Run database migrations

Run these three files in order in your Supabase SQL editor
(**Dashboard → SQL Editor → New query → paste → Run**):

```
supabase/migrations/001_saas_tables.sql
supabase/migrations/002_rls_policies.sql
supabase/migrations/003_seed_defaults.sql
```

**Important:** Replace the Gemini filter prompt placeholder in `003_seed_defaults.sql`
with the exact prompt from `src/lib/gemini.ts` before running.

---

## 5. Seed ATS companies from ALL_COMPANIES

This one-time script reads the existing hardcoded `ALL_COMPANIES` array and
inserts every entry into the new `public.ats_companies` table.

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm exec tsx scripts/seed-ats-companies.ts
```

Expected output:

```
Seeding 795 companies into public.ats_companies...
  ✓ 100/795 inserted
  ✓ 200/795 inserted
  ...
Done. 795 companies seeded, 0 errors.
```

---

## 6. Set your admin role

After your first sign-in via `/v2/login`, make yourself admin in Supabase:

```sql
-- Run in Supabase SQL Editor
UPDATE public.user_profiles
SET role = 'admin'
WHERE email = 'your-email@gmail.com';
```

**This is the ONLY way to set the admin role.** There is no API endpoint for it.

---

## 7. Update vercel.json (add v2 cron)

Merge the v2 cron entry into your existing `vercel.json`.
**Do not remove the existing `/api/cron` entry.**

```json
{
  "crons": [
    { "path": "/api/cron", "schedule": "0 16 * * *" },
    { "path": "/api/v2/cron", "schedule": "0 9 * * *" }
  ]
}
```

---

## 8. Add GitHub Actions secret

Add `VERCEL_PRODUCTION_URL` to your GitHub repository secrets
(Settings → Secrets → Actions → New repository secret):

```
VERCEL_PRODUCTION_URL = https://job-radar-lyart.vercel.app
```

The existing `CRON_SECRET` is already in your secrets — no change needed.

---

## 9. Run tests

```bash
pnpm exec vitest run

# With coverage
pnpm exec vitest run --coverage
```

Expected output:

```
✓ src/lib/v2/__tests__/scoring.test.ts    (28 tests)
✓ src/lib/v2/__tests__/settings.test.ts   (6 tests)
✓ src/lib/v2/__tests__/runner.test.ts     (6 tests)
✓ src/lib/v2/__tests__/ats-bridge.test.ts (6 tests)

Test Files  4 passed (4)
Tests      46 passed (46)
```

---

## 10. File copy instructions

Copy all new files from this directory into your repo root,
**maintaining the exact same directory structure**.

New files created (none of these exist in the original repo):

```
src/middleware.ts                                    ← NEW
src/lib/v2/types.ts                                 ← NEW
src/lib/v2/supabase/server.ts                       ← NEW
src/lib/v2/supabase/client.ts                       ← NEW
src/lib/v2/supabase/admin.ts                        ← NEW
src/lib/v2/settings.ts                              ← NEW
src/lib/v2/scoring.ts                               ← NEW
src/lib/v2/gemini.ts                                ← NEW
src/lib/v2/email.ts                                 ← NEW
src/lib/v2/runner.ts                                ← NEW
src/lib/v2/ats-bridge.ts                            ← NEW
src/lib/v2/__tests__/scoring.test.ts                ← NEW
src/lib/v2/__tests__/settings.test.ts               ← NEW
src/lib/v2/__tests__/runner.test.ts                 ← NEW
src/lib/v2/__tests__/ats-bridge.test.ts             ← NEW
src/app/auth/v2/callback/route.ts                   ← NEW
src/app/api/v2/cron/route.ts                        ← NEW
src/app/api/v2/dashboard/route.ts                   ← NEW
src/app/api/v2/tracker/route.ts                     ← NEW
src/app/api/v2/tracker/[id]/route.ts                ← NEW
src/app/api/v2/salary/route.ts                      ← NEW
src/app/api/v2/settings/route.ts                    ← NEW
src/app/api/v2/submit/route.ts                      ← NEW
src/app/api/v2/strategy/route.ts                    ← NEW
src/app/api/v2/admin/users/route.ts                 ← NEW
src/app/api/v2/admin/users/[id]/route.ts            ← NEW
src/app/api/v2/admin/companies/route.ts             ← NEW
src/app/api/v2/admin/companies/[id]/route.ts        ← NEW
src/app/api/v2/admin/defaults/route.ts              ← NEW
src/app/api/v2/admin/submissions/route.ts           ← NEW
src/app/api/v2/admin/submissions/[id]/route.ts      ← NEW
src/app/api/v2/admin/test-ats/route.ts              ← NEW
src/app/v2/layout.tsx                               ← NEW
src/app/v2/page.tsx                                 ← NEW (landing)
src/app/v2/login/page.tsx                           ← NEW
src/app/v2/onboarding/page.tsx                      ← NEW
src/app/v2/dashboard/page.tsx                       ← NEW
src/app/v2/pipeline/page.tsx                        ← NEW
src/app/v2/tracker/page.tsx                         ← NEW
src/app/v2/salary/page.tsx                          ← NEW
src/app/v2/settings/page.tsx                        ← NEW
src/app/v2/admin/layout.tsx                         ← NEW
src/app/v2/admin/page.tsx                           ← NEW
src/app/v2/admin/users/page.tsx                     ← NEW
src/app/v2/admin/companies/page.tsx                 ← NEW
src/app/v2/admin/defaults/page.tsx                  ← NEW
src/app/v2/admin/submissions/page.tsx               ← NEW
src/app/submit/page.tsx                             ← NEW
src/components/v2/layout/AppShell.tsx               ← NEW
src/components/v2/dashboard/JobCard.tsx             ← NEW
src/components/v2/dashboard/DashboardClient.tsx     ← NEW
src/components/v2/dashboard/StrategyModal.tsx       ← NEW
src/components/v2/tracker/TrackerModal.tsx          ← NEW
src/components/v2/tracker/TrackerPage.tsx           ← NEW
src/components/v2/pipeline/FunnelView.tsx           ← NEW
src/components/v2/salary/SalaryPage.tsx             ← NEW
src/components/v2/admin/AdminComponents.tsx         ← NEW
src/components/v2/onboarding/OnboardingFlow.tsx     ← NEW
src/components/v2/settings/SettingsForm.tsx         ← NEW
supabase/migrations/001_saas_tables.sql             ← NEW
supabase/migrations/002_rls_policies.sql            ← NEW
supabase/migrations/003_seed_defaults.sql           ← NEW
scripts/seed-ats-companies.ts                       ← NEW
scripts/send-salary-reminders.ts                    ← NEW
vitest.config.ts                                    ← NEW
.github/workflows/cron-v2.yml                       ← NEW
```

**Files that must NOT be touched:**

- Anything in `src/lib/` not under `src/lib/v2/`
- Anything in `src/app/api/cron/`
- `src/components/JobCard.tsx`
- `.github/workflows/cron.yml`
- `vercel.json` (merge, don't replace)

---

## Architecture notes

### "Lazy C" cache model

- **Cron** (`/api/v2/cron`): fetches all raw jobs → writes to `raw_jobs` → bumps `app_config.last_cron_at`
- **Dashboard** (`/api/v2/dashboard`): on load, compares `user_jobs_cache.cached_at` vs `app_config.last_cron_at`
  - If fresh → return cached jobs instantly
  - If stale → run Gemini with user's key and prompt → score → cache → return
- First load after cron = 10-15s (Gemini). Every subsequent load = instant.

### Security invariants

- `user_profiles.role` defaults to `'user'` for every new signup
- No API endpoint can change `role` — only direct Supabase service_role access
- All admin API routes check role at the server level (not just middleware)
- Middleware is defense-in-depth, not the sole gate

### Bug fixes applied

- **#3** `JobCard`: `recency_score` is computed live from `posted_at` on every render
- **#4** Email: fires for all modes (visa + local + global), not just visa
- **#5** `fetchedAt` used as `postedAt` when `parseRelativeDate` returned "now" as fallback; `date_unknown = true` set
- **#6** `recencyScore` computed independently of skill gate; `mergeJobs` gates on `total_score > 0`
- **Regex**: `STAFF_KEYWORDS = /\b(lead|staff|principal|architect|director|vp|head)\b/i`

---

## Monthly salary reminders

Add this as a separate monthly GitHub Actions workflow:

```yaml
# .github/workflows/salary-reminders.yml
on:
  schedule:
    - cron: "0 10 1 * *" # 1st of every month at 10:00 UTC
jobs:
  remind:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install
      - run: pnpm exec tsx scripts/send-salary-reminders.ts
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          SMTP_HOST: ${{ secrets.SMTP_HOST }}
          SMTP_PORT: ${{ secrets.SMTP_PORT }}
          SMTP_USER: ${{ secrets.SMTP_USER }}
          SMTP_PASS: ${{ secrets.SMTP_PASS }}
```

---

## Routes summary

| Route                   | Auth             | Description                   |
| ----------------------- | ---------------- | ----------------------------- |
| `/v2`                   | Public           | Landing page with demo        |
| `/v2/login`             | Public           | Google OAuth                  |
| `/v2/onboarding`        | Auth             | Gemini key + profile setup    |
| `/v2/dashboard`         | Auth + Onboarded | AI-filtered job feed          |
| `/v2/pipeline`          | Auth + Onboarded | Pipeline funnel visualisation |
| `/v2/tracker`           | Auth + Onboarded | Application tracker           |
| `/v2/salary`            | Auth + Onboarded | Salary crowdsourcing          |
| `/v2/settings`          | Auth + Onboarded | Edit all preferences          |
| `/v2/admin`             | Admin only       | Admin overview                |
| `/v2/admin/users`       | Admin only       | User management               |
| `/v2/admin/companies`   | Admin only       | ATS companies CRUD            |
| `/v2/admin/defaults`    | Admin only       | Default settings CRUD         |
| `/v2/admin/submissions` | Admin only       | ATS submissions review        |
| `/submit`               | Public           | HR ATS submission form        |
