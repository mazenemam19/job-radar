// src/lib/sources/local-companies.ts
import type { Job, SourceHealth, FetcherResult } from "../types";
import {
  fetchGreenhouse,
  fetchLever,
  fetchAshby,
  fetchWorkable,
  fetchTeamtailor,
  fetchBreezy,
  fetchSmartRecruiters,
  fetchBambooHR,
  fetchJazzHR,
  fetchBrightSkies,
  fetchWuzzuf,
  resetWorkableUsed,
} from "./ats-utils";
import { ALL_COMPANIES } from "./companies";

const MODE = "local";
const VISA = false;

export async function fetchLocalJobs(): Promise<{
  jobs: Job[];
  health: Record<string, SourceHealth>;
}> {
  resetWorkableUsed(MODE);

  // Filter master list for local companies
  const companies = ALL_COMPANIES.filter((c) => c.pipelines.includes(MODE));

  const workables = companies.filter((c) => c.ats === "workable");
  const others = companies.filter((c) => c.ats !== "workable");

  // Scan ALL companies (no more batching/rotation)
  const toScan = [...others, ...workables];

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
          case "bamboohr":
            return fetchBambooHR(c, MODE, VISA);
          case "jazzhr":
            return fetchJazzHR(c, MODE, VISA);
          default:
            return Promise.resolve({ jobs: [] } as FetcherResult);
        }
      })();
      return p.then((res) => ({ ...res, sourceName: c.name, ats: c.ats }));
    }),
    fetchWuzzuf(MODE).then((res) => ({ ...res, sourceName: "Wuzzuf", ats: "custom" })),
    fetchBrightSkies(MODE).then((res) => ({ ...res, sourceName: "Bright Skies", ats: "custom" })),
  ];

  const results = await Promise.allSettled(allFetchers);

  const all: Job[] = [];
  const health: Record<string, SourceHealth> = {};
  const seen = new Set<string>();

  for (const r of results) {
    if (r.status === "fulfilled") {
      const { jobs, error, durationMs, sourceName, rawCount, ats, success, total } =
        r.value as FetcherResult & {
          sourceName: string;
          ats: string;
          success?: number;
          total?: number;
        };
      health[sourceName] = { count: jobs.length, rawCount, error, durationMs, ats, success, total };
      for (const j of jobs) {
        if (!seen.has(j.id)) {
          seen.add(j.id);
          all.push(j);
        }
      }
    } else {
      console.error("[local] Unhandled rejection:", r.reason);
    }
  }

  console.log(`[local] Total: ${all.length} jobs`);
  return { jobs: all, health };
}
