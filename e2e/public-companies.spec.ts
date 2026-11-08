import { expect, test } from "@playwright/test";

test.describe("public featured companies directory", () => {
  test("is available without an authenticated session", async ({ page }) => {
    await page.goto("/companies");

    await expect(page).not.toHaveURL(/\/login/);
    await expect(
      page.getByRole("heading", { name: "Companies hiring through Job Radar" }),
    ).toBeVisible();

    const removalLink = page.getByRole("link", { name: "Request company removal by email" });
    await expect(removalLink).toHaveAttribute(
      "href",
      /^mailto:jobradarnoreply@gmail\.com\?subject=Job\+Radar\+company\+directory\+removal\+request/,
    );
  });
});
