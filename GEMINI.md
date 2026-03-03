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
- **Filtering Logic**: Stick to the existing regex-based filtering. It is highly effective at strictly focusing on React-related jobs and should not be replaced by LLM-based curation.

## 💾 Storage & State

- **Vercel Blob Storage**: Primary persistent store for all data.
- **`jobs-store.json`**: Contains the full job list and cron logs.
- **`scan-state.json`**: Persistent memory for the **Rotating Batch** system (stores offsets for Workable queues). Syncs between local disk (for dev) and cloud blob (for prod).
- **Environment**: Requires `BLOB_READ_WRITE_TOKEN` and `CRON_SECRET` in `.env.local`.
- **Cron Frequency**: Vercel Hobby tier limits cron jobs to **once per day**. Do not attempt to increase the frequency in `vercel.json` as it will be ignored or cause deployment errors. Use external triggers (like GitHub Actions) if higher frequency is needed.

## 🔌 Integrations

### 🇪🇬 Local Board (Egypt/Regional)

- **Wuzzuf**: Uses the direct 2-step JSON API (Search IDs -> Detail Lookup) with a 3+ years experience filter.
- **Custom Fetchers**: Bright Skies, Pharos, Giza Systems (Direct APIs).
- **Workable Batch**: 12 companies per scan, rotating across ~30 companies to ensure full coverage every 3 days.

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

## 💡 Integration Insights

- **Public vs. Private Boards**: Many high-growth startups (Paymob, Lucky) restrict their Greenhouse/Workable APIs. If a browser URL works but the `boards-api` or `widget` URL returns 404, it is a "No-Go" for automated fetching without a private API key.
- **SSL Trust Issues**: Some ATS platforms (like JazzHR for Koinz) have configuration issues that trigger `FetchError` or `Network/Timeout` due to SSL/TLS trust relationship failures in Node.js.
- **Custom Portals**: Large entities (Fawry, MNT-Halan) use homegrown or enterprise HRIS systems (Oracle/SAP) that lack public JSON endpoints.
- **Unsupported ATS**: Freshteam (Breadfast), Recruitee (elmenus), and ZenATS (MaxAB) are common in Egypt but currently unsupported by our fetcher suite.

## ❌ Rejected Sources

- **Paymob / Lucky Financial**: Rejected — Use Greenhouse but their API endpoints are restricted/private, returning 404 for public requests.
- **Trella**: Rejected — Uses Teamtailor but the JSON endpoint is restricted or uses a custom structure that prevents standard fetching.
- **Yodawy / Sympl / Mozare3**: Rejected — No dedicated international ATS; they rely on Wuzzuf, LinkedIn, or simple website forms.
- **Breadfast**: Rejected — Uses Freshteam, which lacks a standard public JSON API.
- **Rabbit / ExpandCart**: Rejected — Workable slugs (`rabbit-mart`, `expandcart`) returned consistent 404s for the widget API.
- **elmenus**: Rejected — Uses Recruitee, which is not currently supported.
- **Koinz**: Rejected — Uses JazzHR but the API connection fails due to persistent SSL/TLS trust issues.
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
