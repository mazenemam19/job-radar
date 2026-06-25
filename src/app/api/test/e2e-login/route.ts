// src/app/api/test/e2e-login/route.ts
//
// TEST-ONLY: issues a real, valid session for a designated test user without
// going through Google OAuth. Gated by E2E_TEST_SECRET — if that env var is
// unset (true in every real deployment), this route 404s as if it didn't
// exist. Setting E2E_TEST_SECRET in production would be a deployment
// mistake, not a default risk.
//
// WHY this exists: the app's only login path is Google OAuth
// (signInWithOAuth). Playwright cannot drive Google's real consent screen
// safely or reliably (bot detection, real credentials, 2FA). This route
// mints a real Supabase session for a known test user via the admin API's
// generateLink + a server-side verifyOtp call. verifyOtp is used — not a
// browser navigation to the magic-link URL — specifically because this
// app's Supabase clients default to the PKCE flow, and a server-generated
// link visited cold has no matching code_verifier in the browser. verifyOtp
// sidesteps that: it returns a session directly, no PKCE exchange involved.
//
// The session is written via the same cookie-aware `createServerClient()`
// every other authenticated route in this app uses, so the resulting
// cookies are indistinguishable from a real Google sign-in.
//
// This route bypasses /auth/callback entirely, so it also mirrors that
// route's user_profiles upsert — otherwise the test user would have no
// profile row and middleware would bounce it to /onboarding.
//
// SECURITY NOTE: the account to log into is read from TEST_USER_EMAIL on
// the server, never from the request body. This means a leaked
// E2E_TEST_SECRET only ever grants a session for that one pre-configured
// test account — it cannot be used to impersonate an arbitrary real user.

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const expectedSecret = process.env.E2E_TEST_SECRET;
  if (!expectedSecret) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const providedSecret = request.headers.get("x-e2e-secret");
  if (!providedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // The email is NOT taken from the request body. If it were, a leaked
  // secret would let an attacker mint a session for any real user's email,
  // not just a disposable test account. Instead, this route only ever
  // logs into the single pre-configured test account — even with the
  // secret in hand, there is no input that lets you choose a different
  // identity to assume.
  const email = process.env.TEST_USER_EMAIL;
  if (!email) {
    return NextResponse.json({ error: "TEST_USER_EMAIL not configured" }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const onboardingComplete = body?.onboardingComplete ?? true;

  const admin = createAdminClient();

  // type: "magiclink" auto-creates the user if they don't already exist —
  // no separate createUser step needed.
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  if (linkError || !linkData) {
    console.error("[test/e2e-login] generateLink failed:", linkError?.message);
    return NextResponse.json({ error: "could not create test session" }, { status: 500 });
  }

  const tokenHash = linkData.properties?.hashed_token;
  if (!tokenHash) {
    return NextResponse.json({ error: "no token returned from generateLink" }, { status: 500 });
  }

  // verifyOtp must receive ONLY token_hash + type when using a hash —
  // including email alongside it is rejected by Supabase's API with
  // "Only the token_hash and type should be provided". The type must also
  // match how the token was generated: this token came from
  // generateLink({ type: "magiclink" }) above, so it must be verified with
  // type: "magiclink" too — type: "email" is for numeric OTP codes and
  // fails with "Email link is invalid or has expired" on a magic-link token.
  const supabase = createServerClient();
  const { data: sessionData, error: verifyError } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: tokenHash,
  });

  if (verifyError || !sessionData.session) {
    console.error("[test/e2e-login] verifyOtp failed:", verifyError?.message);
    return NextResponse.json({ error: "could not verify test session" }, { status: 500 });
  }

  // Mirror /auth/callback's profile upsert, since this route bypasses it.
  const userId = sessionData.session.user.id;
  const { error: profileError } = await admin.from("user_profiles").upsert(
    {
      id: userId,
      email,
      onboarding_complete: onboardingComplete,
      is_active: true,
      last_active_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (profileError) {
    console.error("[test/e2e-login] profile upsert failed:", profileError.message);
    return NextResponse.json({ error: "could not set up test profile" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, userId });
}
