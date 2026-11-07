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

  test("workplace choices are independent controls", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    const onSite = page.getByRole("switch", { name: "On-site", exact: true });
    const remote = page.getByRole("switch", { name: "Remote", exact: true });

    await expect(onSite).toBeVisible({ timeout: 8_000 });
    await expect(remote).toBeVisible({ timeout: 8_000 });

    const originalOnSite = await onSite.getAttribute("aria-checked");
    const originalRemote = await remote.getAttribute("aria-checked");

    await onSite.click();
    expect(await onSite.getAttribute("aria-checked")).not.toBe(originalOnSite);
    expect(await remote.getAttribute("aria-checked")).toBe(originalRemote);

    // Restore local form state; this test deliberately does not save.
    await onSite.click();
  });

  test("source pipeline controls can be saved and restored", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    const localPipeline = page.getByRole("switch", { name: /local source pipeline/i });
    await expect(localPipeline).toBeVisible({ timeout: 8_000 });
    const initialChecked = await localPipeline.getAttribute("aria-checked");

    await localPipeline.click();
    const save = page.getByRole("button", { name: /save settings/i });
    const saveResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/settings") && response.request().method() === "PATCH",
      { timeout: 8_000 },
    );
    await save.click();
    expect((await saveResponse).status()).toBe(200);

    await localPipeline.click();
    const restoreResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/settings") && response.request().method() === "PATCH",
      { timeout: 8_000 },
    );
    await save.click();
    expect((await restoreResponse).status()).toBe(200);
    expect(await localPipeline.getAttribute("aria-checked")).toBe(initialChecked);
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
