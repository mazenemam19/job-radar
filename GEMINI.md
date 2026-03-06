# JOB RADAR - Project Memory

- **IMMUTABLE FILTERING MANDATE**: NEVER loosen or modify the filtering logic in `scoring.ts`, `ats-utils.ts`, or the Gemini prompt. These filters are strictly tailored to the user's personal profile: **Senior React/Next.js Engineer based in Egypt**. Any role that is not a high-match for this specific profile MUST be rejected.

- **Honesty & Verification Mandate**: ALWAYS provide a clear, data-backed summary of changes. For any expansion task, explicitly list: 1. Initial count/list, 2. Exactly what was added (names), 3. Exactly what was added (names), 4. Exactly what was removed (names), and 5. Final count. Never conflate verification of existing items with the addition of new ones.

- **Tech Gate**: ALL jobs must be **React**, **Next.js**, or **React Native**. Generic frontend roles are strictly filtered out in the scrapers/fetchers.
- **Level Gate**: Strictly exclude **Junior**, **Intern**, **Trainee**, and **Associate** roles. Lead/Managerial roles are also excluded unless they are "Senior" individual contributor roles.
- **Age Limit**: Strict **7-day auto-expiry**. Jobs older than 1 week are pruned from storage and skipped during scans.
- **Performance**: Scan pipelines (`local`, `visa`, `global`) must run in **parallel**. `pLimit` caps global concurrency at 3-5 concurrent fetchers to prevent network timeouts (`AbortError`).
- **Rate Limiting**: Workable fetchers use a sequential queue with a **1.5s - 3s delay** to avoid IP blocks.
- **Testing Mandate**: NEVER use `pnpm run cron:now` for iterative development or debugging. ALWAYS create a standalone test script (e.g. `src/scripts/test-xxx.ts`) for new integrations. Run the full cron job ONLY ONCE as a final validation after the task is complete.
- **No Scraping**: Only use official JSON APIs or robust, verified direct endpoints. Do not scrape HTML unless absolutely necessary and verified.
- **Fetcher Longevity**: A fetcher that successfully connects to an API but returns 0 jobs _after filtering_ should be kept. Job availability is volatile, and a working fetcher is a valuable asset for catching future listings.
- **Environment Mandate**: NEVER use `NodeNext` or `ESNext` for script module resolution. This caused catastrophic module resolution failures. Stick strictly to Next.js defaults and standard TypeScript configurations. DO NOT repeat this mistake.
- **Filtering Logic**: Uses a two-tier system:
  1. **Regex Tier**: Fast initial gate for tech stack, seniority, and location-aware patterns (e.g. US-only, Hybrid).
  2. **Gemini LLM Tier**: Secondary aggressive check for location alignment (Egypt/EMEA), Israel-related companies, and nuanced tech/seniority mismatches. MUST include exact rejection quotes.
  - **Optimization**: Gemini is ONLY called for _new_ jobs that passed the Regex Tier to save API quota.

## 💾 Storage & State

- **Supabase Database**: Primary persistent store for all data (PostgreSQL + JSONB).
  - Table: `storage` (Columns: `key` text PRIMARY KEY, `data` jsonb).
  - `jobs-store.json`: Approved survivors matching personal profile.
  - `raw-market-store.json`: Comprehensive 30-day history of all fetched jobs (unfiltered) for market analysis.
  - `scan-state.json`: Tracking engine activity and timestamps.
  - `health-store.json`: Persistent lifetime reliability (Success/Total) counts.
