# JOB RADAR - Project Memory

- **Honesty & Verification Mandate**: ALWAYS provide a clear, data-backed summary of changes. For any expansion task, explicitly list: 1. Initial count/list, 2. Exactly what was added (names), 3. Exactly what was removed (names), and 4. Final count. Never conflate verification of existing items with the addition of new ones.

- **Tech Gate**: ALL jobs must be **React**, **Next.js**, or **React Native**. Generic frontend roles are strictly filtered out in the scrapers/fetchers.
- **Level Gate**: Strictly exclude **Junior**, **Intern**, **Trainee**, and **Associate** roles. Lead/Managerial roles are also excluded.
- **Age Limit**: Strict **7-day auto-expiry**. Jobs older than 1 week are pruned from storage and skipped during scans.
- **Performance**: Scan pipelines (`local`, `visa`, `global`) must run in **parallel**.
- **Rate Limiting**: Workable fetchers use a sequential queue with a **1.5s - 3s delay** and a rotating batch of **8 companies per run** to avoid IP blocks.
- **Testing Mandate**: NEVER use `pnpm run cron:now` for iterative development or debugging. ALWAYS create a standalone test script (e.g. `src/scripts/test-xxx.ts`) for new integrations. Run the full cron job ONLY ONCE as a final validation after the task is complete.
- **No Scraping**: Only use official JSON APIs or robust, verified direct endpoints. Do not scrape HTML unless absolutely necessary and verified.
- **Fetcher Longevity**: A fetcher that successfully connects to an API but returns 0 jobs _after filtering_ should be kept. Job availability is volatile, and a working fetcher is a valuable asset for catching future listings.
- **Environment Mandate**: NEVER use `NodeNext` or `ESNext` for script module resolution. This caused catastrophic module resolution failures. Stick strictly to Next.js defaults and standard TypeScript configurations. DO NOT repeat this mistake.
- **Filtering Logic**: Uses a two-tier system:
  1. **Regex Tier**: Fast initial gate for tech stack, seniority, and obvious location restrictions.
  2. **Gemini LLM Tier**: Secondary aggressive check for location alignment (Egypt/EMEA), Israel-related companies, and nuanced tech/seniority mismatches.
  - **Optimization**: Gemini is ONLY called for _new_ jobs that passed the Regex Tier to save API quota.

## 💾 Storage & State

- **Vercel Blob Storage**: Primary persistent store for all data (`jobs-store.json`, `scan-state.json`).
- **`data/` Folder**: Locally ignored. Used only as a transient cache for scan states during development.
- **Environment**: Requires `BLOB_READ_WRITE_TOKEN`, `CRON_SECRET`, and `GEMINI_API_KEY` in `.env.local`.
- **Cron Frequency**: Vercel Hobby tier limits cron jobs to **once per day**. Do not attempt to increase the frequency in `vercel.json` as it will be ignored or cause deployment errors. Use external triggers (like GitHub Actions) if higher frequency is needed.

## 🔌 Integrations

### 🇪🇬 Local Board (Egypt/Regional)

- **`local-companies.ts`**: The Egypt-only pipeline.
  - **Wuzzuf**: Uses the direct 2-step JSON API (Search IDs -> Detail Lookup) with a 3+ years experience filter.
  - **Custom Fetchers**: Bright Skies (GraphQL), other bespoke direct APIs.
  - **Workable Batch**: 12 companies per scan, rotating across ~30 companies to ensure full coverage every 3 days.

### ✈️ Visa Board (Relocation)

- **`visa-companies.ts`**: The Visa Sponsorship pipeline for tech hubs (formerly `companies.ts`).
  - Focuses on companies in Germany, UK, Netherlands.
  - **Workable Batch**: 12 companies per scan, rotating.

### 🌍 Remote Board (Global)

- **`remote-companies.ts`**: The Global Remote pipeline (formerly `global-companies.ts`).
  - **RemoteOK**: Official JSON API.
  - **Himalayas/Remotive**: Direct API integrations.
  - **WP Startup Jobs**: For specific job boards (e.g., Berlin/London Startup Jobs).

## 🛠️ Key Logic

- **Recency Scoring**:
  - Real dates get 0-100 score based on 7-day decay.
  - Unknown dates: Default to **4 days ago** (medium recency) to avoid crowding the top while ensuring natural expiry in 3 days.
