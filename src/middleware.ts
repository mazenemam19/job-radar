// src/middleware.ts
// Redirects unauthenticated users to /login, and signs out + redirects
// blocked users, for all protected routes.
//
// Onboarding and the admin-role gate live in the (protected) layout and
// admin/layout.tsx instead, where there's already a server-side Supabase
// client and profile data. The blocked-user check does NOT live there —
// it lives here, in middleware, on purpose. The (protected) layout is a
// cached dynamic segment: Next's Router Cache can serve a soft client-side
// navigation from a previously-rendered layout without re-running the
// server component at all, which means a check placed only in that layout
// can be skipped entirely for a user who's already mid-session. Middleware
// runs on every request before that cache negotiation happens, so it's the
// only place a security-relevant check is guaranteed to fire immediately,
// even on an in-app link click. (See onboarding.spec.ts and the bug it
// covers for the layout-cache mechanism this sidesteps — that one was a UX
// bug; the same gap on is_active would have been a live security one.)
//
// The (protected) layout keeps its own is_active check too, as a redundant
// fallback. Costs one extra DB read on a fully fresh load; not worth
// removing for that.

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

//  paths that don't require any authentication
const PUBLIC_PATHS = new Set(["/", "/login", "/submit"]);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ── Public paths ────────────────────────────────────────────
  if (PUBLIC_PATHS.has(pathname)) {
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

  // ── Blocked user ────────────────────────────────────────────
  // Checked fresh on every request, deliberately not cached — see the
  // file header for why this can't live only in the (protected) layout.
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("is_active")
    .eq("id", user.id)
    .single();

  if (profile && !profile.is_active) {
    // Default scope is already 'global' (auth-js: signOut(options = { scope:
    // 'global' })) — explicit here so it's not a silent default. This is
    // the right call for a block action: it revokes every session for this
    // user, not just the one making this particular request. It also means
    // any test that exercises this path destroys every other session that
    // user had, including ones minted earlier in the same test run — see
    // the afterAll in auth.spec.ts's "blocked user redirect" describe block
    // for what that cost us the first time this test actually ran.
    await supabase.auth.signOut({ scope: "global" });
    return NextResponse.redirect(new URL("/login?error=blocked", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/onboarding",
    "/dashboard/:path*",
    "/admin/:path*",
    "/pipeline/:path*",
    "/salary/:path*",
    "/settings/:path*",
    "/tracker/:path*",
  ],
};
