# 🎯 Job Radar

A multi-tenant job-hunting dashboard. Anyone can sign in, configure their own
skill list, seniority preferences, and filtering rules, and get a personalized
feed of roles scraped across hundreds of ATS-listed companies — scored
against _their_ settings, not a hardcoded profile.

The scraper pulls every job a company posts, of any discipline, into the shared
pool. Every filtering decision (skills, seniority, excluded/required
keywords, blacklisted locations, Gemini's filter prompt) lives in
`/settings`, per user.

> 📐 For the full system breakdown — data model, request flows (auth, cron
> ingestion, per-user dashboard rebuild), the ATS ingestion layer, and the
> security model — see **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)**.

---

## ✨ Features

| Page         | What it's for                                                                                   |
| ------------ | ----------------------------------------------------------------------------------------------- |
| `/dashboard` | Personalized, scored job feed across all enabled pipelines                                      |
| `/pipeline`  | Funnel view of how many jobs survive each filtering stage                                       |
| `/tracker`   | Kanban-style tracker for applications (saved → applied → interviewing → offer/rejected/ghosted) |
| `/salary`    | Community-sourced salary explorer; submit your own anonymized data point                        |
| `/settings`  | Per-user skills, seniority, keyword rules, pipelines, and Gemini prompt                         |
| `/submit`    | Public form to suggest a new company to scrape                                                  |
| `/admin`     | Admin-only: users, companies, global defaults, pending submissions                              |

---

## 🛤️ Pipelines

Two pipelines, each independently toggleable per user in `/settings`:

| Pipeline      | What it finds                       |
| ------------- | ----------------------------------- |
| 🇪🇬 **Local**  | Egypt-based companies               |
| 🌐 **Global** | Worldwide remote-friendly companies |

Companies are sourced via Greenhouse, Lever, Ashby, Workable, Teamtailor,
Breezy, SmartRecruiters, BambooHR, and JazzHR. New companies can be submitted
publicly at `/submit` and approved by an admin at `/admin/submissions`.

---

## 🚀 How filtering actually works

Three stages, each cheaper than the next, so Gemini only ever sees jobs that
already cleared the free filters first:

1. **Date gate** — drops jobs older than `job_age_days` (per-user).
2. **Settings gate** — regex-based: seniority, excluded/required keywords,
   blacklisted locations, skill match — all against the user's own
   `/settings`, never a hardcoded list.
3. **Gemini gate** — the user's own Gemini API key evaluates what survived
   stage 2 against their own custom filter prompt, returning a pass/fail plus
   a short reason for each job. Fails open (a Gemini error doesn't silently
   lose a job).

Scoring after that: skill match, recency (always computed live, never frozen
at insert time), and relocation bonus — weights configurable per user.
**Bonus skills** ("nice to have," e.g. Docker/AWS) are shown but never scored.

Per-user results are cached (`user_jobs_cache`) and only recomputed when the
shared raw job pool is newer than the cache — most dashboard loads are
instant; only the first load after a cron run takes ~10-15s.

---

## ⏰ Scheduling

Two GitHub Actions workflows, both calling `/api/cron`:

- `.github/workflows/cron.yml` — the scrape, twice daily (09:00 + 16:00 UTC).
- `.github/workflows/salary-reminders.yml` — monthly (1st @ 09:00 UTC), runs
  `scripts/send-salary-reminders.ts` directly (not an API route).

Both require these repo secrets: `CRON_SECRET`, `VERCEL_PRODUCTION_URL`,
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SMTP_HOST`, `SMTP_PORT`,
`SMTP_USER`, `SMTP_PASS`.

For local/manual runs: `pnpm run cron` and `pnpm run salary-reminders`.

---

## 📧 Email alerts

Per-user opt-in (`/settings` → Email Alerts), two templates:

- **Scan complete** — sent after each cron run to eligible users. Generic
  notification that new jobs are available; no job listings included (users
  open the dashboard to see their personalized results).
- **Monthly salary reminder** — nudges users whose salary report is stale.

---

## 🛠️ Architecture & Setup

- **Frontend**: Next.js 14 (App Router), inline-style dark theme.
- **Auth**: Supabase Auth (Google OAuth), enforced for all protected routes
  via `middleware.ts`. Role (`user`/`admin`) is only ever set via direct
  database access — no API surface can grant it.
- **Backend**: Supabase Postgres. Key tables: `user_profiles`, `ats_companies`,
  `raw_jobs`, `user_jobs_cache`, `user_settings`, `default_settings`,
  `app_config`, `cron_logs_v2`, `ats_submissions`, `salary_reports`,
  `tracker_entries`.
- **AI**: Each user supplies their own Gemini API key (`user_profiles.gemini_api_key`).
- **Email**: Nodemailer via SMTP.

### Environment Variables (`.env.local`)

```env
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
CRON_SECRET=...
SMTP_HOST=...
SMTP_PORT=...
SMTP_USER=...
SMTP_PASS=...
NEXT_PUBLIC_APP_URL=...
```

### Scripts

- `pnpm run dev` / `build` / `start` / `lint`
- `pnpm run cron` — run the scrape once, locally.
- `pnpm run salary-reminders` — run the monthly salary reminder check once, locally.

### Admin

`/admin` (role-gated via `user_profiles.role = 'admin'`): overview stats,
user management, company management, global defaults, pending submissions,
and Workable rate-limit status (currently blocked slugs, configured budget).

---

## 📜 Principles

- **Per-user source of truth**: filtering decisions live in `/settings`,
  never hardcoded in the ingestion pipeline.
- **Cheap filters before expensive ones**: date → regex → Gemini, in that
  order, to keep Gemini token usage proportional to what's actually worth
  checking.
- **Transparency**: every Gemini decision returns a reason alongside its
  pass/fail; whether that reason includes a verbatim quote depends on how the
  filter prompt is written, since the prompt itself is per-user/admin
  configurable rather than fixed in code.

---

See **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)** for request-flow diagrams, the
full data model, and the security model behind all of the above.
