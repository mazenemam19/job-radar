// src/scripts/test-wpstartupjobs.ts
import { config } from "dotenv";
import path from "path";
config({ path: path.resolve(process.cwd(), ".env.local") });

import { fetchWPStartupJobs } from "../lib/sources/wp-startup-jobs";

async function test() {
  console.log("Starting WPStartupJobs test (Berlin & London)...");
  try {
    console.log("\n--- Testing Berlin ---");
    const berlin = await fetchWPStartupJobs(
      "https://berlinstartupjobs.com",
      "Berlin",
      "Germany",
      "🇩🇪",
      "global",
    );
    console.log(`Berlin: Fetched ${berlin.jobs.length} matched / ${berlin.rawCount} raw jobs`);

    console.log("\n--- Testing London ---");
    const london = await fetchWPStartupJobs(
      "https://londonstartupjobs.co.uk",
      "London",
      "UK",
      "🇬🇧",
      "global",
    );
    console.log(`London: Fetched ${london.jobs.length} matched / ${london.rawCount} raw jobs`);

    if (berlin.jobs.length > 0) {
      console.log("\n--- Berlin Sample Job ---");
      console.log(JSON.stringify(berlin.jobs[0], null, 2));
    }

    process.exit(0);
  } catch (err) {
    console.error("Test failed:", err);
    process.exit(1);
  }
}

test();
