// src/lib/sources/ats/breezy.ts
// Split out of ats-utils.ts (see AUDIT_STATUS.md row #2) — no behavior change.
import type { ATSConfig, FetcherResult, BreezyJob } from "@/types";
import type { JobMode } from "@/lib/types";
import { safeFetchJson } from "./http";
import { processJobs, stripHtml } from "./job-processing";

export async function fetchBreezy(c: ATSConfig, mode: JobMode): Promise<FetcherResult> {
  const t0 = Date.now();
  const url = `https://${c.slug}.breezy.hr/json`;
  const result = await safeFetchJson<BreezyJob[]>(url, 30_000, { Accept: "application/json" });

  if (!result.ok)
    return {
      jobs: [],
      rawCount: 0,
      error: result.error,
      durationMs: Date.now() - t0,
      ok: false,
    };

  const jobs = result.data;
  const rawCount = jobs.length;
  const processed = processJobs(
    jobs.map((r) => ({
      id: `${mode}_breezy_${c.slug}_${r.id}`,
      title: r.name,
      location: r.location?.name ?? c.city ?? c.country,
      url: r.url,
      postedAt: r.updated_at,
      description: stripHtml(r.description || ""),
    })),
    c,
    mode,
  );
  return { jobs: processed, rawCount, durationMs: Date.now() - t0, ok: true };
}
