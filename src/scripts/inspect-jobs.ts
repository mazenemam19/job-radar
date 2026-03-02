import "dotenv/config";
import path from "path";
import { config } from "dotenv";
config({ path: path.resolve(process.cwd(), ".env.local") });

import { readStore } from "../lib/storage";

(async () => {
  console.log("── Inspecting Cloud Jobs ──────────────────");
  try {
    const store = await readStore();
    console.log(`Total jobs in store: ${store.jobs.length}`);

    store.jobs.forEach((j, i) => {
      console.log(`${i + 1}. [${j.company}] ${j.title} (${j.mode})`);
      console.log(`   Location: ${j.location} | Country: ${j.country}`);
      console.log(`   Score: ${j.totalScore} | Skills: ${j.matchedSkills.join(", ")}`);
      console.log("--------------------------------------------");
    });
  } catch (err) {
    console.error("Failed to read store:", err);
  }
})();