- **Cleanup**: Handled in `storage.ts` using `postedAt`. `mergeJobs` actively re-scans and purges any job (old or new) that fails the current filtering logic.
- **Filter Intelligence**:
  - **Geographical Rejection**: Blocks Israel-based companies (Wix, Fiverr, Monday.com, etc.) and those on BDS lists.
  - **Location & Hubs**: Aggressively rejects US/UK/Canada only roles, "US Hubs", and "Remote in the United States" using both regex and LLM.
  - **Timezone Filter**: Rejects PST/EST/CST only roles unless Global/EMEA is explicitly mentioned.
  - **Backend Guard**: Generic titles are accepted only if frontend keywords significantly outnumber backend signals.
  - **Gemini Fallback Queue**: Resilient filtering using `gemini-3.1-pro-preview` -> `gemini-3.1-flash-lite-preview` -> `gemini-2.5-pro` -> `gemini-2.5-flash` -> `gemini-2.5-flash-lite`.

## ⚠️ Known Issues / Fixes

- **Vercel Caching**: `fetch` calls to Blob storage use `?t=timestamp` to bypass edge caching.
- **Workable URL Typo**: Confirmed that the correct URL is `.../widget/accounts/...`.
- **Serverless Persistence**: The `finalizeBatchState` function ensures rotation offsets are saved to the cloud only once at the end of a parallel scan to prevent race conditions.
- **Read-Only Filesystem**: Vercel's serverless environment (`/var/task`) is read-only.
  - **State Fix**: `src/lib/state.ts` is configured to skip local `data/` writes when `process.env.VERCEL` is detected, relying solely on Vercel Blob.
  - **Transient Data**: Use `/tmp` (managed in `ats-utils.ts`) for any necessary runtime file operations (e.g., rate-limit tracking) that don't require persistence across separate lambda invocations.

## ✅ Potential New Sources

(None currently identified)

## 💡 Integration Insights

- **Public vs. Private Boards**: Many high-growth startups (Paymob, Lucky) restrict their Greenhouse/Workable APIs. If a browser URL works but the `boards-api` or `widget` URL returns 404, it is a "No-Go" for automated fetching without a private API key.
- **Custom Portals**: Large entities (Fawry) use homegrown or enterprise HRIS systems (Oracle/SAP) that lack public JSON endpoints.
- **Unsupported ATS**: Freshteam (Breadfast), Recruitee (elmenus), and ZenATS (Vezeeta) are common in Egypt but currently unsupported by our fetcher suite.
- **Volume Expansion**: To increase job count without lowering restrictions, prioritize "Hub Boards" (e.g., Berlin/London Startup Jobs). These often use WordPress REST APIs. Use the generic `fetchWPStartupJobs` fetcher for these.
- **Age Cap Trap**: Hub boards often return high "Raw Signal" (October 2025 posts) but 0 "Matches" because our **7-day expiry** is strictly enforced. Verify the board's posting frequency before integrating.
- **Workable Batching**: To avoid IP blocks, Workable fetchers use a rotating batch system. The `SourceHealthDashboard` now displays a "Skipped" status for Workable slugs that were not included in the current cron run's batch. This provides a clear view of which slugs are being rotated.

## 🏢 Company Specific Insights (March 2026)

This section documents detailed findings and decisions regarding specific companies, based on empirical testing and external research as of March 2026.

### ✅ Verified Working & Active

- **ArpuPlus**: Workable slug `arpu-telecommunication-services` (active).
- **Blink22**: Workable slug `blink22-3` (active).
- **Eva Pharma**: Workable slug `eva-pharma` (active).
- **Flextock**: SmartRecruiters slug `Flextock` (active).
- **Moonfare**: Greenhouse slug `moonfare` (active).
- **valU**: SmartRecruiters slug `valu` (active, but currently 0 jobs on public API).
- **Sary**: Workable slug `sary` (active, but currently 0 jobs on public API).
- **MaxAB**: Breezy HR `maxab` (API works, but currently 0 jobs).

### ❌ Removed / Unsupported / Zero Jobs

