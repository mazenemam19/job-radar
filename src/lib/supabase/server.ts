// src/lib/supabase/server.ts
// Cookie-based Supabase client for use in Server Components, Route Handlers,
// and Server Actions (Next.js 14 App Router).
// Requires: @supabase/ssr
import { createServerClient as createSSRClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "../database.types";
import type { UserProfile } from "../types";

/**
 * Creates an auth-aware Supabase client that reads/writes the session
 * from Next.js cookies. Use this in Server Components and Route Handlers
 * where you need the current user's identity.
 *
 * NOTE: This uses the anon key + RLS. For admin operations that bypass RLS,
 * use createAdminClient() from ./admin.ts instead.
 */
export function createServerClient() {
  const cookieStore = cookies();

  return createSSRClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: Array<{ name: string; value: string; options: Record<string, unknown> }>,
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll can throw in Server Components (read-only context).
            // The middleware will refresh the session cookie instead.
          }
        },
      },
    },
  );
}

/**
 * Returns the currently authenticated user from the Supabase session.
 * Returns null if unauthenticated. Always validates the JWT with Supabase
 * (not from cache) — safe to use for auth checks.
 */
export async function getUser() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Returns the user profile row from public.user_profiles.
 * Returns null if the user is not authenticated or has no profile yet.
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("user_profiles")
    .select(
      "id, email, role, gemini_api_key, onboarding_complete, is_active, created_at, last_active_at",
    )
    .eq("id", userId)
    .single();

  if (error || !data) return null;

  return {
    ...data,
    // The DB stores role as plain string; narrow it to the typed union.
    // Any unrecognised value (e.g. future roles) falls back to 'user'.
    role: data.role === "admin" ? "admin" : "user",
  } satisfies UserProfile;
}
