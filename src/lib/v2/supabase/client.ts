// src/lib/v2/supabase/client.ts
// Browser-side Supabase client for use in Client Components ("use client").
// Singleton pattern – safe to call multiple times.

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "../database.types";

let client: ReturnType<typeof createBrowserClient<Database>> | null = null;

/**
 * Returns a singleton Supabase client for use in browser (client) components.
 * Uses the public anon key + RLS. Session is stored in cookies (httpOnly
 * cookies set by the server-side client), NOT localStorage.
 */
export function createClient() {
  if (client) return client;

  client = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  return client;
}
