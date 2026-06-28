/**
 * auth.spec.ts — Tier 1, Test 1
 *
 * Part 1 covers middleware.ts's unauthenticated → /login redirect.
 *
 * Part 2 covers the non-admin → /dashboard redirect, but NOT in
 * middleware.ts — that check lives in src/app/(protected)/admin/layout.tsx.
 * The assertion is still correct (the end-user-visible behavior is
 * unchanged), it's just enforced by a different file than this docstring
 * used to claim.
 *
 * Part 3 covers middleware.ts's blocked-user (is_active) check. This one
 * WAS removed from middleware by bc970e7 ("move onboarding to protected
 * layout") and pushed into the (protected) layout instead, then restored
 * here after that turned out to be a live security gap: the layout is a
 * cached dynamic segment, and Next's Router Cache can serve a soft
 * client-side navigation from a previously-rendered layout without
 * re-running the server component — so a user blocked mid-session kept
 * functional access via in-app link clicks until that cache entry expired.
 * Middleware runs before that cache negotiation happens, so it's the only
 * place this is guaranteed to fire immediately. The layout keeps its own
 * copy of the check too, as a fallback — Part 3 exists specifically to
 * prove middleware catches it even when the layout's cached copy wouldn't.
 *
 * "onboarding incomplete → /onboarding" is NOT covered here. It moved to a
 * client-side guard (OnboardingGuard.tsx) fed by a profile prop cached at
 * the (protected) layout level — same caching mechanism as the is_active
 * bug above, except the onboarding gate was deliberately left as-is (an
 * incorrect redirect there is a UX bug, not a security one) and patched at
 * the call site instead (OnboardingFlow.tsx now does a hard navigation).
 * DO NOT re-add an onboarding assertion to this file — it belongs in
 * onboarding.spec.ts, which logs in as a genuinely incomplete-onboarding
 * user. Nothing in this file's AUTH_FILE fixture ever is one
 * (global-setup.ts always sets onboardingComplete: true).
 *
 * WHY this test exists:
 *   - CVE-2025-29927 (CVSS 9.1) was a middleware auth-bypass in Next.js
 *     14.2.5 fixed in 14.2.25 — the exact file Part 1 exercises.
 *   - A future Next.js 15/16 migration rewrites middleware.ts (async cookies/
 *     headers). This test is the regression net for that change.
 *
 * Part 1 (unauthenticated redirects) — no auth state, always runs.
 * Part 2 (authenticated non-admin access control) — requires AUTH_FILE.
 * Part 3 (blocked-user redirect) — logs in independently via
 *   /api/test/e2e-login, does NOT use AUTH_FILE. Flips the shared test
 *   account's is_active mid-test, restores it to true in afterAll —
 *   safe only because playwright.config.ts runs workers: 1 /
 *   fullyParallel: false.
 */

import { test, expect, request as pwRequest } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const AUTH_FILE = path.join(__dirname, ".auth", "user.json");
const hasAuth = fs.existsSync(AUTH_FILE);

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const SECRET = process.env.E2E_TEST_SECRET;
const EMAIL = process.env.TEST_USER_EMAIL;
const canTestBlocking = !!SECRET && !!EMAIL;

// Logs the shared test account in via /api/test/e2e-login, bypassing the
// real app flows entirely (same approach global-setup.ts already uses).
// Returns the storage state for the NEW session this call mints — caller
// decides whether to apply those cookies to a page or just rely on the
// DB-row side effect (e.g. flipping is_active under an already-open tab).
async function e2eLogin(overrides: { onboardingComplete?: boolean; isActive?: boolean }) {
  const ctx = await pwRequest.newContext({ baseURL: BASE_URL });
  const res = await ctx.post("/api/test/e2e-login", {
    headers: { "x-e2e-secret": SECRET! },
    data: { onboardingComplete: true, ...overrides },
  });
  if (!res.ok()) {
    throw new Error(`e2e-login failed: ${res.status()} ${await res.text()}`);
  }
  const state = await ctx.storageState();
  await ctx.dispose();
  return state;
}

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

// ---------------------------------------------------------------------------
// Part 3: Blocked user is caught on the next request even via a soft,
// client-side nav — not just on a hard refresh.
// ---------------------------------------------------------------------------

test.describe("middleware — blocked user redirect", () => {
  test.afterAll(async () => {
    if (!canTestBlocking) return;
    // Restoring is_active alone is NOT enough. The test below triggers
    // middleware's signOut({ scope: "global" }) for this account, which
    // revokes EVERY session that account has — including the one
    // global-setup.ts already minted into AUTH_FILE before this file ever
    // ran. That session is now permanently dead, not just blocked. Every
    // later spec file using test.use({ storageState: AUTH_FILE }) needs a
    // genuinely fresh session, not a restored flag on a revoked one. First
    // run of this test didn't do this and broke 12 tests in 4 other files.
    const state = await e2eLogin({ isActive: true });
    fs.writeFileSync(AUTH_FILE, JSON.stringify(state, null, 2));
  });

  test("user blocked mid-session is redirected on next in-app nav, not just on refresh", async ({
    page,
  }) => {
    test.skip(!canTestBlocking, "requires TEST_USER_EMAIL / E2E_TEST_SECRET");

    // Next.js prefetches in-viewport <Link>s automatically, and the
    // sidebar nav is always in viewport. Without this, a prefetch issued
    // before we flip is_active below could get reused at click time,
    // making this test flaky in a way that has nothing to do with whether
    // the fix actually works. Forcing every nav to hit the server fresh
    // is what makes this a real regression test instead of a coin flip.
    await page.route("**/*", (route) => {
      const headers = route.request().headers();
      if (headers["next-router-prefetch"]) return route.abort();
      return route.continue();
    });

    const state = await e2eLogin({ isActive: true });
    await page.context().addCookies(state.cookies);

    await page.goto("/dashboard");
    await expect(page).not.toHaveURL(/\/login/);

    // Real in-app link click — soft client-side navigation, not page.goto.
    // This warms the (protected) layout's Router Cache entry exactly the
    // way the original onboarding bug got warmed.
    const nav = page.locator('nav[aria-label="Main navigation"]');
    await nav.getByRole("link", { name: "Settings" }).click();
    await expect(page).toHaveURL(/\/settings/);

    // Simulate an admin blocking this account mid-session: flip is_active
    // in the DB directly, without touching this page's existing cookies.
    // The browser still has a completely normal, valid session — only the
    // DB row changed underneath it, exactly like a real admin action would.
    await e2eLogin({ isActive: false });

    // Another soft nav to a sibling route under the same layout. Before
    // the middleware fix, this could silently reuse the cached layout and
    // land on /tracker instead of bouncing to /login.
    await nav.getByRole("link", { name: "Tracker" }).click();

    await expect(page).toHaveURL(/\/login/);
    await expect(page).toHaveURL(/error=blocked/);
  });
});
