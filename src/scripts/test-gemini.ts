// src/scripts/test-gemini.ts
import { config } from "dotenv";
import path from "path";
config({ path: path.resolve(process.cwd(), ".env.local") });

import { filterJobsWithGemini } from "../lib/v2/gemini";
import { createAdminClient } from "../lib/v2/supabase/admin";
import { resolveUserSettings } from "../lib/v2/settings";
import type { RawJob } from "../lib/v2/types";

(async () => {
  const db = createAdminClient();
  const { data: profile } = await db
    .from("user_profiles")
    .select("gemini_api_key, id")
    .limit(1)
    .single();

  if (!profile || !profile.gemini_api_key) {
    console.error("No gemini api key found in profiles");
    return;
  }

  const settings = await resolveUserSettings(profile.id);

  // Grab a few raw jobs
  const { data: rawJobs } = await db.from("raw_jobs").select("*").limit(3);
  if (!rawJobs || !rawJobs.length) {
    console.log("No raw jobs found in DB to test");
    return;
  }

  console.log(`Testing Gemini filter on ${rawJobs.length} jobs...`);
  try {
    const results = await filterJobsWithGemini(
      profile.gemini_api_key,
      rawJobs as RawJob[],
      settings,
    );
    console.log("Results count:", results.length);
    console.log(
      "Details:",
      JSON.stringify(
        results.map((r) => ({ title: r.title, pass: r.gemini_pass, reason: r.gemini_reason })),
        null,
        2,
      ),
    );
  } catch (err) {
    console.error("Gemini failed:", err);
  }
})();
