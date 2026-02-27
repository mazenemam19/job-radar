// src/lib/sources/global-companies.ts
// "Global Remote" pipeline — worldwide remote companies that accept Egypt/GMT+2 applicants.

import type { Job } from "../types";
import { fetchGreenhouse, fetchLever, fetchAshby, fetchWorkable, fetchSmartRecruiters, type ATSConfig } from "./ats-utils";

const MODE = "global";
const VISA = false;

const COMPANIES: ATSConfig[] = [
  // ── Greenhouse ──────────────────────────────────────────────────────────────
  { ats: "greenhouse", name: "GitLab",      slug: "gitlab",    country: "Global", countryFlag: "🌍" },
  { ats: "greenhouse", name: "Webflow",     slug: "webflow",   country: "Global", countryFlag: "🌍" },
  { ats: "greenhouse", name: "Netlify",     slug: "netlify",   country: "Global", countryFlag: "🌍" },
  { ats: "greenhouse", name: "Knock",       slug: "knock",     country: "Global", countryFlag: "🌍" },
  { ats: "greenhouse", name: "Mercury",     slug: "mercury",   country: "Global", countryFlag: "🌍" },

  // ── Ashby (verified working) ────────────────────────────────────────────────
  { ats: "ashby", name: "Linear",       slug: "linear",       country: "Global", countryFlag: "🌍" },
  { ats: "ashby", name: "Doist",        slug: "doist",        country: "Global", countryFlag: "🌍" },
  { ats: "ashby", name: "Close",        slug: "close",        country: "Global", countryFlag: "🌍" },
  { ats: "ashby", name: "Resend",       slug: "resend",       country: "Global", countryFlag: "🌍" },
  { ats: "ashby", name: "Zed",          slug: "zed",          country: "Global", countryFlag: "🌍" },
  { ats: "ashby", name: "Stytch",       slug: "stytch",       country: "Global", countryFlag: "🌍" },
  { ats: "ashby", name: "Posthog",      slug: "posthog",      country: "Global", countryFlag: "🌍" },
  { ats: "ashby", name: "Clerk",        slug: "clerk",        country: "Global", countryFlag: "🌍" },
  { ats: "ashby", name: "Sanity",       slug: "sanity",       country: "Global", countryFlag: "🌍" },
  { ats: "ashby", name: "Infisical",    slug: "infisical",    country: "Global", countryFlag: "🌍" },
  { ats: "ashby", name: "Neon",         slug: "neon",         country: "Global", countryFlag: "🌍" },
  { ats: "ashby", name: "Attio",        slug: "attio",        country: "Global", countryFlag: "🌍" },
  { ats: "ashby", name: "Raycast",      slug: "raycast",      country: "Global", countryFlag: "🌍" },
  { ats: "ashby", name: "Zapier",       slug: "zapier",       country: "Global", countryFlag: "🌍" },
  { ats: "ashby", name: "Retool",       slug: "retool",       country: "Global", countryFlag: "🌍" },
  { ats: "ashby", name: "Vercel",       slug: "vercel",       country: "Global", countryFlag: "🌍" },
  { ats: "ashby", name: "Buffer",       slug: "buffer",       country: "Global", countryFlag: "🌍" },
  { ats: "ashby", name: "Plain",        slug: "plain",        country: "Global", countryFlag: "🌍" },
  { ats: "ashby", name: "Supabase",     slug: "supabase",     country: "Global", countryFlag: "🌍" },
  { ats: "ashby", name: "Help Scout",   slug: "helpscout",    country: "Global", countryFlag: "🌍" },
  { ats: "ashby", name: "Deel",         slug: "deel",         country: "Global", countryFlag: "🌍" },

  // ── Lever (verified working) ────────────────────────────────────────────────
  { ats: "lever", name: "Whereby",      slug: "whereby",      country: "Global", countryFlag: "🌍" },

  // ── Workable ────────────────────────────────────────────────────────────────
  { ats: "workable", name: "Toggl",         slug: "toggl",        country: "Global", countryFlag: "🌍" },
  { ats: "workable", name: "Learnworlds",   slug: "learnworlds",  country: "Global", countryFlag: "🌍" },
  { ats: "workable", name: "Appsflyer",     slug: "appsflyer",    country: "Global", countryFlag: "🌍" },
  { ats: "workable", name: "Kaizen Gaming", slug: "kaizengaming", country: "Global", countryFlag: "🌍" },
];

export async function fetchGlobalJobs(): Promise<Job[]> {
  const results = await Promise.allSettled(
    COMPANIES.map(c => {
      switch (c.ats) {
        case "greenhouse":      return fetchGreenhouse(c, MODE, VISA);
        case "lever":           return fetchLever(c, MODE, VISA);
        case "ashby":           return fetchAshby(c, MODE, VISA);
        case "workable":        return fetchWorkable(c, MODE, VISA);
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
  console.log(`[global] Total: ${all.length} jobs`);
  return all;
}
