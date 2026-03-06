# 🎯 Job Radar v3.5

A personalized job-hunting intelligence engine tailored for a **Senior React/Next.js Engineer based in Egypt**. It automatically scrapes frontend engineering jobs across global tech hubs, local startups, and worldwide remote boards, scoring them against a specific technical profile.

---

## 🚀 Key Features

- **Multi-Tier Filtering**:
  1. **Regex Gate**: Fast local filtering for tech stack (React/Next.js required), seniority, and location-aware patterns (e.g., US-only, Hybrid).
  2. **Gemini LLM Tier**: Nuanced check for location alignment, BDS policy (Israel-related), and detailed tech skew. Includes exact supporting quotes for all rejections.
- **Market Intelligence**: A dedicated dashboard analyzing raw signals to identify skill demand, co-occurrence trends, and market gaps.
- **Source Health Diagnostics**: Real-time reliability tracking (Success/Total API calls) and granular filtering stats (Raw → Regex Pass → Gemini Reject → Total Active).
- **Unified Company Management**: A single source of truth in `companies.ts` drives all pipelines.
- **Comprehensive Scans**: Scans 100% of defined sources in every run (no rotation).

---

## 🛤️ Pipelines

| Pipeline             | What it finds                                           | Key Sources                                          |
| -------------------- | ------------------------------------------------------- | ---------------------------------------------------- |
| ✈️ **Visa Sponsors** | Companies in EU/UK hubs that sponsor visas + relocation | Doctolib, Wallapop, Stripe, SumUp, Wolt, Moonfare    |
| 🇪🇬 **Local (Egypt)** | Cairo/Egypt companies hiring React devs                 | Instabug, Bosta, Thndr, Nawy, Blink22, ArpuPlus      |
| 🌐 **Global Remote** | Worldwide remote companies friendly to GMT+2            | Vercel, Linear, GitLab, Netlify, RemoteOK, Himalayas |

---

## 📊 Scoring & Selection

Each job is scored 0–100 based on:

- **Skill match (60%)** — Core skills: `React`, `TypeScript`, `Next.js`, `Tailwind`, `Vite`, etc.
- **Recency (30%)** — Strict **7-day auto-expiry**. Jobs older than 1 week are dropped.
- **Relocation bonus (10%)** — Explicit relocation support mentioned.

**Note**: Jobs with 0 skill match score or those failing the strict title filters (Backend, DevOps, Intern, etc.) are **never shown**.

---

## 🛠️ Architecture

- **Frontend**: Next.js 15 (App Router), Tailwind CSS, Style-JSX.
- **Backend**: Supabase PostgreSQL (JSONB) for persistent storage of jobs, state, and reliability logs.
- **AI**: Google Gemini Pro/Flash fallback queue with 429-optimization.
- **Deployment**: Vercel with scheduled GitHub Actions triggers every 6 hours.

---

## 💾 Setup

### 1. Environment Variables

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

### 2. Supabase Table

Create a `storage` table:

```sql
CREATE TABLE storage (
  key TEXT PRIMARY KEY,
  data JSONB
);
```

### 3. Run Locally

```bash
pnpm install
pnpm dev
# Run a manual scan
pnpm cron:now
```

---

## 📜 Principles & Mandates

- **Strict Profile Alignment**: Only jobs matching the Senior React / Egypt-based profile are accepted.
- **Zero Duplication**: Centralized fetching ensures each company is hit only once per run.
- **Transparency**: Every AI rejection must be accompanied by an exact quote from the job description.
- **Rate Limiting**: `queueWorkable` and `pLimit` maintain safety to prevent IP blacklisting.
