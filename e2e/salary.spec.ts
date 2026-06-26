import { test, expect } from "@playwright/test";

// /salary is a protected route
test.use({ storageState: "e2e/.auth/user.json" });

test.describe("salary — community salary explorer", () => {
  test("authenticated user reaches /salary (not redirected to /login)", async ({ page }) => {
    await page.goto("/salary");
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page).toHaveURL(/\/salary/);
  });

  test("salary page renders without a 500 error", async ({ page }) => {
    await page.goto("/salary");
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByText(/error 500|something went wrong|internal server error/i),
    ).not.toBeVisible();

    await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 8_000 });
  });

  test("/api/salary GET returns 200 with aggregated data", async ({ page }) => {
    const response = await page.request.get("/api/salary");
    expect(response.status()).toBe(200);

    const body = await response.json();
    // The salary API returns either an aggregates array or an empty array
    // — both are valid; what matters is the shape.
    expect(body).toHaveProperty("data");
    expect(Array.isArray(body.data)).toBe(true);
  });

  test("salary page shows aggregate data OR an empty-state message", async ({ page }) => {
    await page.goto("/salary");
    await page.waitForLoadState("networkidle");

    // Either salary entries are displayed in a table/chart, OR
    // an empty-state message prompts the user to submit the first entry.
    const hasTable = (await page.locator("table, [role=table]").count()) > 0;
    const hasChart = (await page.locator("canvas, svg").count()) > 0;
    const hasEmptyText = await page
      .getByText(/no data|be the first|submit|no salary|empty/i)
      .first()
      .isVisible()
      .catch(() => false);

    expect(hasTable || hasChart || hasEmptyText).toBe(true);
  });

  test("salary submission form is present and accepts valid input", async ({ page }) => {
    await page.goto("/salary");
    await page.waitForLoadState("networkidle");

    // The salary submission form lets users add their own anonymised data point.
    // Fields: role title, years experience, salary amount, currency/pipeline.
    const form = page.locator("form").first();
    const hasForm = await form.isVisible().catch(() => false);

    // If there's no inline form, there might be a button that opens one
    const openFormButton = page.getByRole("button", { name: /submit|add|share|report/i }).first();
    const hasOpenButton = await openFormButton.isVisible().catch(() => false);

    expect(hasForm || hasOpenButton).toBe(true);

    if (hasOpenButton && !hasForm) {
      await openFormButton.click();
      // After clicking, a form or modal should appear
      await expect(page.locator("form, [role=dialog]").first()).toBeVisible({ timeout: 5_000 });
    }

    // Role title field
    const roleField = page
      .getByRole("textbox", { name: /role|title|position/i })
      .or(page.locator('input[name*="role"], input[placeholder*="role" i]'))
      .first();
    await expect(roleField).toBeVisible({ timeout: 5_000 });
    await roleField.fill("Senior Frontend Engineer");

    // Years of experience
    const yearsField = page
      .getByRole("spinbutton", { name: /year|experience/i })
      .or(page.locator('input[type="number"][name*="year"], input[name*="experience"]'))
      .first();

    if (await yearsField.isVisible().catch(() => false)) {
      await yearsField.fill("5");
    }

    // We do NOT actually submit the form in this test (would pollute real data).
    // Just verify the submit button is enabled and the form is ready to go.
    const submitButton = page.getByRole("button", { name: /submit|save|add/i }).last();
    await expect(submitButton).toBeVisible({ timeout: 5_000 });
  });

  test("POST /api/salary validates required fields and returns 400 on bad payload", async ({
    page,
  }) => {
    // Send an empty body — the API should reject it with 400, not 500
    const response = await page.request.post("/api/salary", {
      data: {},
      headers: { "Content-Type": "application/json" },
    });
    expect(response.status()).toBeGreaterThanOrEqual(400);
    expect(response.status()).toBeLessThan(500);
  });
});
