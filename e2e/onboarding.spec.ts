/**
 * onboarding.spec.ts
 *
 * Covers what the rest of the suite structurally cannot: a user whose
 * onboarding_complete is FALSE. global-setup.ts always logs in with
 * onboardingComplete: true because every other spec needs an already-
 * onboarded session — so despite auth.spec.ts's docstring claiming
 * "onboarding incomplete → /onboarding" is covered, nothing actually
 * exercises the onboarding gate or the complete-onboarding redirect.
 *
 * Flips the shared test account to onboarding_complete: false for this
 * file's own tests, restores it to true in afterAll. Safe only because
 * playwright.config.ts runs workers: 1 / fullyParallel: false.
 */

import { test, expect, request as pwRequest } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const AUTH_FILE = path.join(__dirname, ".auth", "user.json");
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const SECRET = process.env.E2E_TEST_SECRET;
const EMAIL = process.env.TEST_USER_EMAIL;
const canRun = !!SECRET && !!EMAIL;

async function loginAs(onboardingComplete: boolean) {
  const ctx = await pwRequest.newContext({ baseURL: BASE_URL });
  const res = await ctx.post("/api/test/e2e-login", {
    headers: { "x-e2e-secret": SECRET! },
    data: { onboardingComplete },
  });
  if (!res.ok()) {
    throw new Error(`e2e-login failed: ${res.status()} ${await res.text()}`);
  }
  const state = await ctx.storageState();
  await ctx.dispose();
  return state;
}

test.describe("onboarding — new user redirect", () => {
  test.afterAll(async () => {
    if (!canRun) return;
    // loginAs() mints a new session via verifyOtp, which invalidates the
    // previous one. AUTH_FILE must be refreshed here — the same reason
    // auth.spec.ts's afterAll does it after the blocked-user sign-out.
    // Without this, every spec that runs after onboarding.spec.ts and loads
    // AUTH_FILE (pipeline, salary, settings, tracker) gets a dead session
    // and is redirected to /login.
    const state = await loginAs(true);
    fs.writeFileSync(AUTH_FILE, JSON.stringify(state, null, 2));
  });

  test("new user submitting defaults lands on /dashboard, not bounced back", async ({ page }) => {
    test.skip(!canRun, "requires TEST_USER_EMAIL / E2E_TEST_SECRET");

    const state = await loginAs(false);
    await page.context().addCookies(state.cookies);

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/onboarding/); // gate must catch a direct hit too

    await page.getByRole("button", { name: /use platform defaults/i }).click();

    // This is the exact bug: a stale cached layout bounces back to /onboarding.
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
    await expect(page).not.toHaveURL(/\/onboarding/);
  });

  test("new user choosing customize lands on /settings, not bounced back", async ({ page }) => {
    test.skip(!canRun, "requires TEST_USER_EMAIL / E2E_TEST_SECRET");

    const state = await loginAs(false);
    await page.context().addCookies(state.cookies);

    await page.goto("/onboarding");
    await page.getByRole("button", { name: /customise my profile/i }).click();

    await expect(page).toHaveURL(/\/settings/, { timeout: 10_000 });
    await expect(page).not.toHaveURL(/\/onboarding/);
  });
});
