// src/lib/sources/global-companies.ts
// "Global Remote" pipeline — worldwide remote companies that accept Egypt/GMT+2 applicants.
// Filter: rejects US-timezone-only, must-be-authorized-in-country, EU-resident-only.

import type { Job } from "../types";
import { fetchGreenhouse, fetchLever, fetchAshby, fetchWorkable, fetchTeamtailor, fetchBreezy, fetchSmartRecruiters, fetchRemoteOK, fetchWWR, type ATSConfig, resetWorkableUsed } from "./ats-utils";
import { getNextBatch } from "../state";

const MODE = "global";
const VISA = false;

const COMPANIES: ATSConfig[] = [
  // ── Stable Core (Verified Greenhouse) ───────────────────────────────────
  { ats: "greenhouse", name: "Webflow",        slug: "webflow",          country: "Global", countryFlag: "🌍" },
  { ats: "greenhouse", name: "Mercury",        slug: "mercury",          country: "Global", countryFlag: "🌍" },
  { ats: "greenhouse", name: "Vercel",         slug: "vercel",           country: "Global", countryFlag: "🌍" },
  { ats: "greenhouse", name: "Airbnb",         slug: "airbnb",           country: "Global", countryFlag: "🌍" },
  { ats: "greenhouse", name: "Discord",        slug: "discord",          country: "Global", countryFlag: "🌍" },
  { ats: "greenhouse", name: "Coinbase",       slug: "coinbase",         country: "Global", countryFlag: "🌍" },
  { ats: "greenhouse", name: "Figma",          slug: "figma",            country: "Global", countryFlag: "🌍" },
  { ats: "greenhouse", name: "Grafana",        slug: "grafanalabs",      country: "Global", countryFlag: "🌍" },
  { ats: "greenhouse", name: "Netlify",        slug: "netlify",          country: "Global", countryFlag: "🌍" },
  { ats: "greenhouse", name: "Lyft",           slug: "lyft",             country: "Global", countryFlag: "🌍" },
  { ats: "greenhouse", name: "Reddit",         slug: "reddit",           country: "Global", countryFlag: "🌍" },
  { ats: "greenhouse", name: "Pinterest",      slug: "pinterest",        country: "Global", countryFlag: "🌍" },
  { ats: "greenhouse", name: "Databricks",     slug: "databricks",       country: "Global", countryFlag: "🌍" },
  { ats: "greenhouse", name: "HubSpot",        slug: "hubspot",          country: "Global", countryFlag: "🌍" },
  { ats: "greenhouse", name: "Twilio",         slug: "twilio",           country: "Global", countryFlag: "🌍" },
  { ats: "greenhouse", name: "Okta",           slug: "okta",             country: "Global", countryFlag: "🌍" },

  // ── Stable Core (Verified Ashby) ────────────────────────────────────────
  { ats: "ashby",      name: "Posthog",        slug: "posthog",          country: "Global", countryFlag: "🌍" },
  { ats: "ashby",      name: "Infisical",      slug: "infisical",        country: "Global", countryFlag: "🌍" },
  { ats: "ashby",      name: "Resend",         slug: "resend",           country: "Global", countryFlag: "🌍" },
  { ats: "ashby",      name: "Stytch",         slug: "stytch",           country: "Global", countryFlag: "🌍" },
  { ats: "ashby",      name: "Raycast",        slug: "raycast",          country: "Global", countryFlag: "🌍" },
  { ats: "ashby",      name: "Supabase",       slug: "supabase",         country: "Global", countryFlag: "🌍" },
  { ats: "ashby",      name: "Neon",           slug: "neon",             country: "Global", countryFlag: "🌍" },
  { ats: "ashby",      name: "Plain",          slug: "plain",            country: "Global", countryFlag: "🌍" },
  { ats: "ashby",      name: "Linear",         slug: "linear",           country: "Global", countryFlag: "🌍" },
  { ats: "ashby",      name: "Airbyte",        slug: "airbyte",          country: "Global", countryFlag: "🌍" },

  // ── Stable Core (Verified Workable) ──────────────────────────────────────
  { ats: "workable",   name: "Learnworlds",    slug: "learnworlds",      country: "Global", countryFlag: "🌍" },
  { ats: "workable",   name: "Clerk",          slug: "clerk",            country: "Global", countryFlag: "🌍" },
  { ats: "workable",   name: "Sanity",         slug: "sanity",           country: "Global", countryFlag: "🌍" },
];

export async function fetchGlobalJobs(): Promise<Job[]> {
  resetWorkableUsed(MODE);

  const workables = COMPANIES.filter(c => c.ats === "workable");
  const others = COMPANIES.filter(c => c.ats !== "workable");

  const batchWorkable = await getNextBatch(workables, 8, "global-workable");
  const toScan = [...others, ...batchWorkable];

  const results = await Promise.allSettled(
    toScan.map(c => {
      switch (c.ats) {
        case "greenhouse":      return fetchGreenhouse(c, MODE, VISA);
        case "lever":           return fetchLever(c, MODE, VISA);
        case "ashby":           return fetchAshby(c, MODE, VISA);
        case "workable":        return fetchWorkable(c, MODE, VISA);
        case "teamtailor":      return fetchTeamtailor(c, MODE, VISA);
        case "breezy":          return fetchBreezy(c, MODE, VISA);
        case "smartrecruiters": return fetchSmartRecruiters(c, MODE, VISA);
        default:                return Promise.resolve([] as Job[]);
      }
    }),
  );

  const all: Job[] = [];
  const seen = new Set<string>();
  for (const r of results) {
    if (r.status === "fulfilled") {
      for (const j of r.value) { if (!seen.has(j.id)) { seen.add(j.id); all.push(j); } }
    } else {
      console.error("[global] Unhandled rejection:", r.reason);
    }
  }

  // ── Custom fetchers (Verified direct APIs) ───────────────────────────
  const customResults = await Promise.allSettled([
    fetchRemoteOK(MODE),
    fetchWWR(MODE),
  ]);
  for (const r of customResults) {
    if (r.status === "fulfilled") {
      for (const j of r.value) { if (!seen.has(j.id)) { seen.add(j.id); all.push(j); } }
    } else {
      console.error("[global] Custom fetcher error:", r.reason);
    }
  }

  console.log(`[global] Total: ${all.length} jobs`);
  return all;
}
