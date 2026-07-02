// src/lib/dashboard-client.ts
// Pure logic backing DashboardClient — no React, no fetch. Data-fetching and
// state ownership live in hooks/useDashboardFeed.ts; this file is just the
// transforms so they can be unit tested without mounting a component.

import type { ScoredJob, FilterMode } from "@/lib/types";

export function computeModeCounts(jobs: ScoredJob[]): Record<string, number> {
  return jobs.reduce(
    (acc, j) => ({ ...acc, [j.mode]: (acc[j.mode] ?? 0) + 1 }),
    {} as Record<string, number>,
  );
}

export function filterJobsByMode(jobs: ScoredJob[], mode: FilterMode): ScoredJob[] {
  return mode === "all" ? jobs : jobs.filter((j) => j.mode === mode);
}
