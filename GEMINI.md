# JOB RADAR - Project Memory

- **IMMUTABLE FILTERING MANDATE**: NEVER loosen or modify the filtering logic in `scoring.ts`, `ats-utils.ts`, or the Gemini prompt. These filters are strictly tailored to the user's personal profile: **Senior React/Next.js Engineer based in Egypt**. Any role that is not a high-match for this specific profile MUST be rejected.

- **Honesty & Verification Mandate**: ALWAYS provide a clear, data-backed summary of changes. For any expansion task, explicitly list: 1. Initial count/list, 2. Exactly what was added (names), 3. Exactly what was added (names), 4. Exactly what was removed (names), and 5. Final count. Never conflate verification of existing items with the addition of new ones.

- **Tech Gate**: ALL jobs must be **React**, **Next.js**, or **React Native**. Generic frontend roles are strictly filtered out in the scrapers/fetchers.
- **Level Gate**: Strictly exclude **Junior**, **Intern**, **Trainee**, and **Associate** roles. Lead/Managerial roles are also excluded.
- **Age Limit**: Strict **7-day auto-expiry**. Jobs older than 1 week are pruned from storage and skipped during scans.
- **Scanning Strategy**: 100% of defined companies are scanned in every run. Rotation/Batching was removed in v3.5 to ensure full coverage.
- **Rate Limiting**: Workable fetchers use a sequential queue with a **1.5s - 3s delay** to avoid IP blocks. `pLimit` caps global concurrency at 3-5 concurrent fetchers to prevent network timeouts (`AbortError`).
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

- **Unified Company Management**: A single source of truth in `src/lib/sources/companies.ts` drives all pipelines.
- **`local-companies.ts`**: The Egypt-only pipeline.
  - **Wuzzuf**: Uses the direct 2-step JSON API (Search IDs -> Detail Lookup) with a 3+ years experience filter.
  - **Custom Fetchers**: Bright Skies (GraphQL), other bespoke direct APIs.
- **`visa-companies.ts`**: The Visa Sponsorship pipeline for tech hubs.
  - Focuses on companies in Germany, UK, Netherlands, etc.
- **`remote-companies.ts`**: The Global Remote pipeline.
  - **RemoteOK**: Official JSON API.
  - **Himalayas/Remotive**: Direct API integrations.
  - **WP Startup Jobs**: For specific job boards (e.g., Berlin/London Startup Jobs).

## 🛠️ Key Logic Sync

- **Source Health Alignment**: The runner re-calculates health counts (`count`, `geminiFiltered`, `totalSurvivors`) at the end of each run based on actual survivors in the 7-day store. This ensures the health dashboard perfectly matches the main job dashboard.
- **Case-Insensitive Mapping**: Mapping between jobs and source stats MUST use `.toLowerCase().trim()` to account for slight variations in company names across different APIs.
- **Location-Aware Regex**: Hybrid/Onsite rejections must be coupled with non-Egypt location keywords to prevent accidental rejection of local roles.
- **Market Extraction**: The `SKILL_REGISTRY` in `market.ts` is the source of truth for dashboard skill analysis. Broaden aliases here to catch more signals.
- **Recency Scoring**:
  - Real dates get 0-100 score based on 7-day decay.
  - Unknown dates: Default to **4 days ago** (medium recency) to avoid crowding the top while ensuring natural expiry in 3 days.

## ⚠️ Known Issues / Fixes

- **Supabase Migration**: Vercel Blob access was paused; all storage migrated to Supabase `storage` table for higher request limits and JSONB efficiency.
- **Workable URL Typo**: Confirmed that the correct URL is `.../widget/accounts/...`.
- **Serverless Persistence**: State is saved to Supabase at the end of each run to prevent race conditions.
- **Read-Only Filesystem**: Vercel's serverless environment (`/var/task`) is read-only.
  - **State Fix**: Supabase provides cross-lambda persistence.
  - **Transient Data**: Use `/tmp` (managed in `ats-utils.ts`) for runtime file operations.

## 🏢 Company Specific Insights (March 2026)

- **Consolidated Sources**: Global companies (Stripe, Okta, Cloudflare) are fetched once in the `global` pipeline.
- **Board Attribution**: Jobs found via aggregators (RemoteOK, Himalayas) are attributed to the board as the source for health tracking.
- **Verified Working & Active**: ArpuPlus, Blink22, Eva Pharma, Flextock, Moonfare, valU, Sary, MaxAB.
- **Removed / Unsupported / Zero Jobs**: Atlassian (Workday), HubSpot (Internal CRM), MNT-Halan (Custom), Giza Systems/Pharos (HTML Scraper), Zenjob, Backbase, MoneyHash, Koinz (Unsupported ATS).

## 🤖 Gemini Model Intelligence (March 2026)

- **Fallback Queue**: `3.1-pro` -> `3.1-flash-lite` -> `2.5-pro` -> `2.5-flash` -> `2.5-flash-lite`.
- **Optimization**: The system remembers the last working model in a run to avoid repeated 429 fallback logs.
- **Quote Requirement**: All AI rejections MUST return the exact quote from the job description that triggered the rule for transparency.

## 🏛️ Architecture

- **Source Health Page**: Dedicated route at `/analysis` using `AnalysisView.tsx`. Shows: Raw Signal → Regex Pass → Gemini Reject → Total Active.
- **Market Intelligence Dashboard**: Dedicated route at `/market` using a hybrid Server/Client architecture.
  - **Server-side**: Data orchestration and regex-based skill extraction from `raw-market-store.json`.
  - **Client-side**: High-fidelity visualizations using `<style jsx>` and project-native CSS variables.
- **Component Modularity**:
  - `AppHeader.tsx`: Shared navigation and "Run Scan" logic.
  - `SourceHealthDashboard.tsx`: High-tech diagnostic view. Supports an `alwaysOpen` prop for the dedicated analysis page.

## ❌ Rejected Sources

- **Paymob / Lucky Financial**: Rejected — Use Greenhouse but their API endpoints are restricted/private.
- **Trella**: Rejected — Uses Teamtailor but the JSON endpoint is restricted.
- **Rabbit / ExpandCart**: Rejected — Workable slugs returned consistent 404s.
- **Siemens EDA / Orange Business / Speer**: Rejected — Local branches use restricted global boards.
- **Arbeitnow**: Rejected — Unreliable filters for visa sponsorship.
- **WWR / Relocate.me**: Rejected — Requires HTML scraping.
- **The Muse**: Rejected — Heavily US-centric.
