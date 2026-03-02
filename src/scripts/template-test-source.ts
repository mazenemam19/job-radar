/**
 * TEMPLATE: Standalone Integration Test for New Job Sources
 *
 * MANDATE: NEVER use 'pnpm run cron:now' for iterative development.
 * Use this template to create 'src/scripts/test-[board].ts'.
 *
 * Usage: ts-node --project tsconfig.scripts.json src/scripts/test-[board].ts
 */

// import { fetch[BoardName] } from '../lib/sources/[board-file]';
// import { JobMode } from '../lib/types';

async function main() {
  const boardName = "REPLACE_ME"; // e.g., 'Workable'
  console.log("🚀 Starting standalone test for " + boardName + "...");

  try {
    // 1. Fetch raw data
    // Pass 'local' or 'global' mode as needed
    // const jobs = await fetch[BoardName]('local' as JobMode);
    const jobs: any[] = []; // Replace with actual fetch call during integration

    console.log("\n📊 Results: Fetched " + jobs.length + " jobs total.");

    // 2. Verify Tech Gate (React/Next.js)
    const techMatches = jobs.filter((j) =>
      /\b(react|next\.?js)\b/i.test((j.title || "") + " " + (j.description || "")),
    );
    console.log(
      "✅ Tech Gate: " + techMatches.length + "/" + jobs.length + " jobs match React/Next.js",
    );

    // 3. Verify Level Gate (No Junior/Intern/Senior Manager)
    const levelMatches = jobs.filter((j) => {
      const t = (j.title || "").toLowerCase();
      const junior = /\b(junior|intern|trainee|associate)\b/.test(t);
      const senior = /\b(lead|principal|staff|manager|director|vp|head)\b/.test(t);
      return !junior && !senior;
    });
    console.log(
      "✅ Level Gate: " +
        levelMatches.length +
        "/" +
        jobs.length +
        " jobs are Mid-Senior (Non-Lead/Non-Junior)",
    );

    // 4. Sample Output
    if (jobs.length > 0) {
      console.log("\n📝 Sample Job (First Match):");
      console.log(JSON.stringify(jobs[0], null, 2));
    }
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

main().catch(console.error);
