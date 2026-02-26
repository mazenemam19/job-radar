# 🎯 Job Radar

Frontend developer jobs with visa sponsorship — auto-scored against your CV. This application leverages AI capabilities to streamline the job search process and provides agentic tools for further development and maintenance.

## Table of Contents

-   [Overview](#overview)
-   [Architecture](#architecture)
-   [Core Technologies](#core-technologies)
-   [Key Features](#key-features)
-   [Agentic Setup & Skills](#agentic-setup--skills)
-   [Setup Instructions](#setup-instructions)
-   [Running the Application](#running-the-application)
-   [Triggering Cron Jobs via API](#triggering-cron-jobs-via-api)
-   [Environment Variables](#environment-variables)
-   [How It Works](#how-it-works)

## Overview

Job Radar is a Next.js application designed to help frontend developers find jobs with visa sponsorship. It automates the process of sourcing, filtering, and scoring job postings against a user's CV, providing a streamlined and intelligent job search experience.

## Architecture

The application follows a standard Next.js architecture, leveraging API routes for backend logic and React components for the frontend.

-   **Frontend:** Built with React and Next.js, styled with Tailwind CSS. Components are organized in `src/components`, and pages/layouts in `src/app`.
-   **Backend (API Routes):** Handled by Next.js API routes under `src/app/api`. This includes endpoints for job management and scheduled cron tasks.
-   **Core Logic:** Centralized in `src/lib`, encompassing modules for email (`email.ts`), task running (`runner.ts`), scoring (`scoring.ts`), and data storage (`storage.ts`).
-   **Background Processes:** Critical tasks are managed by cron jobs, defined in `src/scripts/cron.ts` and triggered via API routes (`src/app/api/cron/route.ts`).
-   **Data Sources:** Integrates with external data, such as company information (`src/lib/sources/companies.ts`).

## Core Technologies

-   **Framework:** Next.js (React)
-   **Language:** TypeScript
-   **Styling:** Tailwind CSS
-   **Email:** Nodemailer
-   **Scheduling:** node-cron

## Key Features

-   Job Tracking/Management
-   AI-powered Scoring/Relevance for Jobs
-   Email Notifications for new job alerts
-   Automated Background Tasks (e.g., data updates, notifications)
-   Visa Sponsorship filtering

## Agentic Setup & Skills

This project is equipped with an agentic setup to facilitate development and maintenance. The `.gemini` directory contains various artifacts, including specialized AI skills.

The following core modules have dedicated AI skills to assist with specific development tasks:

-   **Job Management Skill:** Expertise in handling job data, display, and API interactions.
-   **Cron and Background Tasks Skill:** Focus on scheduled processes and task execution.
-   **Email and Notifications Skill:** Specialization in email functionalities and alerts.
-   **UI Components Skill:** Pertaining to the development and styling of user interface elements.
-   **Data Storage and Persistence Skill:** Managing data models, access, and integration.

These skills are defined in `SKILL.md` files within the `.gemini/skills/` directory.

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
    pnpm run cron:now        # Runs one immediate fetch (Arbeitnow + Remotive via Gemini)
    ```
-   **Run job fetch periodically (every 6 hours):**
    ```bash
    pnpm run cron            # Runs job fetch every 6 hours
    ```

## Triggering Cron Jobs via API

You can manually trigger the cron job via a POST request to the API endpoint:

```bash
curl -X POST http://localhost:3000/api/cron \
  -H "x-cron-secret: YOUR_CRON_SECRET"
```
Replace `YOUR_CRON_SECRET` with the secret defined in your `.env.local` file.

## Environment Variables

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Your API key from https://aistudio.google.com/apikey (free). |
| `SMTP_USER` | The Gmail address used for sending email notifications. |
| `SMTP_PASS` | A 16-character Gmail App Password (not your regular Gmail password). Refer to Google's documentation for generating App Passwords. |
| `NOTIFY_TO` | The email address to which job alerts will be sent. |
| `CRON_SECRET` | Any random string to protect the `/api/cron` endpoint from unauthorized access. |
| `NEXT_PUBLIC_APP_URL` | The public URL of your application, used for constructing links in email notifications. |

## How It Works

1.  **Job Sourcing:**
    -   **Arbeitnow:** Filters jobs by `visa_sponsorship: true` (reliable boolean indicator).
    -   **Remotive:** Utilizes Gemini AI to classify each job for visa sponsorship eligibility.
2.  **Filtering:** Both sources are processed to filter out jobs with citizenship/clearance requirements and those with zero skill overlap.
3.  **Scoring:** Each job is scored based on:
    -   60% skill match
    -   30% recency
    -   10% relocation bonus
4.  **Notifications:** An email alert is sent when new jobs matching the criteria are found.
5.  **Data Storage:** Up to 500 jobs are stored in `data/jobs.json`, with deduplication to avoid redundant entries.
