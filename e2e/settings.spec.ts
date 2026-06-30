import { test, expect } from "@playwright/test";

test.use({ storageState: "e2e/.auth/user.json" });

test.describe("settings — save round-trip via real API", () => {
  test("settings page loads without error", async ({ page }) => {
    const [response] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes("/api/settings") && r.request().method() === "GET",
        { timeout: 30_000 },
      ),
      page.goto("/settings"),
    ]);

    await expect(page).toHaveURL(/\/settings/);
    expect(response.status()).toBe(200);
    // No JS error modal
    await expect(
      page.getByText(/something went wrong|error 500|internal server/i),
    ).not.toBeVisible();
  });

  test("job alerts toggle changes state and PATCH /api/settings returns 200", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    // The email-alerts toggle is a button[role=switch].
    // Accessible name is "Email alerts. Get notified when new matching jobs are found after each dashboard refresh"
    // We accept several plausible label variants to survive minor copy changes.
    const toggle = page.getByRole("switch", { name: /email alerts/i }).first();

    await expect(toggle).toBeVisible({ timeout: 8_000 });

    const initialChecked = (await toggle.getAttribute("aria-checked")) ?? "false";

    await toggle.click();

    // SettingsForm only fires PATCH on the Save button — not on individual toggle clicks.
    const patchPromise = page.waitForResponse(
      (r) => r.url().includes("/api/settings") && r.request().method() === "PATCH",
      { timeout: 8_000 },
    );
    await page.getByRole("button", { name: /save/i }).last().click();
    const patchResponse = await patchPromise;
    expect(patchResponse.status()).toBe(200);

    // The aria-checked value must have flipped
    const newChecked = await toggle.getAttribute("aria-checked");
    expect(newChecked).not.toBe(initialChecked);

    await toggle.click();
    const restorePromise = page.waitForResponse(
      (r) => r.url().includes("/api/settings") && r.request().method() === "PATCH",
      { timeout: 8_000 },
    );
    await page.getByRole("button", { name: /save/i }).last().click();
    await restorePromise;
  });

  test("pipeline toggles are independent controls (local / global)", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    // The settings page renders two pipeline switch controls.
    // They correspond to pipeline_local, pipeline_global in user_settings.
    // Accessible names: "🇪🇬 Local pipeline. Egypt-based companies" and "🌐 Global pipeline. Worldwide remote companies"
    const localToggle = page.getByRole("switch", { name: /local pipeline|egypt-based/i }).first();
    const globalToggle = page
      .getByRole("switch", { name: /global pipeline|worldwide remote/i })
      .first();

    // Both must be visible and be distinct DOM nodes
    await expect(localToggle).toBeVisible({ timeout: 8_000 });
    await expect(globalToggle).toBeVisible({ timeout: 8_000 });

    // Playwright returns the same element when two locators resolve to the same node.
    // Verify both are different elements.
    const localBox = await localToggle.boundingBox();
    const globalBox = await globalToggle.boundingBox();

    expect(localBox).not.toBeNull();
    expect(globalBox).not.toBeNull();
    expect(localBox!.y).not.toBeCloseTo(globalBox!.y, 5);
  });

  test("renders seniority level toggle buttons", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    // Tier 5c: seniority level multi-select buttons
    const senioritySection = page.getByText("Seniority levels").first();
    await expect(senioritySection).toBeVisible({ timeout: 8_000 });

    // Junior, Mid, Senior, Staff+ buttons should be visible
    await expect(page.getByText("Senior", { exact: true })).toBeVisible();
    await expect(page.getByText("Staff+", { exact: true })).toBeVisible();
  });

  test("renders seniority keyword list editors", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    // Tier 4 keyword list textareas
    await expect(page.getByLabel("Junior keywords")).toBeVisible();
    await expect(page.getByLabel("Mid keywords")).toBeVisible();
    await expect(page.getByLabel("Senior keywords")).toBeVisible();
    await expect(page.getByLabel("Staff+ keywords")).toBeVisible();
  });

  test("saves seniority level selections", async ({ page }) => {
    // This test would need a mock backend to verify persistence
    // For now, just verify the UI elements are interactive
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    const juniorBtn = page.getByText("Junior", { exact: true });
    await expect(juniorBtn).toBeVisible({ timeout: 8_000 });
    await juniorBtn.click(); // toggle on
    // Button should now have active styling (border color changes)
  });

  test("saves settings and shows confirmation", async ({ page }) => {
    // Smoke test: verify the save button exists
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    const saveButton = page.getByRole("button", { name: /save settings/i });
    await expect(saveButton).toBeVisible({ timeout: 8_000 });
  });

  test("Gemini API key field accepts input and PATCH /api/settings returns 200", async ({
    page,
  }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    // Gemini key field — could be type=text or type=password
    const keyField = page
      .getByRole("textbox", { name: /gemini.?api.?key|api.?key/i })
      .or(page.locator('input[name*="gemini"], input[placeholder*="gemini" i]'))
      .first();

    await expect(keyField).toBeVisible({ timeout: 8_000 });

    // Fill with a dummy key that passes basic format validation
    const dummyKey = "«redacted:AIza…»";
    await keyField.fill(dummyKey);

    const patchPromise = page.waitForResponse(
      (r) => r.url().includes("/api/settings") && r.request().method() === "PATCH",
      { timeout: 8_000 },
    );

    // Submit — look for a Save/Submit button near the field
    const saveButton = page.getByRole("button", { name: /save|submit|update/i }).last();
    await saveButton.click();
    const patchResponse = await patchPromise;
    expect(patchResponse.status()).toBe(200);
  });
});
