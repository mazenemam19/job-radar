# JOB RADAR - Project Memory

## 🚀 Core Mandates

- **Tech Gate**: ALL jobs must be **React**, **Next.js**, or **React Native**. Generic frontend roles are strictly filtered out in the scrapers/fetchers.
- **Level Gate**: Strictly exclude **Junior**, **Intern**, **Trainee**, and **Associate** roles. Lead/Managerial roles are also excluded.
- **Age Limit**: Strict **7-day auto-expiry**. Jobs older than 1 week are pruned from storage and skipped during scans.
- **Performance**: Scan pipelines (`local`, `visa`, `global`) must run in **parallel**.
- **Rate Limiting**: Workable fetchers use a sequential queue with a **1.5s - 3s delay** and a rotating batch of **8 companies per run** to avoid IP blocks.
- **Testing Mandate**: NEVER use `pnpm run cron:now` for iterative development or debugging. ALWAYS create a standalone test script (e.g. `src/scripts/test-xxx.ts`) for new integrations. Run the full cron job ONLY ONCE as a final validation after the task is complete.
- **No Scraping**: Only use official JSON APIs or robust, verified direct endpoints. Do not scrape HTML unless absolutely necessary and verified.
- **Fetcher Longevity**: A fetcher that successfully connects to an API but returns 0 jobs _after filtering_ should be kept. Job availability is volatile, and a working fetcher is a valuable asset for catching future listings.
- **Environment Mandate**: NEVER use `NodeNext` or `ESNext` for script module resolution. Stick to Next.js defaults and standard TypeScript configurations to avoid broken module resolution chains.
- **Filtering Logic**: Stick to the existing regex-based filtering. It is highly effective at strictly focusing on React-related jobs and should not be replaced by LLM-based curation.

## 💾 Storage & State

- **Vercel Blob Storage**: Primary persistent store for all data.
- **`jobs-store.json`**: Contains the full job list and cron logs.
- **`scan-state.json`**: Persistent memory for the **Rotating Batch** system (stores offsets for Workable queues). Syncs between local disk (for dev) and cloud blob (for prod).
- **Environment**: Requires `BLOB_READ_WRITE_TOKEN` and `CRON_SECRET` in `.env.local`.

## 🔌 Integrations

### 🇪🇬 Local Board (Egypt/Regional)

- **Wuzzuf**: Uses the direct 2-step JSON API (Search IDs -> Detail Lookup) with a 3+ years experience filter.
- **Custom Fetchers**: Bright Skies, Pharos, Giza Systems (Direct APIs).
- **Workable Batch**: 8 companies per scan, rotating across ~30 companies to ensure full coverage every 4 days.

### 🌍 Global Remote Board

- **RemoteOK**: Official JSON API.

## 🛠️ Key Logic

- **Recency Scoring**:
  - Real dates get 0-100 score based on 7-day decay.
  - Unknown dates: Default to **4 days ago** (medium recency) to avoid crowding the top while ensuring natural expiry in 3 days.
- **Cleanup**: Handled in `storage.ts` using `postedAt`. `mergeJobs` actively re-scans and purges any job (old or new) that fails the current filtering logic.
- **Filter Intelligence**:
  - **Geographical Blacklist**: Blocks jobs in Israel (`tel-aviv`, `gush dan`, `central district`).
  - **Timezone Filter**: For global roles, blocks US-only/PST-only jobs unless they explicitly mention EMEA/Global/Europe.
  - **Backend Guard**: Generic titles ("Software Engineer") are accepted ONLY if frontend keywords outnumber backend signals in the description.

## ⚠️ Known Issues / Fixes

- **Vercel Caching**: `fetch` calls to Blob storage use `?t=timestamp` to bypass edge caching.
- **Workable URL Typo**: Confirmed that the correct URL is `.../widget/accounts/...`.
- **Serverless Persistence**: The `finalizeBatchState` function ensures rotation offsets are saved to the cloud only once at the end of a parallel scan to prevent race conditions.

## ✅ Potential New Sources

(None currently identified)

## ❌ Rejected Sources

- **Careerjet**: Rejected — API access requires an API key, but integration attempts were marred by persistent module resolution issues with `ts-node` in the project's development environment, making the setup unstable. Despite extensive debugging, a reliable execution environment for integrating the API could not be established.
- **NaukriGulf.com**: Rejected — No public, direct JSON API.
- **Wellfound.com**: Rejected — No public, documented JSON API.
- **Stepstone.de**: Rejected — No public JSON API; requires partnership.
- **Visajobs.xyz**: Rejected — No public API found.
- **XING.com**: Rejected — No suitable public JSON API for job searching; official API is for recruiters only.
- **Jobs.joinimagine.com**: Rejected — No JSON API found.
- **WorkingNomads.com**: Rejected — No public API found.
- **Toughbyte.com**: Investigation timed out without conclusive API findings.
- **JustRemote.co**: Rejected — No public API found.
- **Remoteplatz.com**: Rejected — API endpoint found but returns an empty response.
- **Dollar.careers**: Rejected — No official public API found.
- **Arbeitnow**: Rejected — Unreliable filters for visa sponsorship; previous attempts to use the "visa_sponsorship=true" flag failed to yield verified results.
- **We Work Remotely (WWR)**: Rejected — Requires HTML scraping; lacks a clean, documented JSON API.
- **Relocate.me**: Rejected — High scraping requirement; lacks a robust, publicly accessible direct API.
- **The Muse**: Rejected — Heavily US-centric with minimal "Egypt-friendly" or global-remote roles that don't require US citizenship.
