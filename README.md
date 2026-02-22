# 🎯 Job Radar

> Personal job matching dashboard — finds relocation-friendly, visa-sponsored tech roles that match your CV, ranked by match score + recency.

![Dashboard Preview](https://placeholder.com/preview)

---

## Features

- **Smart Matching** — weighted skill scoring against your CV profile (React, TypeScript, Redux, etc.)
- **Visa & Relocation Detection** — auto-detects sponsorship and relocation keywords in job descriptions
- **Multi-source** — fetches from Adzuna (10 countries) + Reed (UK)
- **Ranked Feed** — score formula: 60% skill match + 30% recency + 10% visa/relocation bonus
- **Cron Scheduler** — runs every 6 hours automatically, emails you top new matches
- **Filters** — by country, score threshold, visa-only, relocation-only, free-text search
- **Pagination** — keeps up to 500 jobs in local storage

---

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env.local
```

Then fill in `.env.local`:

| Variable | Where to get it |
|---|---|
| `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` | [developer.adzuna.com](https://developer.adzuna.com) — free account |
| `REED_API_KEY` | [reed.co.uk/developers](https://www.reed.co.uk/developers/jobseeker) — free account |
| `SMTP_USER` / `SMTP_PASS` | Gmail: enable 2FA → [App Passwords](https://myaccount.google.com/apppasswords) |
| `NOTIFY_TO` | Your email address |
| `CRON_SECRET` | Any random string (e.g. `openssl rand -hex 16`) |

### 3. Start the app

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

### 4. Fetch your first batch of jobs

**Option A — via the UI:**  
Click **"Sync Now"** in the header, enter your `CRON_SECRET` when prompted.

**Option B — via CLI:**  
```bash
npm run cron:now
```

---

## Cron Setup

### Option A — Keep Node running (simplest)
```bash
npm run cron
```
Runs every 6 hours, fetches jobs, sends email if new matches found.

### Option B — System cron (recommended for servers / always-on machines)
```bash
crontab -e
```
Add:
```
0 */6 * * * cd /path/to/job-radar && npm run cron:now >> logs/cron.log 2>&1
```

### Option C — Vercel Cron Jobs (if deploying to Vercel)
Add to `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron?secret=YOUR_CRON_SECRET",
    "schedule": "0 */6 * * *"
  }]
}
```

---

## Tuning Your Profile

Edit `src/lib/cv-profile.ts` to:
- Add/remove **target countries**
- Adjust **skill weights** (3 = expert, 2 = proficient, 1 = familiar)
- Change **search titles** (what gets queried on job boards)
- Add custom **visa/relocation keywords**

---

## Scoring Formula

```
totalScore = (skillScore × 0.60) + (recencyScore × 0.30) + visaBonus + relocationBonus
```

| Component | Max | Notes |
|---|---|---|
| Skill match | 60 | Weighted by your proficiency level |
| Recency | 30 | Posted today = 30pts, 60+ days = 0pts |
| Visa sponsorship | 5 | Detected from description keywords |
| Relocation package | 5 | Detected from description keywords |

---

## Project Structure

```
job-radar/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Entry point
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   └── api/
│   │       ├── jobs/route.ts     # GET /api/jobs (filtered, paginated)
│   │       └── cron/route.ts     # POST /api/cron (trigger fetch)
│   ├── components/
│   │   └── Dashboard.tsx         # Full UI
│   ├── lib/
│   │   ├── cv-profile.ts         # ← YOUR PROFILE — edit this!
│   │   ├── matcher.ts            # Skill scoring algorithm
│   │   ├── fetcher.ts            # Adzuna + Reed API clients
│   │   ├── storage.ts            # JSON file read/write
│   │   └── mailer.ts             # Email notifications
│   └── types/
│       └── index.ts
├── scripts/
│   └── cron.ts                   # Standalone cron runner
├── data/
│   └── jobs.json                 # Local job store (auto-created)
└── .env.example
```

---

## API Reference

### `GET /api/jobs`

| Param | Type | Description |
|---|---|---|
| `country` | `string` | Filter by country code (e.g. `GB`, `US`) |
| `minScore` | `number` | Minimum total score (0–100) |
| `visaOnly` | `boolean` | Only show visa-sponsored jobs |
| `relocationOnly` | `boolean` | Only show jobs with relocation |
| `search` | `string` | Free text search (title, company, location) |
| `page` | `number` | Page number (default: 1) |
| `limit` | `number` | Results per page (default: 30) |

### `POST /api/cron`

Header: `x-cron-secret: YOUR_SECRET`  
Triggers a full job fetch and upsert. Returns `{ added, updated, skipped, total }`.

---

## Tips

- **First run is slow** — Adzuna fetches 10 countries × 3 titles × 2 pages = 60 API calls
- **Rate limits** — both APIs have generous free tiers (Adzuna: 250 calls/day, Reed: unlimited read)
- **Job cap** — only the top 500 scoring jobs are kept to avoid unbounded growth
- **Email threshold** — email only sends when new jobs are added (not on re-runs with no changes)
