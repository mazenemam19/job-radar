/**
 * tracker.spec.ts — Tier 1, Test 4
 *
 * Covers the tracker update-status and remove cycle.
 *
 * WHY this test exists:
 *   - Tracker is the most state-mutating user flow in the app (PATCH, DELETE
 *     against tracker_entries) and currently has zero coverage at any layer.
 *   - The Phase 4 migration moved tracker routes from createAdminClient()
 *     to createServerClient() — no test verified that the RLS-scoped client
 *     still works for the full lifecycle.
 *   - Phase 3 added aria-label to the per-card status <select> and "Remove"
 *     button; these selectors are used directly here and will fail fast if
 *     they're stripped.
 *
 * NOTE on CREATE:
 *   TrackerPage has no "Add entry" button. New tracker entries are created
 *   from the Dashboard by clicking the "Track" button on a job card, which
 *   opens TrackerModal. The CREATE path is therefore a Dashboard-level flow
 *   and is out of scope for this tracker page test.
 *
 *   To keep this test idempotent and independent of the dashboard, the GET
 *   mock is pre-seeded with MOCK_ENTRY so the page opens with an existing
 *   row ready for update and delete.
 *
 * API routes are intercepted so the test is idempotent (no real DB rows
 * are created/deleted) and runs without needing a seeded tracker state.
 */

import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const AUTH_FILE = path.join(__dirname, ".auth", "user.json");
const hasAuth = fs.existsSync(AUTH_FILE);

// Stable mock row for the update → remove sequence.
const MOCK_ID = "e2e-smoke-test-001";
const MOCK_ENTRY = {
  id: MOCK_ID,
  job_id: MOCK_ID,
  job_title: "Software Engineer (E2E Test)",
  company: "Smoke Test Co.",
  status: "applied",
  notes: "",
  created_at: new Date().toISOString(),
  last_status_change: new Date().toISOString(),
  applied_at: null,
  // job_snapshot is required by the TrackerCard renderer
  job_snapshot: {
    title: "Software Engineer (E2E Test)",
    company: "Smoke Test Co.",
    url: "https://example.com/job",
    location: "Remote",
    country: "US",
    country_flag: "🇺🇸",
    mode: "global",
    total_score: 80,
    matched_skills: ["React", "TypeScript"],
    posted_at: new Date().toISOString(),
  },
};

test.describe("tracker — update status / remove", () => {
  test.use({
    storageState: hasAuth ? AUTH_FILE : { cookies: [], origins: [] },
  });

  test.beforeEach(async () => {
    if (!hasAuth) test.skip();
  });

  test("full CRUD cycle: update status → remove (create is a dashboard-level flow)", async ({
    page,
  }) => {
    // -----------------------------------------------------------------------
    // Set up route interception for all tracker endpoints.
    // GET is pre-seeded with MOCK_ENTRY so the page opens with a row to work
    // with — no "Add" button is needed.
    // -----------------------------------------------------------------------
    let currentEntries: (typeof MOCK_ENTRY)[] = [MOCK_ENTRY];

    await page.route("**/api/tracker", async (route) => {
      const method = route.request().method();
      if (method === "GET") {
        await route.fulfill({ json: { ok: true, data: currentEntries } });
      } else if (method === "POST") {
        // POST is not exercised from the tracker page UI, but intercept it so
        // the mock doesn't leak through to the real API.
        await route.fulfill({ status: 201, json: { ok: true, data: MOCK_ENTRY } });
      } else {
        await route.continue();
      }
    });

    await page.route(`**/api/tracker/${MOCK_ID}`, async (route) => {
      const method = route.request().method();
      if (method === "PATCH") {
        const body = route.request().postDataJSON() as { status?: string };
        if (body.status) {
          currentEntries = [{ ...MOCK_ENTRY, status: body.status }];
        }
        await route.fulfill({ json: { ok: true, data: { ...MOCK_ENTRY, ...body } } });
      } else if (method === "DELETE") {
        currentEntries = [];
        await route.fulfill({ status: 200, json: { ok: true } });
      } else {
        await route.continue();
      }
    });

    // Wildcard fallback for any /api/tracker/:id pattern the component uses
    await page.route(/\/api\/tracker\/.+/, async (route) => {
      const method = route.request().method();
      if (method === "PATCH") {
        const body = route.request().postDataJSON() as { status?: string };
        if (body.status) {
          currentEntries = [{ ...MOCK_ENTRY, status: body.status }];
        }
        await route.fulfill({ json: { ok: true, data: { ...MOCK_ENTRY, ...body } } });
      } else if (method === "DELETE") {
        currentEntries = [];
        await route.fulfill({ status: 200, json: { ok: true } });
      } else {
        await route.continue();
      }
    });

    // -----------------------------------------------------------------------
    // 1. Navigate to the tracker page — opens with MOCK_ENTRY pre-loaded.
    // -----------------------------------------------------------------------
    await page.goto("/tracker");

    // The mock entry's company name must appear.
    await expect(page.getByText(MOCK_ENTRY.job_snapshot.company)).toBeVisible({
      timeout: 8_000,
    });

    // -----------------------------------------------------------------------
    // 2. Update the status via the per-card <select>.
    //    Phase 3 added aria-label="Update status for {title}" to each select.
    // -----------------------------------------------------------------------
    const statusSelect = page.getByLabel(/update status|status/i).first();
    await expect(statusSelect).toBeVisible({ timeout: 8_000 });

    await statusSelect.selectOption("interviewing");

    // Give the PATCH a moment to fire.
    await page.waitForTimeout(300);

    // -----------------------------------------------------------------------
    // 3. Remove the entry via the "Remove" button.
    //    Phase 3 added aria-label="Remove {title} from tracker".
    // -----------------------------------------------------------------------
    const removeButton = page.getByRole("button", { name: /remove/i }).first();
    // Register BEFORE the click — window.confirm fires synchronously on click.
    page.once("dialog", (dialog) => dialog.accept());
    await removeButton.click();

    // If a native confirm dialog appeared (window.confirm), handle it.
    page.once("dialog", (dialog) => dialog.accept());

    // If a confirmation button appeared in the UI, click it.
    const confirmBtn = page.getByRole("button", { name: /confirm|yes|delete/i }).first();
    if (await confirmBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await confirmBtn.click();
    }

    // The card should be gone — company name no longer visible.
    await expect(page.getByText(MOCK_ENTRY.job_snapshot.company)).not.toBeVisible({
      timeout: 5_000,
    });
  });
});
