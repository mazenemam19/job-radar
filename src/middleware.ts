// src/middleware.ts
// NEW FILE — does not exist in the original codebase.
//
// Protects /* routes:
//   - Unauthenticated → /login
//   - Authenticated + onboarding incomplete → /onboarding
//   - Admin route + non-admin → /dashboard
//   - Blocked user → /login?error=blocked
//
// The old app routes (/, /api/cron, etc.) are NOT matched by the config
// below and are completely unaffected.

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

//  paths that don't require any authentication
const PUBLIC_PATHS = new Set(["/", "/login", "/submit"]);

//  paths that need auth but are exempt from the onboarding redirect
const ONBOARDING_EXEMPT = new Set(["/onboarding", "/login"]);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Build a mutable response so we can set cookies (session refresh)
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  // Create an SSR-aware Supabase client that reads/writes cookies
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Write cookies to both request (for downstream handlers) and response
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Validate JWT with Supabase (not from cache) — required for security
  const {
    data: { user },
    error: getUserError,
  } = await supabase.auth.getUser();

  // TEMPORARY — diagnosing a CI-only auth failure where this call appears to
  // come back empty despite a valid, freshly-minted cookie. getUserError is
  // normally just discarded; logging it here surfaces whatever Supabase (or
  // the network call to reach it) is actually saying, directly in CI's
  // captured [WebServer] output. Remove once root-caused.
  if (getUserError) {
    console.error(
      `[middleware] getUser failed for ${pathname}:`,
      getUserError.name,
      getUserError.status,
      getUserError.message,
    );
  }

  // ── Public paths ────────────────────────────────────────────
  if (PUBLIC_PATHS.has(pathname)) {
    // If already authenticated, send away from login page
    if (pathname === "/login" && user) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return response;
  }

  // ── All remaining /* paths need authentication ────────────
  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Fetch profile for role + onboarding check
  // One DB call covers both checks; acceptable latency trade-off for this scale.
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role, onboarding_complete, is_active")
    .eq("id", user.id)
    .single();

  // ── Blocked user ─────────────────────────────────────────────
  if (profile && !profile.is_active) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=blocked", request.url));
  }

  // ── Admin gate ───────────────────────────────────────────────
  if (pathname.startsWith("/admin")) {
    if (!profile || profile.role !== "admin") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return response;
  }

  // ── Onboarding gate ──────────────────────────────────────────
  // If onboarding not complete, redirect to /onboarding
  // UNLESS they're already heading there or to an exempt path.
  if (!ONBOARDING_EXEMPT.has(pathname) && profile && !profile.onboarding_complete) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    // Only intercept routes that explicitly start with your protected sections
    "/dashboard/:path*",
    "/admin/:path*",
    "/pipeline/:path*",
    "/salary/:path*",
    "/settings/:path*",
    "/tracker/:path*",
  ],
};
