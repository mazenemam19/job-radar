/**
 * auth.spec.ts — Tier 1, Test 1
 *
 * Covers middleware.ts — the single file that enforces:
 *   • unauthenticated → /login
 *   • onboarding incomplete → /onboarding
 *   • non-admin → bounced from /admin to /dashboard
 *
 * WHY this test exists:
 *   - CVE-2025-29927 (CVSS 9.1) was a middleware auth-bypass in Next.js
 *     14.2.5 fixed in 14.2.25 — the exact file this test exercises.
 *   - A future Next.js 15/16 migration rewrites middleware.ts (async cookies/
 *     headers). This test is the regression net for that change.
 *   - middleware.ts has zero existing coverage of any kind.
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