- **Atlassian**: Moved to Workday (no public API support for our fetchers).
- **HubSpot**: Moved to internal CRM (no public API support).
- **MNT-Halan**: Custom portal (no public API support).
- **Giza Systems**: Legacy HTML scraper (removed due to "No Scraping" mandate).
- **Pharos Solutions**: Legacy HTML scraper (removed due to "No Scraping" mandate).
- **Zenjob**: Greenhouse `zenjob` (API works, but currently 0 jobs).
- **Backbase**: Greenhouse `backbase` (API works, but currently 0 jobs).
- **MoneyHash**: Ashby `moneyhash` (API works, but currently 0 jobs).
- **Koinz**: Rejected — Uses an unsupported ats.

## 🤖 Gemini Model Intelligence (March 2026)

To maintain high availability and accuracy, the project uses a cascading fallback queue of Gemini models. This configuration is based on the state of Google's API as of **March 2026**:

- **Active Fallback Queue**:
  1. `gemini-3.1-pro-preview`: Primary reasoning model.
  2. `gemini-3.1-flash-lite-preview`: High-speed, cost-efficient (Released March 3, 2026).
  3. `gemini-2.5-pro`: Stable general availability.
  4. `gemini-2.5-flash`: Stable high-performance.
  5. `gemini-2.5-flash-lite`: Maximum reliability.

- **Verified Deprecations / Incompatibilities**:
  - `gemini-3.1-flash-preview`: **Unavailable** (404) as of March 4, 2026.
  - `gemini-3-pro-preview`: **Scheduled for shutdown** on March 9, 2026.
  - `gemini-1.5-pro/flash`: **Deprecated/Shut down** in late 2025.
  - **SDK**: Must use `@google/genai` (Unified SDK) with `apiVersion: "v1beta"`.

## 🏛️ Architecture

- **Signal Analysis Page**: Dedicated route at `/analysis` using `AnalysisView.tsx`.
- **Component Modularity**:
  - `AppHeader.tsx`: Shared navigation and "Run Scan" logic.
  - `SourceHealthDashboard.tsx`: High-tech diagnostic view. Supports an `alwaysOpen` prop for the dedicated analysis page.
- **Remote Cron**: GitHub Actions (defined in `.github/workflows/cron.yml`) triggers the `/api/cron` endpoint every 6 hours to bypass Vercel's daily limit. Requires `CRON_SECRET` in GitHub Secrets.

## ❌ Rejected Sources

- **Paymob / Lucky Financial**: Rejected — Use Greenhouse but their API endpoints are restricted/private, returning 404 for public requests.
- **Trella**: Rejected — Uses Teamtailor but the JSON endpoint is restricted or uses a custom structure that prevents standard fetching.
- **Yodawy / Sympl / Mozare3**: Rejected — No dedicated international ATS; they rely on Wuzzuf, LinkedIn, or simple website forms.
- **Breadfast**: Rejected — Uses Freshteam, which lacks a standard public JSON API.
- **Rabbit / ExpandCart**: Rejected — Workable slugs (`rabbit-mart`, `expandcart`) returned consistent 404s for the widget API.
- **elmenus**: Rejected — Uses Recruitee, which is not currently supported.
- **Koinz**: Rejected — Uses an unsupported ats.
- **Siemens EDA / Orange Business / Speer**: Rejected — Local Egyptian branches use restricted global boards or returned 404s for local slugs.
- **Careerjet**: Rejected — API access requires an API key, but integration attempts were marred by persistent module resolution issues with `ts-node` in the project's development environment.
- **NaukriGulf.com**: Rejected — No public, direct JSON API.
- **Wellfound.com**: Rejected — No public, documented JSON API.
- **Stepstone.de**: Rejected — No public JSON API; requires partnership.
- **Visajobs.xyz**: Rejected — No public API found.
- **XING.com**: Rejected — No suitable public JSON API for job searching.
- **Jobs.joinimagine.com**: Rejected — No JSON API found.
- **WorkingNomads.com**: Rejected — No public API found.
- **Toughbyte.com**: Investigation timed out without conclusive API findings.
- **JustRemote.co**: Rejected — No public API found.
- **Remoteplatz.com**: API endpoint found but returns an empty response.
- **Dollar.careers**: No official public API found.
- **Arbeitnow**: Rejected — Unreliable filters for visa sponsorship.
- **We Work Remotely (WWR)**: Rejected — Requires HTML scraping.
- **Relocate.me**: Rejected — High scraping requirement.
- **The Muse**: Rejected — Heavily US-centric with minimal "Egypt-friendly" roles.
