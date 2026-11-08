import { expect, test } from "@playwright/test";

test.describe("public featured companies directory", () => {
  test("is available without an authenticated session", async ({ page }) => {
    await page.goto("/companies");

    await expect(page).not.toHaveURL(/\/login/);
    await expect(
      page.getByRole("heading", { name: "Companies hiring through Job Radar" }),
    ).toBeVisible();
  });
});
