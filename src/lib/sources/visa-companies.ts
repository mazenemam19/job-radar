// src/lib/sources/visa-companies.ts
import type { Job, SourceHealth, FetcherResult } from "@/types";
import {
  fetchGreenhouse,
  fetchLever,
  fetchAshby,
  fetchWorkable,
  fetchTeamtailor,
  fetchBreezy,
  fetchSmartRecruiters,
  resetWorkableUsed,
  pLimit,
} from "./ats-utils";
import { fetchGoogleJobs } from "./google-search";
import { fetchWPStartupJobs } from "./wp-startup-jobs";
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
      fetchWPStartupJobs(
        "https://londonstartupjobs.co.uk",
        "London",
        "UK",
        "🇬🇧",
        MODE,
        "London Startup Jobs",
      ).then((res) => ({ ...res, sourceName: "London Startup Jobs", ats: "custom" })),
    async () =>
      fetchGoogleJobs(MODE, "Senior React", "Germany OR Netherlands OR UK OR Ireland").then(
        (res) => {
          const sourceName = "LinkedIn (Visa Hubs)";
          return {
            ...res,
            sourceName,
            ats: "custom",
            jobs: res.jobs.map((j) => ({ ...j, sourceName })),
          };
        },
      ),
  ];

  // Limit to 3 concurrent fetchers to ensure network stability
  const results = await pLimit(fetcherFns, 3);

  const all: Job[] = [];
  const health: Record<string, SourceHealth> = {};

  for (const r of results) {
    if (r) {
      const { jobs, error, durationMs, sourceName, rawCount, ats, success, total, ok } =
        r as FetcherResult & {
          sourceName: string;
          ats: string;
        };
      all.push(...jobs);
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
    }
  }

  console.log(`[visa] Total: ${all.length} jobs`);
  return { jobs: all, health };
}
