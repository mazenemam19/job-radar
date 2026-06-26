/**
 * global-setup.ts
 *
 * Runs once before the full test suite. Establishes a real, authenticated
 * Supabase session for TEST_USER_EMAIL without touching Google's OAuth UI —
 * Playwright can't drive that reliably, and CI shouldn't hold real Google
 * credentials anyway.
 *
 * How: POSTs to /api/test/e2e-login (gated by E2E_TEST_SECRET), which mints
 * a real session via Supabase's admin API and writes real session cookies.
 * See that route for the full explanation of why this approach — not the
 * common "drop a session into localStorage" trick — is required here: this
 * app stores sessions in cookies via @supabase/ssr, not localStorage, and
 * uses the PKCE flow, which a server-generated magic link can't satisfy if
 * visited cold in a fresh browser context.
 *
 * If TEST_USER_EMAIL or E2E_TEST_SECRET are unset, auth-gated tests skip
 * gracefully — the unauthenticated redirect tests in auth.spec.ts still run.
 */

import { request, type FullConfig } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const AUTH_FILE_PATH = path.join(__dirname, ".auth", "user.json");

export default async function globalSetup(config: FullConfig) {
  const email = process.env.TEST_USER_EMAIL;
  const secret = process.env.E2E_TEST_SECRET;

  if (!email || !secret) {
    console.warn(
      "\n[e2e/global-setup] TEST_USER_EMAIL and/or E2E_TEST_SECRET not set.\n" +
        "  → Unauthenticated redirect tests will still run.\n" +
        "  → Auth-gated tests (dashboard, settings, tracker) will be skipped.\n",
    );
    if (fs.existsSync(AUTH_FILE_PATH)) fs.unlinkSync(AUTH_FILE_PATH);
    return;
  }

  const authDir = path.dirname(AUTH_FILE_PATH);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  const baseURL =
    config.projects[0]?.use?.baseURL ?? process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

  // An API request context has its own cookie jar, separate from any
  // browser. The Set-Cookie header from the login route lands in that jar,
  // and storageState() serializes it to the same format a browser context
  // uses — that's what lets test files load it via `test.use({ storageState })`.
  const context = await request.newContext({ baseURL });

  try {
    const response = await context.post("/api/test/e2e-login", {
      headers: { "x-e2e-secret": secret },
      data: { onboardingComplete: true },
    });

    if (!response.ok()) {
      throw new Error(
        `/api/test/e2e-login returned ${response.status()}: ${await response.text()}`,
      );
    }

    await context.storageState({ path: AUTH_FILE_PATH });
    console.log(`[e2e/global-setup] Auth state saved → ${AUTH_FILE_PATH}`);
  } catch (error) {
    console.error("[e2e/global-setup] Auth setup failed:", error);
    throw error;
  } finally {
    await context.dispose();
  }
}
