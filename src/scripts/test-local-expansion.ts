import { fetchWorkable, fetchBreezy, type ATSConfig } from "../lib/sources/ats-utils";
import { Job, JobMode } from "../lib/types";

const FLAG = "🇪🇬";
const MODE = "local" as JobMode;
const VISA = false;

async function testExpansion() {
  console.log("🚀 Verifying local source expansion...");

  const targets: ATSConfig[] = [
    { ats: "workable", name: "MNT-Halan", slug: "mnt-halan", country: "Egypt", countryFlag: FLAG },
    { ats: "workable", name: "Rabbit", slug: "rabbitmart", country: "Egypt", countryFlag: FLAG },
    { ats: "breezy", name: "Grinta", slug: "grinta", country: "Egypt", countryFlag: FLAG },
  ];

  for (const company of targets) {
    console.log(`
🔍 Checking ${company.name} (${company.ats})...`);
    try {
      let jobs: Job[] = [];
      if (company.ats === "workable") {
        jobs = await fetchWorkable(company, MODE, VISA);
      } else if (company.ats === "breezy") {
        jobs = await fetchBreezy(company, MODE, VISA);
      }

      console.log(`✅ Success! Found ${jobs.length} jobs.`);
      if (jobs.length > 0) {
        console.log(`   Sample: ${jobs[0].title}`);
      }
    } catch (err) {
      console.error(`❌ Failed to fetch ${company.name}:`, err);
    }
  }
}

testExpansion().catch(console.error);
