# 🎯 Job Radar

A high-fidelity job aggregator for **Senior Frontend Developers** (React/TypeScript). This tool targets global visa-sponsoring remote giants and high-growth Egyptian startups, using direct ATS APIs to bypass noisy aggregators and recruiters.

## 🚀 Current Status & Achievements

-   **High-Fidelity Filtering**: Successfully implemented strict filters to ensure only relevant Frontend roles are surfaced.
    -   **Blocked**: Fullstack, Tech Lead, Lead, Staff, Principal, Manager, Helpdesk/Support, and non-tech roles (Sales, Operations, Content Creation).
    -   **Target**: Senior Frontend developers with ~4-5 years of experience.
-   **Expanded ATS Support**: Scrapers are now unified and support 7 major platforms:
    -   **Greenhouse**, **Lever**, **Ashby**, **Workable (Widget API)**, **Teamtailor**, **Breezy HR**, and **SmartRecruiters**.
-   **Local Dashboard (Egypt)**: Monitors 11+ major Egyptian startups including **Bosta, Thndr, Nawy, Dubizzle, Yassir, Vezeeta, MaxAB, and Wasoko**.
-   **Visa/Remote Dashboard**: Monitors global remote giants like **GitLab, Speechify, Adyen, Intercom, and Contentful**.
-   **Remote Detection**: Integrated logic to detect remote status from titles and descriptions, with a dedicated **🌐 Remote** badge in the UI.
-   **Sponsorship Accuracy**: Refined logic to only mark jobs as "Visa ✓" if explicitly mentioned or part of a confirmed sponsorship pipeline.

## 🛠️ Key Features

-   **Direct Sourcing**: Pulls directly from company career boards (no LinkedIn/Wuzzuf noise).
-   **Automated Scoring**: Jobs are scored (0-100) based on:
    -   60% Skill Match (React, TypeScript, JavaScript, etc.)
    -   30% Recency
    -   10% Relocation/Visa mention
-   **Deduplication**: Automatically handles duplicate listings across multiple scans.
-   **Email Alerts**: Instant SMTP notifications for top-scoring new roles.

## 🏗️ Architecture

-   **Framework**: Next.js 14 (App Router)
-   **Language**: TypeScript
-   **Scrapers**: Unified pipeline in `src/lib/sources/ats-utils.ts`.
-   **Persistence**: JSON file storage (`data/jobs.json`) with a 500-job cap.
-   **Scheduling**: Cron-based fetching via `src/scripts/cron.ts`.

## 🚦 Getting Started

1.  **Install dependencies**: `pnpm install`
2.  **Environment**: Create `.env.local` (see `.env.local.example`).
3.  **Run Dashboard**: `pnpm dev`
4.  **Run Scan**: `pnpm run cron:now`

## 🧠 How It Works

1.  **Scan**: The runner iterates through verified slugs in `companies.ts` and `local-companies.ts`.
2.  **Scrape**: Unified fetchers hit JSON endpoints for Greenhouse, Lever, Workable, etc.
3.  **Filter**: Titles are checked against a strict blocklist (Lead, Fullstack, Support, etc.).
4.  **Score**: Descriptions are scanned for React/TS ecosystem keywords.
5.  **Display**: Dashboard sorts by score, showing match/missing skills and remote status.
