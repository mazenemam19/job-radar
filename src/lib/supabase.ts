import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn("Supabase credentials missing. Storage operations will fail.");
}

// Supabase client configuration
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
  },
  global: {
    fetch: (url, options) => fetch(url, { ...options, cache: "no-store" }),
  },
});
