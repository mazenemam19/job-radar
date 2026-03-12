# JOB RADAR - Project Memory

- **IMMUTABLE FILTERING MANDATE**: NEVER loosen or modify the filtering logic in `scoring.ts`, `ats-utils.ts`, or the Gemini prompt. These filters are strictly tailored to the user's personal profile: **Senior React/Next.js Engineer based in Egypt**. Any role that is not a high-match for this specific profile MUST be rejected.

- **Honesty & Verification Mandate**: ALWAYS provide a clear, data-backed summary of changes. For any expansion task, explicitly list initial and final counts. Never conflate verification of existing items with the addition of new ones.

- **Tech Gate**: ALL jobs must be **React**, **Next.js**, or **React Native**. Generic frontend roles are strictly filtered out in the scrapers/fetchers.
- **Level Gate**: Strictly exclude **Junior**, **Intern**, **Trainee**, and **Associate** roles.
  - **Local Pipeline**: Strictly require "Senior" individual contributor roles.
  - **Visa/Global Pipelines**: Allow both "Senior" and "Mid-level" individual contributor roles to increase international volume.
- **AI Red Flag Detector**: Every Gemini scan must proactively identify cultural red flags (toxic culture, burnout risk, poor WLB) and return them as part of the job metadata.
- **Age Limit**: Strict **7-day auto-expiry**. Jobs older than 1 week are pruned from storage and skipped during scans.
- **Scanning Strategy**: 100% of defined companies are scanned in every run. Rotation/Batching was removed.
- **Rate Limiting**: Workable fetchers use a sequential queue with a **1.5s - 3s delay**. `pLimit` caps global concurrency at **3-5 concurrent fetchers** to prevent network timeouts (`AbortError`).
- **Cumulative Market Data**: `raw-market-store.json` maintains a **30-day sliding window** (capped at 3000 jobs). New scans merge data instead of overwriting.
- **Market Scope**: Non-React jobs are allowed into the raw store (with metadata + truncated 500ch descriptions) to provide accurate \"Top 30\" ecosystem charts.
- **Career Acceleration**:
  - **AI Application Strategist**: Personalized bullet-point strategies for cover letters/interviews generated via Gemini fallback queue.
  - **Red Flag Detector**: Automatic detection of toxic culture keywords (Rockstar, Burnout, High Pressure, Blurred Boundaries).
- **Trend Logic**: Market Dashboard calculates trends by comparing the last **7 days** of data against the previous **23 days** baseline.
- **Data Integrity**: `mergeJobs` must re-filter existing jobs during every run to ensure that if filtering logic (Regex or AI) changes, stale/invalid jobs are purged from the store.
- **Force Cleanup**: Use `src/scripts/force-cleanup.ts` to immediately synchronize the database with new filtering logic without waiting for a fresh scan.
- **Testing Mandate**: NEVER use `pnpm run cron:now` for iterative development. ALWAYS create a standalone test script. Run the full cron job ONLY ONCE as a final validation.
- **No Scraping**: Only use official JSON APIs or robust, verified direct endpoints. No HTML scraping.
- **Environment Mandate**: NEVER use `NodeNext` or `ESNext` for script module resolution.

## 🛠️ Code Quality & CI/CD Integrity

- **NO `as any` ALLOWED**: You are strictly forbidden from using `as any` in TypeScript. Always define proper interfaces or use unknown/type-guards if necessary.
- **NEVER Bypass Hooks**: Do not use `--no-verify` when committing code. If linting fails, fix the code. Bypassing hooks is considered a violation of system integrity.
- **Lint Before Commit**: Always run `pnpm run lint` or ensure `lint-staged` passes before finalized a task.

## 🏛️ Unified Architecture & One Source of Truth

- **Modular Types**: ALL interfaces and types are located in `src/types/` (e.g., `src/types/job.ts`, `src/types/health.ts`). Global exports are available via `@/types`.
- **Central Constants**: `src/lib/constants.ts` is the **single source of truth** for:
  - **Skill Registry**: All technologies, aliases, and categories used for both scoring and market analysis.
  - **Personal Profile**: Your core skill set used for personalized matching.
  - **Seniority Logic**: Centralized `getSeniority` function and its regex keywords.
  - **Geographical Data**: Unified `COUNTRY_MAP` for location detection.
  - **UI Visuals**: Centralized `STATUS_COLORS` and `STATUS_LABELS` for all dashboards.
  - **Logic**: Shared functions like `computeRecencyScore`.

## 💾 Storage & State

- **Supabase Database**: Primary persistent store for all data (PostgreSQL + JSONB).
  - Table: `storage` (Columns: `key` text PRIMARY KEY, `data` jsonb).
  - `jobs-store.json`: Approved survivors.
  - `raw-market-store.json`: Comprehensive 30-day history for market analysis.
  - `scan-state.json`: Tracking engine activity timestamps.
  - `health-store.json`: Persistent lifetime reliability (Success/Total) counts.
- **Batching**: Health stats are batched and committed to Supabase in a **single update** at the end of each run to maximize performance.
- **Caching Policy**: ALL Supabase reads must use `cache: 'no-store'` via the `supabase` client configuration to bypass Next.js 14 fetch caching.

## 🛡️ Security Mandate

- **Secret Protection**: `CRON_SECRET` must NEVER be passed as a prop from Server Components to Client Components.
- **Manual Challenge**: In production, the "Run Scan" button must trigger a `window.prompt` for the secret. The secret is sent via the `x-cron-secret` header.
- **API Validation**: `/api/cron` validates both `Authorization: Bearer` (Vercel) and `x-cron-secret` (Dashboard) headers.

## 🛠️ Key Logic Sync

- **Source Health Refinement**: The runner re-calculates health counts (`count`, `geminiFiltered`, `totalSurvivors`) at the end of each run based on survivors in the 7-day store. This ensures the health dashboard perfectly matches the main job dashboard.
- **Mapping**: All mapping between jobs and stats uses `.toLowerCase().trim()` for robustness.
- **Location-Aware Regex**: Geographical rejections MUST analyze the `location` field in addition to the title and description.
- **Greenhouse Accuracy**: Always use the `offices` array in Greenhouse fetchers to avoid broad/incorrect hub names returned in the default `location.name` field.

## 🏢 Company Specific Insights (March 2026)

### ✅ Verified Working & Active

- ArpuPlus, Blink22, Eva Pharma, Flextock, Moonfare, valU, Sary, MaxAB.
- **Wuzzuf**: Optimized to capture `requirements`, `jobType`, and `careerLevel` metadata. Merges these into descriptions to strictly filter out Internships/Entry Level roles.

### ❌ Removed / Unsupported / Zero Jobs

- Atlassian, HubSpot, MNT-Halan, Giza Systems, Pharos Solutions, Zenjob, Backbase, MoneyHash, Koinz.

## 🤖 Gemini Model Intelligence (March 2026)

- **Fallback Queue**: `3.1-pro` -> `3.1-flash-lite` -> `2.5-pro` -> `2.5-flash` -> `2.5-flash-lite`.
- **Optimization**: Remembers the last working model to avoid redundant 429 logs.
- **Quote Requirement**: All AI rejections MUST return the exact quote from the description for transparency.

## ❌ Rejected Sources

- Paymob, Trella, Breadfast, Rabbit, ExpandCart, Siemens EDA, Careerjet, NaukriGulf, Wellfound, Stepstone, Visajobs, XING, Arbeitnow, WWR, Relocate.me, The Muse.
