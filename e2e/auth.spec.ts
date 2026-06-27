/**
 * auth.spec.ts — Tier 1, Test 1
 *
 * Part 1 covers middleware.ts, which as of bc970e7 ("move onboarding to
 * protected layout") enforces exactly one thing:
 *   • unauthenticated → /login
 *
 * Part 2 covers the non-admin → /dashboard redirect, but NOT in
 * middleware.ts — that check now lives in
 * src/app/(protected)/admin/layout.tsx. The assertion is still correct
 * (the end-user-visible behavior is unchanged), it's just enforced by a
 * different file than this docstring used to claim.
 *
 * "onboarding incomplete → /onboarding" used to be covered here too, back
 * when middleware did that check directly on every request. bc970e7 moved
 * it to a client-side guard (OnboardingGuard.tsx) fed by a profile prop
 * cached at the (protected) layout level, which is a fundamentally
 * different risk profile (see onboarding.spec.ts for why, and for the bug
 * that gap let through). DO NOT re-add an onboarding assertion to this
 * file — it belongs in onboarding.spec.ts, which logs in as a genuinely
 * incomplete-onboarding user. Nothing in this file's AUTH_FILE fixture
 * ever is one (global-setup.ts always sets onboardingComplete: true).
 *
 * WHY this test exists:
 *   - CVE-2025-29927 (CVSS 9.1) was a middleware auth-bypass in Next.js
 *     14.2.5 fixed in 14.2.25 — the exact file Part 1 exercises.
 *   - A future Next.js 15/16 migration rewrites middleware.ts (async cookies/
 *     headers). This test is the regression net for that change.
 *
 * Part 1 (unauthenticated redirects) — no auth state, always runs.
 * Part 2 (authenticated non-admin access control) — requires AUTH_FILE.
 */

import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const AUTH_FILE = path.join(__dirname, ".auth", "user.json");
const hasAuth = fs.existsSync(AUTH_FILE);

// ---------------------------------------------------------------------------
// Part 1: Unauthenticated redirects
// ---------------------------------------------------------------------------

test.describe("middleware — unauthenticated redirects", () => {
  // Force-clear any storage state so these run without any auth cookies.
  test.use({ storageState: { cookies: [], origins: [] } });

  const protectedRoutes = ["/dashboard", "/settings", "/tracker", "/salary", "/admin"];

  for (const route of protectedRoutes) {
    test(`GET ${route} without session → redirected to /login`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login/);
    });
  }

  test("login page itself is publicly reachable", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/\/login/);
    // The button exists — this also catches a broken login page at route level.
    await expect(page.getByRole("button", { name: /continue with google/i })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Part 2: Authenticated non-admin cannot access /admin
// ---------------------------------------------------------------------------

test.describe("middleware — authenticated non-admin access control", () => {
  test.use({
    storageState: hasAuth ? AUTH_FILE : { cookies: [], origins: [] },
  });

  test("non-admin user hitting /admin is redirected to /dashboard", async ({ page }) => {
    // Skip cleanly when no auth state was produced by global-setup.
    // This preserves the unauthenticated tests above while not blocking CI
    // on the local-dev case where TEST_USER_* vars aren't set.
    if (!hasAuth) {
      test.skip();
      return;
    }

    await page.goto("/admin");

    // The middleware should bounce a non-admin user to /dashboard.
    // If this lands on /admin, the gate is broken.
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("authenticated user is NOT redirected back to /login from /dashboard", async ({ page }) => {
    if (!hasAuth) {
      test.skip();
      return;
    }

    await page.goto("/dashboard");
    await expect(page).not.toHaveURL(/\/login/);
  });
});
