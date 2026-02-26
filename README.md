# 🎯 Job Radar

Frontend developer jobs with visa sponsorship — auto-scored against your CV. This application targets known visa-sponsoring companies and high-growth Egyptian tech startups using their direct ATS APIs (Greenhouse, Lever, Ashby).

## Table of Contents

-   [Overview](#overview)
-   [Architecture](#architecture)
-   [Core Technologies](#core-technologies)
-   [Key Features](#key-features)
-   [Two Pipelines](#two-pipelines)
-   [Setup Instructions](#setup-instructions)
-   [Running the Application](#running-the-application)
-   [Triggering Cron Jobs via API](#triggering-cron-jobs-via-api)
-   [Environment Variables](#environment-variables)
-   [How It Works](#how-it-works)

## Overview

Job Radar is a Next.js application designed to help frontend developers find high-quality jobs. It automates the process of sourcing jobs directly from company career boards, filtering out irrelevant roles, and scoring them against a specific frontend skill set.

## Architecture

The application follows a standard Next.js architecture, leveraging API routes for backend logic and React components for the frontend.

-   **Frontend:** Built with React and Next.js, styled with Tailwind CSS. Dashboard displays jobs sorted by score.
-   **Backend (API Routes):** Handled by Next.js API routes under `src/app/api`.
-   **Core Logic:** Centralized in `src/lib`, encompassing modules for email (`email.ts`), task running (`runner.ts`), scoring (`scoring.ts`), and data storage (`storage.ts`).
-   **Scrapers:** Direct ATS API integration (Greenhouse, Lever, Ashby) in `src/lib/sources/`.
-   **Background Processes:** Critical tasks are managed by cron jobs, defined in `src/scripts/cron.ts` and triggered via API routes (`src/app/api/cron/route.ts`).

## Core Technologies

-   **Framework:** Next.js 14 (App Router)
-   **Language:** TypeScript
-   **Styling:** Tailwind CSS
-   **Email:** Nodemailer
-   **Scheduling:** node-cron (local) / Vercel Cron (API)
-   **Persistence:** JSON file storage (`data/jobs.json`)

## Key Features

-   **Direct Sourcing:** No aggregators; jobs are pulled directly from company career boards.
-   **Automated Scoring:** Each job is scored based on:
    -   60% Skill Match (React, TypeScript, etc.)
    -   30% Recency
    -   10% Relocation Bonus
-   **Smart Filtering:** Rejects non-frontend roles, overly senior positions (Staff/Principal), and roles requiring specific citizenship/clearance.
-   **Email Notifications:** Instant alerts for brand-new visa-mode jobs.
-   **Deduplication:** Handles same jobs appearing via different ATS slugs or duplicate runs.

## Two Pipelines

1.  **Visa Mode:** Remote or onsite jobs at known visa-sponsoring companies (e.g., Adyen, Monzo, N26, Intercom). All jobs here are assumed to support visa sponsorship.
2.  **Local Mode:** High-growth tech companies in Egypt (e.g., Paymob, Thndr, Breadfast). These are primarily for local market visibility.

## Setup Instructions

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd job-radar
    ```
2.  **Install dependencies:**
    ```bash
    pnpm install
    ```
3.  **Configure environment variables:**
    Copy the example environment file and update it with your specific keys:
    ```bash
    cp .env.local.example .env.local
    ```
    Edit the newly created `.env.local` file. Refer to the [Environment Variables](#environment-variables) section for details.

## Running the Application

-   **Start the development server:**
    ```bash
    pnpm dev                 # Starts the dashboard at http://localhost:3000
    ```
-   **Run an immediate job fetch:**
    ```bash
    pnpm run cron:now        # Runs one immediate fetch for all sources
    ```
-   **Run job fetch periodically (every 6 hours):**
    ```bash
    pnpm run cron            # Runs job fetch every 6 hours via local setInterval
    ```

## Triggering Cron Jobs via API

You can manually trigger the cron job via a POST request to the API endpoint (useful for Vercel Cron):

```bash
curl -X POST http://localhost:3000/api/cron \
  -H "x-cron-secret: YOUR_CRON_SECRET"
```
Replace `YOUR_CRON_SECRET` with the secret defined in your `.env.local` file.

## Environment Variables

| Variable | Description |
|---|---|
| `SMTP_HOST` | SMTP server host (e.g., smtp.gmail.com). |
| `SMTP_PORT` | SMTP server port (usually 587). |
| `SMTP_USER` | The email address used for sending notifications. |
| `SMTP_PASS` | App Password for the SMTP user. |
| `NOTIFY_TO` | The email address where job alerts will be sent. |
| `CRON_SECRET` | Secret string to protect the `/api/cron` endpoint. |
| `NEXT_PUBLIC_APP_URL` | The public URL of your application. |

## How It Works

1.  **Discovery:** The runner iterates through a list of companies in `src/lib/sources/`.
2.  **Scraping:** Fetches raw job data from Greenhouse, Lever, or Ashby JSON APIs.
3.  **Refining:** 
    -   Strips HTML from descriptions.
    -   Filters by title (removes backend, devops, staff roles, etc.).
    -   Filters by citizenship requirements in description.
4.  **Scoring:** Compares the job description against a hardcoded list of expert and proficient skills.
5.  **Persistence:** Merges new jobs with existing ones in `data/jobs.json`, keeping a max of 500 entries.
6.  **Alerting:** If new "Visa Mode" jobs are found, an HTML email is sent with the top-scoring roles.
