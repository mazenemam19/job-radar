# 🎯 Job Radar v3.5

A personalized job-hunting dashboard tailored for a **Senior React/Next.js Engineer based in Egypt**. It automatically scrapes frontend engineering jobs across three pipelines and scores them against your specific technical profile.

---

## 🛤️ Pipelines

| Pipeline             | What it finds                                | Key Sources                                          |
| -------------------- | -------------------------------------------- | ---------------------------------------------------- |
| ✈️ **Visa Sponsors** | EU/UK hubs that sponsor visas + relocation   | Doctolib, Wallapop, Stripe, SumUp, Wolt, Moonfare    |
| 🇪🇬 **Local (Egypt)** | Cairo/Egypt companies hiring React devs      | Instabug, Bosta, Thndr, Nawy, Blink22, ArpuPlus      |
| 🌐 **Global Remote** | Worldwide remote companies friendly to GMT+2 | Vercel, Linear, GitLab, Netlify, RemoteOK, Himalayas |

---

## 🚀 Key Features

- **Multi-Tier Filtering**:
  1. **Regex Gate**: Fast local filtering for tech stack, seniority, and location-aware patterns (e.g., US-only, Hybrid).
  2. **Gemini LLM Tier**: Nuanced check for location alignment, BDS policy (Israel-related), and tech stack skew. Includes exact supporting quotes for transparency.
- **Market Intelligence**: Analyzes raw signals to identify skill demand, co-occurrence trends, and market gaps.
- **Source Health Diagnostics**: Real-time reliability tracking (Success/Total API calls) and granular filtering stats.
- **Unified Architecture**: Single source of truth for constants and modularized types for full consistency.

---

## 📊 Scoring & Selection

- **Skill match (60%)** — `React`, `TypeScript`, `Next.js`, `Tailwind`, `Vite`, etc.
- **Recency (30%)** — Strict **7-day auto-expiry**.
- **Relocation bonus (10%)** — Explicit relocation support.

---

## 🛠️ Architecture & Setup

- **Frontend**: Next.js 14, Tailwind CSS.
- **Backend**: Supabase PostgreSQL (JSONB) for storage.
- **AI**: Google Gemini fallback queue.
- **Database**: Create a `storage` table with `key` (text) and `data` (jsonb).

### Environment Variables (`.env.local`):

```env
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
GEMINI_API_KEY=...
CRON_SECRET=...
EMAIL_USER=...
EMAIL_PASS=...
EMAIL_TO=...
```

---

## 📜 Principles & Mandates

- **Strict Profile Alignment**: Only Senior React roles matching the Egypt-based profile are accepted.
- **Zero Duplication**: Centralized fetching ensures each company is hit only once per run.
- **Efficiency**: Concurrency limiting and health stat batching ensure network stability.
- **Transparency**: Every AI rejection must be accompanied by an exact quote from the job description.
