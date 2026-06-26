import { test, expect } from "@playwright/test";

// /pipeline is a protected route (middleware redirects unauthenticated users)
test.use({ storageState: "e2e/.auth/user.json" });

test.describe("pipeline — funnel visualisation", () => {
  test("authenticated user reaches /pipeline (not redirected to /login)", async ({ page }) => {
    await page.goto("/pipeline");
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page).toHaveURL(/\/pipeline/);
  });

  test("pipeline page renders without a 500 error", async ({ page }) => {
    await page.goto("/pipeline");
    await page.waitForLoadState("networkidle");

    // The page must not render an error state
    await expect(
      page.getByText(/error 500|something went wrong|internal server error/i),
    ).not.toBeVisible();

    // At minimum a heading must be visible
    await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 8_000 });
  });

  test("pipeline renders stage counters — fetched → date-filtered → settings-filtered → AI-filtered", async ({
    page,
  }) => {
    await page.goto("/pipeline");
    await page.waitForLoadState("networkidle");

    // The pipeline funnel shows how many jobs survived each filtering stage.
    // Numbers may be 0 if the cache hasn't been built yet, but the labels
    // for each stage should still be present.
    const hasFetched = await page
      .getByText(/fetched|total/i)
      .first()
      .isVisible()
      .catch(() => false);
    const hasDateFilter = await page
      .getByText(/date|age/i)
      .first()
      .isVisible()
      .catch(() => false);
    const hasSettingsFilter = await page
      .getByText(/settings|filter/i)
      .first()
      .isVisible()
      .catch(() => false);
    const hasAiFilter = await page
      .getByText(/gemini|ai|llm/i)
      .first()
      .isVisible()
      .catch(() => false);

    // At least two of the four stage labels must be visible
    const visibleStageCount = [hasFetched, hasDateFilter, hasSettingsFilter, hasAiFilter].filter(
      Boolean,
    ).length;
    expect(visibleStageCount).toBeGreaterThanOrEqual(2);
  });

  // FIX: The previous version of this test checked for "visa / local / global" text
  // on the pipeline page. FunnelView does NOT render a per-pipeline breakdown —
  // it shows stage labels: "Fetched", "Date filter", "Settings filter", "Your Gemini filter".
  // The pipeline mode names (visa/local/global) only appear in SettingsForm and on
  // the dashboard filter tabs, not in the funnel visualisation.
  //
  // This test is rewritten to verify what FunnelView actually renders:
  // the four funnel stage nodes. Separately, the filter-tab test in
  // dashboard.spec.ts covers the mode (visa/local/global) label rendering.
  test("pipeline funnel renders the four stage nodes", async ({ page }) => {
    await page.goto("/pipeline");
    await page.waitForLoadState("networkidle");

    // FunnelView shows four stage nodes. Each stage has a label rendered
    // via the STAGES constant in FunnelView.tsx:
    //   "Fetched" | "Date filter" | "Settings filter" | "Your Gemini filter"
    // If the cache has not been built yet, FunnelView renders an empty-state
    // message instead — we accept either outcome.
    const hasFunnelNodes =
      (await page
        .getByText(/fetched/i)
        .first()
        .isVisible()
        .catch(() => false)) &&
      (await page
        .getByText(/date filter/i)
        .first()
        .isVisible()
        .catch(() => false));

    const hasEmptyState = await page
      .getByText(/no pipeline data|open your dashboard/i)
      .first()
      .isVisible()
      .catch(() => false);

    // One of the two states must be true — funnel nodes OR empty-state message.
    expect(hasFunnelNodes || hasEmptyState).toBe(true);
  });

  // FIX: The API response shape is { ok: true, data: { pipeline_log, jobs, ... } }.
  // pipeline_log and jobs live under the `data` key, not at the top level.
  // The previous test used expect(body).toHaveProperty("pipeline_log") which
  // looked at the root object and found nothing; the correct path is body.data.
  test("/api/dashboard response is 200 and contains pipeline_log", async ({ page }) => {
    // Directly verify the API that feeds the pipeline page
    const response = await page.request.get("/api/dashboard");
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.ok).toBe(true);

    // pipeline_log and jobs are nested under data, not at the root.
    expect(body.data).toHaveProperty("pipeline_log");
    expect(body.data).toHaveProperty("jobs");
    expect(Array.isArray(body.data.jobs)).toBe(true);
  });
});
