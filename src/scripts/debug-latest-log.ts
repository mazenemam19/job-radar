// src/scripts/debug-latest-log.ts
import { config } from "dotenv";
import path from "path";
config({ path: path.resolve(process.cwd(), ".env.local") });
import { readStore } from "../lib/storage";

async function main() {
  const store = await readStore();
  const latestLog = store.cronLogs[0];

  if (!latestLog) {
    console.log("No cron logs found.");
    return;
  }

  console.log(`--- Latest Cron Log: ${latestLog.runAt} ---`);
  console.log(`New: ${latestLog.newJobs}, Total: ${latestLog.totalJobs}`);

  if (latestLog.sourceDetails) {
    console.log("\nSource Details:");
    const sources = Object.entries(latestLog.sourceDetails);
    sources.sort((a, b) => a[0].localeCompare(b[0]));

    console.log(`${"Source".padEnd(25)} | Raw | Regex | Gemini | Final | Reliability`);
    console.log("-".repeat(85));

    sources.forEach(([name, details]) => {
      const regexFiltered = details.count || 0;
      const geminiFiltered = details.geminiFiltered || 0;
      const finalMatched = Math.max(0, regexFiltered - geminiFiltered);
      const reliability = details.total ? `${details.success}/${details.total}` : "0/0";

      console.log(
        `${name.padEnd(25)} | ${String(details.rawCount || 0).padStart(3)} | ${String(regexFiltered).padStart(5)} | ${String(geminiFiltered).padStart(6)} | ${String(finalMatched).padStart(5)} | ${reliability}`,
      );
    });
  } else {
    console.log("No sourceDetails in latest log.");
  }
}

main().catch(console.error);
