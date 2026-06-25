import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";
import path from "path";

// Playwright's config/global-setup run as a plain Node process — unlike
// `next dev`/`next start`, nothing loads .env.local automatically here.
// Without this, TEST_USER_EMAIL/E2E_TEST_SECRET in .env.local are invisible
// to this process even though they're set. Matches the existing pattern in
// src/scripts/cron.ts.
config({ path: path.resolve(process.cwd(), ".env.local") });

/**
 * Tier 1 smoke suite.
 *
 * Five tests, one browser, sequential workers.
 *
 * Local: `pnpm test:e2e` starts `pnpm dev` itself if nothing is already
 *        running on :3000 (and reuses it if something is).
 * CI:    the webServer block builds + starts the production bundle automatically.
 *        Requires these secrets in the repo: NEXT_PUBLIC_SUPABASE_URL,
 *        NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SMTP_*,
 *        GEMINI_API_KEY, TEST_USER_EMAIL, E2E_TEST_SECRET.
 */
export default defineConfig({
  testDir: "./e2e",

  // Never run in parallel — one DB-backed user, one browser, shared state.
  fullyParallel: false,
  workers: 1,

  // In CI, treat test.only as an error to catch accidental focus.
  forbidOnly: !!process.env.CI,

  // One retry in CI to absorb flakiness from cold-start latency.
  retries: process.env.CI ? 1 : 0,

  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],

  // globalSetup signs in the test user once and saves auth cookies.
  globalSetup: "./e2e/global-setup.ts",

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // CI: build once, serve the production bundle, always fresh.
  // Local: run the dev server; reuse one that's already running on :3000
  // instead of erroring if you happen to have `pnpm dev` open elsewhere.
  webServer: {
    command: process.env.CI ? "pnpm start" : "pnpm dev",
    url: "http://localhost:3000",
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
});
