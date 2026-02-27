# 🎯 Job Radar

A precision job aggregator and scoring engine designed for **Senior Frontend Developers** (React/TypeScript).

Job Radar bypasses the noise of LinkedIn, Wuzzuf, and recruiter-heavy aggregators by scraping job data directly from 50+ company career portals. It automatically filters out irrelevant roles and scores every job against your specific tech stack.

## 🚀 The Mission

Frontend specialists shouldn't waste time on "Fullstack", "Tech Lead", or "Helpdesk" roles. This tool is built to:
1.  **Deep Signal Analysis**: Rejects generic "Software Engineer" titles if the description contains backend/infra signals (Kubernetes, SQL, Terraform, etc.).
2.  **Target Seniority**: Focuses on the ~5 years experience "sweet spot" (rejecting Lead, Principal, and Junior roles).
3.  **Timezone Guard**: Automatically rejects global remote roles restricted to US/Canada/EU residents, keeping only GMT+2 (Egypt) friendly listings.
4.  **Freshness Hard-Cap**: Strictly enforces a **14-day age limit**. If it's not fresh, it's not on the radar.

## 🛠️ Supported Platforms (8 ATS)

The system features a unified scraping pipeline supporting major Applicant Tracking Systems:
-   **Greenhouse** (`boards-api.greenhouse.io`)
-   **Lever** (`api.lever.co`)
-   **Ashby** (`api.ashbyhq.com`)
-   **Workable** (Optimized batch-fetching via Widget API)
-   **Teamtailor** (`{slug}.teamtailor.com`)
-   **Breezy HR** (`{slug}.breezy.hr`)
-   **SmartRecruiters** (`api.smartrecruiters.com`)
-   **BambooHR** (`{slug}.bamboohr.com`)

## 📊 How Scoring Works (0-100)

-   **60% Skill Match**: React, TypeScript, JavaScript, Redux, React Query, Material UI, Vite, Tailwind, Zustand, etc.
-   **30% Recency**: Newer jobs get higher priority; automatic expiry after 14 days.
-   **10% Bonuses**: Extra points for explicit mentions of "Relocation".

## 🏠 Monitoring Pipelines

### 1. Local Dashboard (Egypt Hub)
Verified fintech and high-growth startups: Bosta, Thndr, Nawy, Yassir, Dubizzle, Paymob, Halan, Breadfast, Khazna, Trella, and more.

### 2. Visa Dashboard (EU/UK)
Global giants known for sponsorship: GitLab, Adyen, Intercom, Contentful, Monzo, Revolut, Spotify, Klarna, Wise, and Deliveroo.

### 3. Global Dashboard (EMEA Remote)
World-class remote-first companies that hire from Egypt: Automattic, GitLab, Vercel, Linear, Buffer, Doist, Loom, and Remote.com.

## 💻 Tech Stack

-   **Frontend**: Next.js 14 (App Router), React, Tailwind CSS.
-   **Backend**: TypeScript, Node.js (Concurrent batch fetching for scrapers).
-   **Communication**: Nodemailer (SMTP) for instant new-job alerts.
-   **Data**: Flat JSON storage (`data/jobs.json`) with auto-deduplication.

## 🚦 Getting Started

1.  `pnpm install`
2.  Create `.env.local` (see `.env.local.example` for SMTP and Secret keys).
3.  `pnpm dev` to view the dashboard.
4.  `pnpm run cron:now` to trigger a global scan across all 3 pipelines.
