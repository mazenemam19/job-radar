// src/lib/sources/remote-companies.ts
// "Global Remote" pipeline — worldwide remote companies that accept Egypt/GMT+2 applicants.
// Filter: rejects US-timezone-only, must-be-authorized-in-country, EU-resident-only.

import type { Job, SourceHealth, ATSConfig, FetcherResult } from "../types";
import {
  fetchGreenhouse,
  fetchLever,
  fetchAshby,
  fetchWorkable,
  fetchTeamtailor,
  fetchBreezy,
  fetchSmartRecruiters,
  fetchRemoteOK,
  resetWorkableUsed,
} from "./ats-utils";
import { fetchHimalayas } from "./himalayas";
import { fetchRemotive } from "./remotive";
import { fetchWPStartupJobs } from "./wp-startup-jobs";
import { getNextBatch } from "../state";

const MODE = "global";
const VISA = false;

const COMPANIES: ATSConfig[] = [
  // ── Stable Core (Verified Greenhouse) ───────────────────────────────────
  { ats: "greenhouse", name: "Webflow", slug: "webflow", country: "Global", countryFlag: "🌍" },
  { ats: "greenhouse", name: "Mercury", slug: "mercury", country: "Global", countryFlag: "🌍" },
  { ats: "greenhouse", name: "Vercel", slug: "vercel", country: "Global", countryFlag: "🌍" },
  { ats: "greenhouse", name: "Airbnb", slug: "airbnb", country: "Global", countryFlag: "🌍" },
  { ats: "greenhouse", name: "Discord", slug: "discord", country: "Global", countryFlag: "🌍" },
  { ats: "greenhouse", name: "Coinbase", slug: "coinbase", country: "Global", countryFlag: "🌍" },
  { ats: "greenhouse", name: "Figma", slug: "figma", country: "Global", countryFlag: "🌍" },
  { ats: "greenhouse", name: "Grafana", slug: "grafanalabs", country: "Global", countryFlag: "🌍" },
  { ats: "greenhouse", name: "Netlify", slug: "netlify", country: "Global", countryFlag: "🌍" },
  { ats: "greenhouse", name: "Lyft", slug: "lyft", country: "Global", countryFlag: "🌍" },
  { ats: "greenhouse", name: "Reddit", slug: "reddit", country: "Global", countryFlag: "🌍" },
  { ats: "greenhouse", name: "Pinterest", slug: "pinterest", country: "Global", countryFlag: "🌍" },
  {
    ats: "greenhouse",
    name: "Databricks",
    slug: "databricks",
    country: "Global",
    countryFlag: "🌍",
  },
  { ats: "greenhouse", name: "Twilio", slug: "twilio", country: "Global", countryFlag: "🌍" },
  { ats: "greenhouse", name: "Okta", slug: "okta", country: "Global", countryFlag: "🌍" },

  // ── Stable Core (Verified Ashby) ────────────────────────────────────────
  { ats: "ashby", name: "Posthog", slug: "posthog", country: "Global", countryFlag: "🌍" },
  { ats: "ashby", name: "Infisical", slug: "infisical", country: "Global", countryFlag: "🌍" },
  { ats: "ashby", name: "Resend", slug: "resend", country: "Global", countryFlag: "🌍" },
  { ats: "ashby", name: "Stytch", slug: "stytch", country: "Global", countryFlag: "🌍" },
  { ats: "ashby", name: "Raycast", slug: "raycast", country: "Global", countryFlag: "🌍" },
  { ats: "ashby", name: "Supabase", slug: "supabase", country: "Global", countryFlag: "🌍" },
  { ats: "ashby", name: "Neon", slug: "neon", country: "Global", countryFlag: "🌍" },
  { ats: "ashby", name: "Plain", slug: "plain", country: "Global", countryFlag: "🌍" },
  { ats: "ashby", name: "Linear", slug: "linear", country: "Global", countryFlag: "🌍" },
  { ats: "ashby", name: "Airbyte", slug: "airbyte", country: "Global", countryFlag: "🌍" },

  // ── Stable Core (Verified Workable) ──────────────────────────────────────
  {
    ats: "workable",
    name: "Learnworlds",
    slug: "learnworlds",
    country: "Global",
    countryFlag: "🌍",
  },
  { ats: "workable", name: "Clerk", slug: "clerk", country: "Global", countryFlag: "🌍" },
];

export async function fetchRemoteJobs(): Promise<{
  jobs: Job[];
  health: Record<string, SourceHealth>;
}> {
  resetWorkableUsed(MODE);

  const workables = COMPANIES.filter((c) => c.ats === "workable");
  const others = COMPANIES.filter((c) => c.ats !== "workable");

  const batchWorkable = await getNextBatch(workables, 12, "global-workable");
  const toScan = [...others, ...batchWorkable];

  const skippedWorkables = workables.filter((c) => !batchWorkable.some((b) => b.name === c.name));

  // ── Parallelize everything ─────────────────────────────────────────
  const allFetchers = [
    ...toScan.map((c) => {
      const p = (() => {
        switch (c.ats) {
          case "greenhouse":
            return fetchGreenhouse(c, MODE, VISA);
          case "lever":
            return fetchLever(c, MODE, VISA);
          case "ashby":
            return fetchAshby(c, MODE, VISA);
          case "workable":
            return fetchWorkable(c, MODE, VISA);
          case "teamtailor":
            return fetchTeamtailor(c, MODE, VISA);
          case "breezy":
            return fetchBreezy(c, MODE, VISA);
          case "smartrecruiters":
            return fetchSmartRecruiters(c, MODE, VISA);
          default:
            return Promise.resolve({ jobs: [] } as FetcherResult);
        }
      })();
      return p.then((res) => ({ ...res, sourceName: c.name, ats: c.ats }));
    }),
    fetchRemoteOK(MODE).then((res) => ({ ...res, sourceName: "RemoteOK", ats: "custom" })),
    fetchHimalayas(MODE).then((res) => ({ ...res, sourceName: "Himalayas", ats: "custom" })),
    fetchRemotive(MODE).then((res) => ({ ...res, sourceName: "Remotive", ats: "custom" })),
    fetchWPStartupJobs("https://berlinstartupjobs.com", "Berlin", "Germany", "🇩🇪", MODE).then(
      (res) => ({ ...res, sourceName: "Berlin Startup Jobs (Global)", ats: "custom" }),
    ),
  ];

  const results = await Promise.allSettled(allFetchers);

  const all: Job[] = [];
  const health: Record<string, SourceHealth> = {};
  const seen = new Set<string>();

  for (const skipped of skippedWorkables) {
    health[skipped.name] = {
      count: 0,
      ats: skipped.ats,
      status: "skipped",
    };
  }

  for (const r of results) {
    if (r.status === "fulfilled") {
      const { jobs, error, durationMs, sourceName, rawCount, ats } = r.value as FetcherResult & {
        sourceName: string;
        ats: string;
      };
      health[sourceName] = { count: jobs.length, rawCount, error, durationMs, ats };
      for (const j of jobs) {
        if (!seen.has(j.id)) {
          seen.add(j.id);
          all.push(j);
        }
      }
    } else {
      console.error("[global] Unhandled rejection:", r.reason);
    }
  }

  console.log(`[global] Total: ${all.length} jobs`);
  return { jobs: all, health };
}
