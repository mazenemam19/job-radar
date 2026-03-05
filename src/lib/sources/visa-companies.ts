// src/lib/sources/visa-companies.ts
import type { Job, SourceHealth, FetcherResult } from "../types";
import {
  fetchGreenhouse,
  fetchLever,
  fetchAshby,
  fetchWorkable,
  fetchTeamtailor,
  fetchBreezy,
  fetchSmartRecruiters,
  resetWorkableUsed,
} from "./ats-utils";
import { fetchWPStartupJobs } from "./wp-startup-jobs";
import { getNextBatch } from "../state";
import { ALL_COMPANIES } from "./companies";

const MODE = "visa";
const VISA = true;

export async function fetchVisaJobs(): Promise<{
  jobs: Job[];
  health: Record<string, SourceHealth>;
}> {
  resetWorkableUsed(MODE);

  // Filter master list for visa companies
  const companies = ALL_COMPANIES.filter((c) => c.pipelines.includes(MODE));

  const workables = companies.filter((c) => c.ats === "workable");
  const others = companies.filter((c) => c.ats !== "workable");

  const batchWorkable = await getNextBatch(workables, 12, "visa-workable");
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
    fetchWPStartupJobs("https://londonstartupjobs.co.uk", "London", "UK", "🇬🇧", MODE).then(
      (res) => ({ ...res, sourceName: "London Startup Jobs", ats: "custom" }),
    ),
  ];

  const results = await Promise.allSettled(allFetchers);

  const all: Job[] = [];
  const health: Record<string, SourceHealth> = {};

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
      all.push(...jobs);
      health[sourceName] = { count: jobs.length, rawCount, error, durationMs, ats };
    } else {
      console.error("[visa] Unhandled rejection:", r.reason);
    }
  }

  console.log(`[visa] Total: ${all.length} jobs`);
  return { jobs: all, health };
}