- **`data/` Folder**: Locally ignored. Used only as a transient cache for scan states during development.
- **Environment**: Requires `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, and `GEMINI_API_KEY` in `.env.local`.
- **Cron Frequency**: GitHub Actions triggers the `/api/cron` endpoint every 6 hours to bypass Vercel's daily limit. Requires `CRON_SECRET` in GitHub Secrets.

## 🔌 Integrations

### 🇪🇬 Local Board (Egypt/Regional)

- **`local-companies.ts`**: The Egypt-only pipeline.
  - **Wuzzuf**: Uses the direct 2-step JSON API (Search IDs -> Detail Lookup) with a 3+ years experience filter.
  - **Custom Fetchers**: Bright Skies (GraphQL), other bespoke direct APIs.

### ✈️ Visa Board (Relocation)

- **`visa-companies.ts`**: The Visa Sponsorship pipeline for tech hubs.
  - Focuses on companies in Germany, UK, Netherlands.

### 🌍 Remote Board (Global)

- **`remote-companies.ts`**: The Global Remote pipeline.
  - **RemoteOK**: Official JSON API.
  - **Himalayas/Remotive**: Direct API integrations.
  - **WP Startup Jobs**: For specific job boards (e.g., Berlin/London Startup Jobs).

## 🛠️ Key Logic

- **Source Health Sync**: The runner re-calculates health counts (`count`, `geminiFiltered`, `totalSurvivors`) at the end of each run based on actual survivors in the store. This ensures the health dashboard perfectly matches the main job dashboard.
- **Recency Scoring**: Real dates get 0-100 score based on 7-day decay. Unknown dates: Default to **4 days ago** (medium recency).
- **Cleanup**: Handled in `storage.ts` using `postedAt`. `mergeJobs` actively re-scans and purges any job (old or new) that fails the current filtering logic.
- **Filter Intelligence**:
  - **Geographical Rejection**: Blocks Israel-based companies (Wix, Fiverr, Monday.com, etc.) and those on BDS lists.
  - **Location & Hubs**: Aggressively rejects US/UK/Canada only roles, "US Hubs", and "Remote in the United States" using both regex and LLM.
  - **Location-Aware Regex**: Hybrid/Onsite rejections must be coupled with non-Egypt location keywords to prevent accidental rejection of local roles.
  - **Backend Guard**: Generic titles are accepted only if frontend keywords significantly outnumber backend signals.

## ⚠️ Known Issues / Fixes

- **Supabase Migration**: Vercel Blob access was paused; all storage migrated to Supabase `storage` table for higher request limits and JSONB efficiency.
- **Workable URL Typo**: Confirmed that the correct URL is `.../widget/accounts/...`.
- **Serverless Persistence**: State is saved to Supabase at the end of each run to prevent race conditions.
- **Read-Only Filesystem**: Vercel's serverless environment (`/var/task`) is read-only.
  - **State Fix**: Supabase provides cross-lambda persistence.
  - **Transient Data**: Use `/tmp` (managed in `ats-utils.ts`) for runtime file operations.

## 🏢 Company Specific Insights (March 2026)

### ✅ Verified Working & Active

- **ArpuPlus**: Workable slug `arpu-telecommunication-services` (active).
- **Blink22**: Workable slug `blink22-3` (active).
- **Eva Pharma**: Workable slug `eva-pharma` (active).
- **Flextock**: SmartRecruiters slug `Flextock` (active).
- **Moonfare**: Greenhouse slug `moonfare` (active).
- **valU**: SmartRecruiters slug `valu` (active).
- **Sary**: Workable slug `sary` (active).
- **MaxAB**: Breezy HR `maxab` (active).

### ❌ Removed / Unsupported / Zero Jobs

- **Atlassian**: Moved to Workday (no public API support).
- **HubSpot**: Moved to internal CRM (no public API support).
- **MNT-Halan**: Custom portal (no public API support).
- **Giza Systems / Pharos Solutions**: Removed due to "No Scraping" mandate.
- **Zenjob / Backbase / MoneyHash**: API works, but currently 0 jobs.
- **Koinz**: Rejected — Uses an unsupported ats.

## 🤖 Gemini Model Intelligence (March 2026)

- **Active Fallback Queue**:
  1. `gemini-3.1-pro-preview`: Primary reasoning model.
  2. `gemini-3.1-flash-lite-preview`: High-speed, cost-efficient.
  3. `gemini-2.5-pro`: Stable general availability.
  4. `gemini-2.5-flash`: Stable high-performance.
  5. `gemini-2.5-flash-lite`: Maximum reliability.
- **Optimization**: The system remembers the last working model in a run to avoid repeated 429 fallback logs.
- **Quote Requirement**: All AI rejections MUST return the exact quote from the job description that triggered the rule for transparency.

## 🏛️ Architecture

- **Source Health Page**: Dedicated route at `/analysis` using `AnalysisView.tsx`.
  - Metrics: Raw Signal → Regex Pass → Gemini Reject → Total Active (7-day store).
- **Market Intelligence Dashboard**: Dedicated route at `/market` using a hybrid Server/Client architecture.
  - **Server-side**: Data orchestration and regex-based skill extraction from `raw-market-store.json`.
- **Component Modularity**:
  - `AppHeader.tsx`: Shared navigation and "Run Scan" logic.
  - `SourceHealthDashboard.tsx`: High-tech diagnostic view.

## ❌ Rejected Sources

- **Paymob / Lucky Financial**: Rejected — API endpoints are restricted/private.
- **Trella**: Rejected — Uses Teamtailor but the JSON endpoint is restricted.
- **Breadfast**: Rejected — Uses Freshteam (no public API).
- **Rabbit / ExpandCart**: Rejected — Workable slugs returned consistent 404s.
- **Careerjet**: Rejected — Persistent module resolution issues during integration.
- **NaukriGulf / Wellfound / Stepstone / Visajobs / XING**: No public, direct JSON API found.
- **Arbeitnow**: Rejected — Unreliable filters for visa sponsorship.
- **WWR / Relocate.me**: Rejected — High scraping requirement.
- **The Muse**: Rejected — Heavily US-centric.
