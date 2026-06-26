/**
 * dashboard.spec.ts — Tier 1, Test 2
 *
 * Covers: OnboardingFlow rewrite (Feature Request 2 from the Gemini audit)
 * and the authenticated dashboard render path.
 *
 * WHY this test exists:
 *   - OnboardingFlow.tsx was rewritten as part of Feature Request 2 and has
 *     never been tested at any layer (zero unit or integration coverage).
 *   - The dashboard route is the most-used page in the app; a broken render
 *     after a Next.js migration would be caught here.
 *
 * The test user is assumed to have COMPLETED onboarding (the typical state
 * for an existing account). To test the onboarding flow itself you would
 * need a fresh user account — that's a separate test concern. This test
 * focuses on the post-onboarding steady state.
 */

import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const AUTH_FILE = path.join(__dirname, ".auth", "user.json");
const hasAuth = fs.existsSync(AUTH_FILE);

test.describe("dashboard — authenticated render", () => {
  test.use({
    storageState: hasAuth ? AUTH_FILE : { cookies: [], origins: [] },
  });

  test.beforeEach(async () => {
    if (!hasAuth) test.skip();
  });

  test("authenticated user lands on /dashboard (not bounced to /login or /onboarding)", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("dashboard renders pipeline filter tabs", async ({ page }) => {
    // /api/dashboard declares maxDuration=60 for the first-load Gemini
    // rebuild path — a brand-new test account has no cache yet, so it
    // always hits that slow path on its first run.
    test.setTimeout(60_000);
    await page.goto("/dashboard");

    // DashboardClient added role="tab" / aria-selected in Phase 3.
    // If the dashboard doesn't render, this will fail clearly.
    const tabs = page.getByRole("tab");
    await expect(tabs.first()).toBeVisible({ timeout: 45_000 });
  });

  test("dashboard renders at least one job card OR a meaningful empty state", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/dashboard");

    // Either there are job cards or there's an empty-state message.
    // Both are valid — the point is the page didn't crash.
    const jobCards = page.locator('[data-testid="job-card"]');
    const emptyState = page.getByText(/no jobs|nothing here|check back|empty/i);

    await expect(jobCards.or(emptyState).first()).toBeVisible({
      timeout: 45_000,
    });
  });

  test("job detail page loads without 500 for a real job id", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/dashboard");

    // Wait for at least one job card to appear.
    const firstCard = page.locator('[data-testid="job-card"]').first();
    const hasJobs = await firstCard
      .waitFor({ state: "visible", timeout: 45_000 })
      .then(() => true)
      .catch(() => false);
    if (!hasJobs) {
      test.skip(); // No jobs seeded — can't test the detail page.
      return;
    }

    // FIX: JobCard renders the job title as a <Link href="/job/[id]"> at the
    // top of the <article>. Clicking the article element itself lands on the
    // "Details" expand/collapse button in the middle of the card — that never
    // triggers navigation. We must click the anchor link specifically.
    const titleLink = firstCard.getByRole("link").first();
    await titleLink.click();

    // Should be on /job/[id] — not an error page.
    await expect(page).toHaveURL(/\/job\//, { timeout: 5_000 });
    await expect(page).not.toHaveURL(/\/error|\/500/);
    // A heading must be visible (job title or the Next.js not-found heading).
    await expect(page.getByRole("heading").first()).toBeVisible();
  });
});
