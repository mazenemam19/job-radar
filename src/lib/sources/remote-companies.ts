// src/lib/sources/remote-companies.ts
// "Global Remote" pipeline — worldwide remote companies that accept Egypt/GMT+2 applicants.
// Filter: rejects US-timezone-only, must-be-authorized-in-country, EU-resident-only.

import type { Job, SourceHealth, FetcherResult } from "@/types";
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
  pLimit,
} from "./ats-utils";
import { fetchHimalayas } from "./himalayas";
import { fetchRemotive } from "./remotive";
import { fetchWPStartupJobs } from "./wp-startup-jobs";
import { ALL_COMPANIES } from "./companies";

const MODE = "global";
const VISA = false;

export async function fetchRemoteJobs(): Promise<{
  jobs: Job[];
  health: Record<string, SourceHealth>;
}> {
  resetWorkableUsed(MODE);

  // Filter master list for global companies
  const companies = ALL_COMPANIES.filter((c) => c.pipelines.includes(MODE));

  const workables = companies.filter((c) => c.ats === "workable");
  const others = companies.filter((c) => c.ats !== "workable");

  // Scan ALL companies (no more batching/rotation)
  const toScan = [...others, ...workables];

  // ── Limit concurrency to 3 to prevent AbortErrors/Timeouts ──────────────────
  const fetcherFns = [
    ...toScan.map((c) => async () => {
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
    async () =>
      fetchRemoteOK(MODE).then((res) => ({ ...res, sourceName: "RemoteOK", ats: "custom" })),
    async () =>
      fetchHimalayas(MODE).then((res) => ({ ...res, sourceName: "Himalayas", ats: "custom" })),
    async () =>
      fetchRemotive(MODE).then((res) => ({ ...res, sourceName: "Remotive", ats: "custom" })),
    async () =>
      fetchWPStartupJobs(
        "https://berlinstartupjobs.com",
        "Berlin",
        "Germany",
        "🇩🇪",
        MODE,
        "Berlin Startup Jobs (Global)",
      ).then((res) => ({ ...res, sourceName: "Berlin Startup Jobs (Global)", ats: "custom" })),
  ];

  // Limit to 3 concurrent fetchers to ensure network stability
  const results = await pLimit(fetcherFns, 3);

  const all: Job[] = [];
  const health: Record<string, SourceHealth> = {};
  const seen = new Set<string>();

  for (const r of results) {
    if (r) {
      const { jobs, error, durationMs, sourceName, rawCount, ats, success, total, ok } =
        r as FetcherResult & {
          sourceName: string;
          ats: string;
        };
      health[sourceName] = {
        count: jobs.length,
        rawCount,
        error,
        durationMs,
        ats,
        success,
        total,
        ok,
      };
      for (const j of jobs) {
        if (!seen.has(j.id)) {
          seen.add(j.id);
          all.push(j);
        }
      }
    }
  }

  console.log(`[global] Total: ${all.length} jobs`);
  return { jobs: all, health };
}
