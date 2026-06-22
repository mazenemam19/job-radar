// src/lib/supabase/admin.ts
// Service-role Supabase client that bypasses RLS.
// ONLY import this in server-side code (API routes, cron handlers).
// NEVER expose to the browser – this key has full DB access.

import { createClient } from "@supabase/supabase-js";

import type { Database } from "../database.types";

let adminClient: ReturnType<typeof createClient<Database>> | null = null;

/**
 * Returns a singleton Supabase client using the service role key.
 * Bypasses all RLS policies. Use for:
 *  - Cron job writes (raw_jobs, app_config, cron_logs_v2)
 *  - Admin API routes (user management, company CRUD, defaults)
 *  - Any operation that needs to see/write other users' data
 */
export function createAdminClient() {
  if (adminClient) return adminClient;

  adminClient = createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  return adminClient;
}
