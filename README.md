# 🎯 Job Radar

A personal job-hunting dashboard that automatically scrapes frontend engineering jobs across three pipelines and scores them against your React/TypeScript skillset. Runs daily at **6pm Cairo time** via Vercel Cron.

---

## Pipelines

| Pipeline | What it finds | Companies |
|----------|--------------|-----------|
| 🌍 **Visa Sponsors** | EU companies that sponsor visas + relocation | Doctolib, Wallapop, Stripe, SumUp, Wolt, +60 more |
| 🇪🇬 **Local (Egypt)** | Cairo/Egypt companies hiring React devs | Instabug, Bosta, Thndr, Nawy, Dubizzle, Paymob, +more |
| 🌐 **Global Remote** | Worldwide remote companies friendly to GMT+2 | GitLab, Automattic, Netlify, Vercel, Linear, Zapier, +more |

---

## Scoring

Each job is scored 0–100 based on:

- **Skill match (60%)** — how many of your expert/proficient skills appear in the JD
- **Recency (30%)** — freshness (max 7 days old, after that dropped)
- **Relocation bonus (10%)** — explicit relocation support mentioned

Your core skills checked: `React`, `TypeScript`, `JavaScript`, `HTML`, `CSS`, `Redux`, `React Query`, `Next.js`, `Tailwind`, `Vite`, `Material UI`, and more.

Jobs with 0 skill match score are **never shown**. Jobs older than **7 days** are auto-dropped.

---

## Filters Applied

1. **Title filter** — rejects backend, DevOps, Android, MLOps, compliance, hardware, marketing ops, intern roles, etc.
2. **Backend description guard** — generic "Software Engineer" titles get description-scanned for infra signals (Kafka, Kubernetes, Terraform…)
3. **Clearance filter** — rejects "must be US citizen / right to work in UK" etc.
4. **Timezone filter** (global only) — rejects US-timezone-only roles

---

## Setup

### 1. Clone & install
```bash
git clone <your-repo>
cd job-radar
npm install
```

### 2. Environment variables
Create `.env.local`:
```env
CRON_SECRET=your-random-secret-here
EMAIL_USER=youremail@gmail.com
EMAIL_PASS=your-gmail-app-password
EMAIL_TO=youremail@gmail.com
```

### 3. Run locally
```bash
npm run dev
# Dashboard at http://localhost:3000
```

### 4. Deploy to Vercel
```bash
vercel deploy
```
- Add the same env vars in Vercel dashboard → Settings → Environment Variables
- The `vercel.json` already configures the daily cron at **4pm UTC (6pm Cairo)** ✅
- Set `CRON_SECRET` in Vercel env — Vercel sends it automatically as `Authorization: Bearer <secret>`

---

## File Structure

```
src/
├── app/
│   ├── api/
│   │   ├── cron/route.ts       ← Daily runner (GET=Vercel cron, POST=dashboard button)
│   │   └── jobs/[id]/route.ts  ← Single job API for detail page
│   ├── job/[id]/page.tsx       ← Job detail page
│   └── page.tsx                ← Dashboard (3 tabs: Visa / Local / Global)
├── components/
│   └── JobCard.tsx             ← Job card with score ring, skill chips, detail nav
└── lib/
    ├── runner.ts               ← Orchestrates all 3 pipelines
    ├── scoring.ts              ← Skill matching, title filters, score calculation
    ├── storage.ts              ← jobs.json read/write, 7-day cleanup
    ├── email.ts                ← Gmail alert for new visa jobs
    └── sources/
        ├── companies.ts        ← EU visa sponsor company list (~65 companies)
        ├── local-companies.ts  ← Egyptian company list
        ├── global-companies.ts ← Global remote company list
        └── ats-utils.ts        ← Fetchers for Greenhouse, Lever, Ashby, Workable, BambooHR, SmartRecruiters
vercel.json                     ← Cron: daily at 4pm UTC (6pm Cairo)
```

---

## Adding Companies

Edit the relevant source file and add a line:
```ts
{ ats: "greenhouse", name: "Acme Corp", slug: "acmecorp", country: "Germany", countryFlag: "🇩🇪" }
```

Supported ATS platforms: `greenhouse`, `lever`, `ashby`, `workable`, `bamboohr`, `smartrecruiters`, `teamtailor`, `breezy`

---

## Notes on Local Pipeline Empty Results

If local shows 0 jobs, it means Egyptian companies genuinely have no fresh React openings that week — not a bug. The pipeline scrapes live ATSs, applies the same title/skill filters, and only keeps jobs ≤7 days old.
