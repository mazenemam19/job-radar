import { expect, test } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const AUTH_FILE = path.join(__dirname, ".auth", "user.json");
const hasAuth = fs.existsSync(AUTH_FILE);

test.describe("mobile protected shell", () => {
  test.use({ storageState: hasAuth ? AUTH_FILE : { cookies: [], origins: [] } });

  test.beforeEach(async () => {
    if (!hasAuth) test.skip();
  });

  test("keeps authenticated navigation usable on a phone-width screen", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/tracker");

    const mobileNavigation = page.getByRole("navigation", { name: "Mobile navigation" });
    await expect(mobileNavigation).toBeVisible();
    await expect(mobileNavigation.getByRole("link", { name: /dashboard/i })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Main navigation" })).not.toBeVisible();

    const shellWidth = await page
      .locator("main")
      .evaluate((main) => main.getBoundingClientRect().width);
    expect(shellWidth).toBeLessThanOrEqual(375);
  });
});
