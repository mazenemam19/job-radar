// src/lib/sources/global-companies.ts
// "Global Remote" pipeline — worldwide remote companies that accept Egypt/GMT+2 applicants.
// Filter: rejects US-timezone-only, must-be-authorized-in-country, EU-resident-only.

import type { Job } from "../types";
import { fetchGreenhouse, fetchLever, fetchAshby, fetchWorkable, fetchTeamtailor, fetchBreezy, fetchSmartRecruiters, type ATSConfig } from "./ats-utils";

const MODE = "global";
const VISA = false;

const COMPANIES: ATSConfig[] = [
  // ── Greenhouse ─────────────────────────────────────────────────────────────
  { ats: "greenhouse", name: "Automattic",     slug: "automattic",       country: "Global", countryFlag: "🌍" },
  { ats: "greenhouse", name: "GitLab",         slug: "gitlab",           country: "Global", countryFlag: "🌍" },
  { ats: "greenhouse", name: "Hotjar",         slug: "hotjar",           country: "Global", countryFlag: "🌍" },
  { ats: "greenhouse", name: "Spreedly",       slug: "spreedly",         country: "Global", countryFlag: "🌍" },
  { ats: "greenhouse", name: "Netlify",        slug: "netlify",          country: "Global", countryFlag: "🌍" },
  { ats: "greenhouse", name: "Help Scout",     slug: "helpscout",        country: "Global", countryFlag: "🌍" },
  { ats: "greenhouse", name: "Zapier",         slug: "zapier",           country: "Global", countryFlag: "🌍" },
  { ats: "greenhouse", name: "Coda",           slug: "coda",             country: "Global", countryFlag: "🌍" },
  { ats: "greenhouse", name: "Mural",          slug: "mural",            country: "Global", countryFlag: "🌍" },
  { ats: "greenhouse", name: "Close",          slug: "close",            country: "Global", countryFlag: "🌍" },
  { ats: "greenhouse", name: "Webflow",        slug: "webflow",          country: "Global", countryFlag: "🌍" },
  { ats: "greenhouse", name: "Ably",           slug: "ably",             country: "Global", countryFlag: "🌍" },
  { ats: "greenhouse", name: "Crowdin",        slug: "crowdin",          country: "Global", countryFlag: "🌍" },
  { ats: "greenhouse", name: "Maze",           slug: "maze",             country: "Global", countryFlag: "🌍" },
  { ats: "greenhouse", name: "Pexip",          slug: "pexip",            country: "Global", countryFlag: "🌍" },
  { ats: "greenhouse", name: "Sourcegraph",    slug: "sourcegraph",      country: "Global", countryFlag: "🌍" },
  { ats: "greenhouse", name: "Mercury",        slug: "mercury",          country: "Global", countryFlag: "🌍" },
  { ats: "greenhouse", name: "Knock",          slug: "knock",            country: "Global", countryFlag: "🌍" },
  { ats: "greenhouse", name: "Deel",           slug: "deel",             country: "Global", countryFlag: "🌍" },
  { ats: "greenhouse", name: "Oyster",         slug: "oyster-hr",        country: "Global", countryFlag: "🌍" },
  { ats: "greenhouse", name: "Hopin",          slug: "hopin",            country: "Global", countryFlag: "🌍" },
  { ats: "greenhouse", name: "Framer",         slug: "framer",           country: "Global", countryFlag: "🌍" },

  // ── Lever ──────────────────────────────────────────────────────────────────
  { ats: "lever",      name: "Doist",          slug: "doist",            country: "Global", countryFlag: "🌍" },
  { ats: "lever",      name: "Whereby",        slug: "whereby",          country: "Global", countryFlag: "🌍" },
  { ats: "lever",      name: "Buffer",         slug: "buffer",           country: "Global", countryFlag: "🌍" },
  { ats: "lever",      name: "ConvertKit",     slug: "convertkit",       country: "Global", countryFlag: "🌍" },
  { ats: "lever",      name: "Trello",         slug: "trello",           country: "Global", countryFlag: "🌍" },
  { ats: "lever",      name: "Productboard",   slug: "productboard",     country: "Global", countryFlag: "🌍" },
  { ats: "lever",      name: "Pitch",          slug: "pitch",            country: "Global", countryFlag: "🌍" },
  { ats: "lever",      name: "Kontent.ai",     slug: "kontent-ai",       country: "Global", countryFlag: "🌍" },
  { ats: "lever",      name: "Miro",           slug: "miro",             country: "Global", countryFlag: "🌍" },
  { ats: "lever",      name: "Lokalise",       slug: "lokalise",         country: "Global", countryFlag: "🌍" },
  { ats: "lever",      name: "Tuple",          slug: "tuple",            country: "Global", countryFlag: "🌍" },

  // ── Ashby ──────────────────────────────────────────────────────────────────
  { ats: "ashby",      name: "Remote.com",     slug: "remote",           country: "Global", countryFlag: "🌍" },
  { ats: "ashby",      name: "Loom",           slug: "loom",             country: "Global", countryFlag: "🌍" },
  { ats: "ashby",      name: "Linear",         slug: "linear",           country: "Global", countryFlag: "🌍" },
  { ats: "ashby",      name: "Vercel",         slug: "vercel",           country: "Global", countryFlag: "🌍" },
  { ats: "ashby",      name: "Retool",         slug: "retool",           country: "Global", countryFlag: "🌍" },
  { ats: "ashby",      name: "Cal.com",        slug: "calcom",           country: "Global", countryFlag: "🌍" },
  { ats: "ashby",      name: "Resend",         slug: "resend",           country: "Global", countryFlag: "🌍" },
  { ats: "ashby",      name: "Zed",            slug: "zed",              country: "Global", countryFlag: "🌍" },
  { ats: "ashby",      name: "Plain",          slug: "plain",            country: "Global", countryFlag: "🌍" },
  { ats: "ashby",      name: "Rows",           slug: "rows",             country: "Global", countryFlag: "🌍" },
  { ats: "ashby",      name: "Raycast",        slug: "raycast",          country: "Global", countryFlag: "🌍" },
  { ats: "ashby",      name: "Attio",          slug: "attio",            country: "Global", countryFlag: "🌍" },
  { ats: "ashby",      name: "Infisical",      slug: "infisical",        country: "Global", countryFlag: "🌍" },
  { ats: "ashby",      name: "Supabase",       slug: "supabase",         country: "Global", countryFlag: "🌍" },
  { ats: "ashby",      name: "Neon",           slug: "neon",             country: "Global", countryFlag: "🌍" },
  { ats: "ashby",      name: "Turso",          slug: "turso",            country: "Global", countryFlag: "🌍" },
  { ats: "ashby",      name: "Stytch",         slug: "stytch",           country: "Global", countryFlag: "🌍" },
  { ats: "ashby",      name: "Posthog",        slug: "posthog",          country: "Global", countryFlag: "🌍" },

  // ── Workable ───────────────────────────────────────────────────────────────
  { ats: "workable",   name: "Typeform",       slug: "typeform",         country: "Global", countryFlag: "🌍" },
  { ats: "workable",   name: "Toggl",          slug: "toggl",            country: "Global", countryFlag: "🌍" },
  { ats: "workable",   name: "Learnworlds",    slug: "learnworlds",      country: "Global", countryFlag: "🌍" },
  { ats: "workable",   name: "Printify",       slug: "printify",         country: "Global", countryFlag: "🌍" },
  { ats: "workable",   name: "Appsflyer",      slug: "appsflyer",        country: "Global", countryFlag: "🌍" },
  { ats: "workable",   name: "Kaizen Gaming",  slug: "kaizengaming",     country: "Global", countryFlag: "🌍" },

  // ── Teamtailor ─────────────────────────────────────────────────────────────
  { ats: "teamtailor", name: "Epidemic Sound", slug: "epidemicsound",    country: "Global", countryFlag: "🌍" },
  { ats: "teamtailor", name: "BMAT",           slug: "bmat",             country: "Global", countryFlag: "🌍" },

  // ── Breezy ─────────────────────────────────────────────────────────────────


];

export async function fetchGlobalJobs(): Promise<Job[]> {
  const results = await Promise.allSettled(
    COMPANIES.map(c => {
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
  console.log(`[global] Total: ${all.length} jobs`);
  return all;
}
