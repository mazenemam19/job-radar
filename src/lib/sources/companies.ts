// src/lib/sources/companies.ts
import type { Job } from "../types";
import { fetchGreenhouse, fetchLever, fetchAshby, fetchWorkable, fetchTeamtailor, fetchBreezy, fetchSmartRecruiters, type ATSConfig } from "./ats-utils";

const MODE = "visa";
const VISA = true;

const COMPANIES: ATSConfig[] = [
  // ── Confirmed Remote Giants ─────────────────────────────────────────────
  { ats: "greenhouse", name: "GitLab", slug: "gitlab", country: "Global", countryFlag: "🌐" },
  { ats: "greenhouse", name: "Adyen", slug: "adyen", country: "Netherlands", countryFlag: "🇳🇱" },
  { ats: "greenhouse", name: "Monzo", slug: "monzo", country: "United Kingdom", countryFlag: "🇬🇧" },
  { ats: "greenhouse", name: "N26", slug: "n26", country: "Germany", countryFlag: "🇩🇪" },
  { ats: "greenhouse", name: "Typeform", slug: "typeform", country: "Spain", countryFlag: "🇪🇸" },
  { ats: "greenhouse", name: "Intercom", slug: "intercom", country: "Ireland", countryFlag: "🇮🇪" },
  { ats: "greenhouse", name: "Contentful", slug: "contentful", country: "Germany", countryFlag: "🇩🇪" },
  { ats: "greenhouse", name: "Speechify", slug: "speechify", country: "USA", countryFlag: "🇺🇸" },
];

export async function fetchCompanyJobs(): Promise<Job[]> {
  const results = await Promise.allSettled(
    COMPANIES.map(c => {
      switch (c.ats) {
        case "greenhouse": return fetchGreenhouse(c, MODE, VISA);
        case "lever": return fetchLever(c, MODE, VISA);
        case "ashby": return fetchAshby(c, MODE, VISA);
        case "workable": return fetchWorkable(c, MODE, VISA);
        case "teamtailor": return fetchTeamtailor(c, MODE, VISA);
        case "breezy": return fetchBreezy(c, MODE, VISA);
        case "smartrecruiters": return fetchSmartRecruiters(c, MODE, VISA);
        default: return Promise.resolve([] as Job[]);
      }
    }),
  );

  const all: Job[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") all.push(...r.value);
    else console.error("[visa] Unhandled rejection:", r.reason);
  }
  console.log(`[visa] Total: ${all.length} jobs`);
  return all;
}
