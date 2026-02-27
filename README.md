# 🎯 Job Radar

A precision job aggregator and scoring engine designed for **Senior Frontend Developers** (React/TypeScript).

Job Radar bypasses the noise of LinkedIn, Wuzzuf, and recruiter-heavy aggregators by scraping job data directly from company career portals (ATS). It automatically filters out irrelevant roles and scores every job against your specific tech stack.

## 🚀 The Mission

Most job boards are flooded with "Fullstack", "Tech Lead", and "Support" roles that waste a Frontend specialist's time. This tool is built to:
1.  **Eliminate Noise**: Strictly filter out anything that isn't a pure Frontend role using title keywords and description signal analysis.
2.  **Target Seniority**: Focus on the ~4-5 years experience "sweet spot" (rejecting Junior, Lead, and Executive roles).
3.  **Verify Sourcing**: Hit direct ATS APIs to ensure listings are fresh and real.
4.  **Detect Remote**: Automatically identify work-from-home options and filter by timezone compatibility (GMT+2 friendly).

## 🛠️ Supported Platforms (ATS)

The system features a unified scraping pipeline supporting 8 major Applicant Tracking Systems:
-   **Greenhouse** (`boards-api.greenhouse.io`)
-   **Lever** (`api.lever.co`)
-   **Ashby** (`api.ashbyhq.com`)
-   **Workable** (`apply.workable.com` via Widget API)
-   **Teamtailor** (`{slug}.teamtailor.com`)
-   **Breezy HR** (`{slug}.breezy.hr`)
-   **SmartRecruiters** (`api.smartrecruiters.com`)
-   **BambooHR** (`{slug}.bamboohr.com`)

## 📊 How Scoring Works

Every job is analyzed and assigned a score from **0 to 100**:
-   **60% Skill Match**: Scans for React, TypeScript, JavaScript, Redux, React Query, Material UI, Vite, etc.
-   **30% Recency**: Newer jobs get significantly higher scores. Jobs older than **30 days** are automatically expired.
-   **10% Bonuses**: Extra points for explicit mentions of "Relocation".

## 🏠 Monitoring Pipelines

### 1. Local Dashboard (Egypt Hub)
Monitors high-growth startups and tech agencies in Egypt. 
*   **Active Scrapers**: Bosta, Thndr, Speechify (Egypt), Nawy, Yassir, Dubizzle.
*   **Monitoring**: Instabug, Vezeeta, MaxAB, Rubikal, Blink22, Robusta, and more.

### 2. Visa Dashboard
Monitors global "Remote Giants" known for visa sponsorship and relocation assistance:
*   **Verified**: GitLab, Speechify, Adyen, Intercom, Contentful, Monzo, N26, Typeform.

### 3. Global Dashboard (NEW)
Monitors worldwide remote-first companies that are timezone-compatible with Egypt (GMT+2). Includes a strict filter to reject roles restricted to US/Canada/UK/EU residents only.

## 💻 Tech Stack

-   **Frontend**: Next.js 14 (App Router), React, Tailwind CSS.
-   **Backend**: TypeScript, Node.js (TS-Node for scripts).
-   **Communication**: Nodemailer (SMTP) for instant job alerts (Visa pipeline only).
-   **Data**: Flat JSON storage (`data/jobs.json`) with auto-deduplication and 30-day expiry.

## 🚦 Getting Started

### 1. Installation
```bash
pnpm install
```

### 2. Configuration
Create a `.env.local` file based on `.env.local.example`:
- `SMTP_*`: Required for email alerts.
- `CRON_SECRET`: Secures the API trigger.

### 3. Usage
```bash
pnpm dev          # Start the dashboard UI at http://localhost:3000
pnpm run cron:now # Trigger an immediate global scan across all 3 pipelines
```

## 🧠 Adding a New Company

To add a new company, simply add an entry to the `COMPANIES` array in the corresponding file under `src/lib/sources/`:

```typescript
{ 
  ats: "greenhouse", 
  name: "MyCompany", 
  slug: "my-company-slug", 
  country: "Germany", 
  countryFlag: "🇩🇪" 
}
```
The unified pipeline in `ats-utils.ts` handles scraping, filtering, and scoring automatically.
