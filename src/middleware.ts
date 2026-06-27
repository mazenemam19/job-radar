// src/middleware.ts
// NEW FILE — does not exist in the original codebase.
//
// Redirects unauthenticated users to /login for all protected routes.
// All other checks (blocked user, onboarding, admin gate) happen in
// the (protected) layout and individual route handlers — where we
// already have a server-side Supabase client and profile data.

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
