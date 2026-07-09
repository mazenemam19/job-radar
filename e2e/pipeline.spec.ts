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

  // UPDATED: buildFeed no longer lumps seniority/keyword/location/skill gates
  // into one "Settings filter" — they're individually tracked accordion rows
  // now (see GATE_META in FunnelView.tsx). "Fetched"/"total" became "Scraped
  // this run" / "Matched your pipelines" / "In candidate window".
  test("pipeline renders its top-level stage labels", async ({ page }) => {
    await page.goto("/pipeline");
    await page.waitForLoadState("networkidle");

    // Numbers may be 0 if the cache hasn't been built yet, but the labels
    // for each stage should still be present.
    const hasTopFunnel = await page
      .getByText(/scraped|matched your pipelines|candidate window/i)
      .first()
      .isVisible()
      .catch(() => false);
    const hasDateGate = await page
      .getByText(/date filter/i)
      .first()
      .isVisible()
      .catch(() => false);
    // Any one of the 5 gates that used to be lumped into "Settings filter" is
    // enough to confirm the split happened.
    const hasSplitSettingsGate = await page
      .getByText(
        /seniority filter|excluded keyword|required keyword|blacklisted location|skill match/i,
      )
      .first()
      .isVisible()
      .catch(() => false);
    const hasAiFilter = await page
      .getByText(/gemini/i)
      .first()
      .isVisible()
      .catch(() => false);

    const visibleStageCount = [hasTopFunnel, hasDateGate, hasSplitSettingsGate, hasAiFilter].filter(
      Boolean,
    ).length;
    expect(visibleStageCount).toBeGreaterThanOrEqual(2);
  });

  // UPDATED: the funnel is now three connected tiles ("Scraped this run" →
  // "Matched your pipelines" → "In candidate window"), not four flat stage
  // nodes ("Fetched" / "Date filter" / ...) — date/seniority/keywords/etc.
  // moved down into the per-gate accordion list below the funnel.
  test("pipeline funnel renders the top three connected tiles", async ({ page }) => {
    await page.goto("/pipeline");
    await page.waitForLoadState("networkidle");

    const hasFunnelTiles =
      (await page
        .getByText(/scraped this run/i)
        .first()
        .isVisible()
        .catch(() => false)) &&
      (await page
        .getByText(/matched your pipelines/i)
        .first()
        .isVisible()
        .catch(() => false));

    const hasEmptyState = await page
      .getByText(/no pipeline data|open your dashboard/i)
      .first()
      .isVisible()
      .catch(() => false);

    // One of the two states must be true — funnel tiles OR empty-state message.
    expect(hasFunnelTiles || hasEmptyState).toBe(true);
  });

  // NEW: the job-trace search box ("can't find it in the lists above?") is
  // always rendered regardless of whether the cache has data yet — it
  // queries raw_jobs directly and doesn't depend on pipeline_log.
  test("job-trace search box is present with title and company inputs", async ({ page }) => {
    await page.goto("/pipeline");
    await page.waitForLoadState("networkidle");

    await expect(page.getByPlaceholder(/job title/i)).toBeVisible();
    await expect(page.getByPlaceholder(/company/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /search/i })).toBeVisible();
  });

  // FIX: The API response shape is { ok: true, data: { pipeline_log, jobs, ... } }.
  // pipeline_log and jobs live under the `data` key, not at the top level.
  test("/api/dashboard response is 200 and contains the new pipeline_log shape", async ({
    page,
  }) => {
    // Directly verify the API that feeds the pipeline page
    const response = await page.request.get("/api/dashboard");
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.ok).toBe(true);

    // pipeline_log and jobs are nested under data, not at the root.
    expect(body.data).toHaveProperty("pipeline_log");
    expect(body.data).toHaveProperty("jobs");
    expect(Array.isArray(body.data.jobs)).toBe(true);

    // Structural check on the new shape — top-level funnel counts and the
    // 9-gate breakdown, not the old 5 flat integers.
    const log = body.data.pipeline_log;
    expect(log).toHaveProperty("total_scraped");
    expect(log).toHaveProperty("matched_pipelines");
    expect(log).toHaveProperty("candidate_window");
    expect(log).toHaveProperty("on_dashboard");
    expect(log).toHaveProperty("wrong_pipeline_mode");
    expect(log).toHaveProperty("outside_candidate_window");
    expect(log.gates).toHaveProperty("date");
    expect(log.gates).toHaveProperty("gemini");
    expect(log.gates).toHaveProperty("scoring");
  });

  // NEW: smoke-tests the search API directly — a query with neither title
  // nor company must be rejected before it ever reaches raw_jobs.
  test("/api/jobs/explain requires a title or company", async ({ page }) => {
    const response = await page.request.get("/api/jobs/explain");
    expect(response.status()).toBe(400);
  });
});
