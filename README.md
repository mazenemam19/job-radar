# 🎯 Job Radar v3.5

A personal job-hunting dashboard that automatically scrapes frontend engineering jobs across three pipelines and scores them against your React/TypeScript skillset. Tailored for a **Senior React/Next.js Engineer based in Egypt**.

---

## 🛤️ Pipelines

| Pipeline             | What it finds                                   | Key Sources                                                 |
| -------------------- | ----------------------------------------------- | ----------------------------------------------------------- |
| ✈️ **Visa Sponsors** | EU/UK companies that sponsor visas + relocation | Doctolib, Wallapop, Stripe, SumUp, Wolt, Moonfare, +60 more |
| 🇪🇬 **Local (Egypt)** | Cairo/Egypt companies hiring React devs         | Instabug, Bosta, Thndr, Nawy, Dubizzle, Paymob, +more       |
| 🌐 **Global Remote** | Worldwide remote companies friendly to GMT+2    | Vercel, Linear, GitLab, Netlify, RemoteOK, Himalayas, +more |

---

## 🚀 Key Features

- **Multi-Tier Filtering**:
  1. **Regex Gate**: Fast local filtering for tech stack (React/Next.js required), seniority, and location-aware patterns (e.g., US-only, Hybrid).
  2. **Gemini LLM Tier**: Nuanced check for location alignment, BDS policy (Israel-related), and detailed tech skew. Includes exact supporting quotes for all rejections.
- **Market Intelligence**: A dedicated dashboard analyzing raw signals to identify skill demand, co-occurrence trends, and market gaps.
- **Source Health Diagnostics**: Real-time reliability tracking (Success/Total API calls) and granular filtering stats (Raw → Regex Pass → Gemini Reject → Total Active).
- **Unified Company Management**: A single source of truth in `companies.ts` drives all pipelines.
- **Comprehensive Scans**: Scans 100% of defined sources in every run (no rotation/batching).

---

## 📊 Scoring

Each job is scored 0–100 based on:

- **Skill match (60%)** — how many of your expert skills (`React`, `TypeScript`, `Next.js`, `Tailwind`, etc.) appear in the JD.
- **Recency (30%)** — strict **7-day auto-expiry**. Jobs older than 1 week are dropped.
- **Relocation bonus (10%)** — explicit relocation support mentioned.

Jobs with 0 skill match score are **never shown**. Jobs failing strict title filters (Backend, DevOps, Android, Intern, etc.) are auto-rejected.

---

## 🛠️ Architecture

- **Frontend**: Next.js 15 (App Router), Tailwind CSS, Lucide Icons.
- **Backend**: Supabase PostgreSQL (JSONB) for persistent storage of jobs, state, and reliability logs.
- **AI**: Google Gemini Pro/Flash fallback queue with 429-optimization and rejection quoting.
- **Deployment**: Vercel with scheduled GitHub Actions triggers every 6 hours.

---

## 💾 Setup

### 1. Clone & install

```bash
git clone <your-repo>
cd job-radar
pnpm install
```

### 2. Environment variables

Create `.env.local`:

```env
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
GEMINI_API_KEY=...
CRON_SECRET=...
EMAIL_USER=...
EMAIL_PASS=...
EMAIL_TO=...
```

### 3. Database

Create a `storage` table in Supabase:

```sql
CREATE TABLE storage (
  key TEXT PRIMARY KEY,
  data JSONB
);
```

---

## 📂 File Structure

```
src/
├── app/
│   ├── api/
│   │   ├── cron/route.ts       ← Runner (GET=Vercel cron, POST=dashboard button)
│   │   └── jobs/[id]/route.ts  ← Single job API
│   ├── market/                 ← Market Intelligence Dashboard
│   └── analysis/               ← Source Health Diagnostics
├── components/                 ← Shared UI (Dashboard, JobCard, HealthTable)
└── lib/
    ├── runner.ts               ← Orchestrates pipelines & Gemini filtration
    ├── scoring.ts              ← Tech gate, title filters, score calculation
    ├── storage.ts              ← Supabase JSONB read/write, 7-day cleanup
    ├── health-store.ts         ← Persistent reliability tracking
    └── sources/
        ├── companies.ts        ← Single source of truth for company list
        ├── ats-utils.ts        ← Fetchers for Greenhouse, Lever, Ashby, Workable, etc.
        └── wp-startup-jobs.ts  ← Custom WordPress board fetchers
```

---

## 📜 Principles & Mandates

- **Strict Profile Alignment**: Only Senior React roles matching the Egypt-based profile are accepted.
- **Zero Duplication**: Centralized fetching ensures each company is hit only once per run.
- **Transparency**: Every AI rejection must be accompanied by an exact quote from the job description.
- **Rate Limiting**: `queueWorkable` maintains randomized delays to prevent IP blacklisting.
- **Notes on Empty Results**: If a pipeline shows 0 jobs, it means sources genuinely have no fresh React openings ≤7 days old.
