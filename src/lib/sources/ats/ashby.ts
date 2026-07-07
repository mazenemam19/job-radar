// src/lib/sources/ats/ashby.ts
// Split out of ats-utils.ts (see AUDIT_STATUS.md row #2) — no behavior change.
import type { ATSConfig, FetcherResult, AshbyJob } from "@/types";
import type { JobMode } from "@/lib/types";
import { safeFetchJson } from "./http";
import { processJobs, stripHtml } from "./job-processing";

export async function fetchAshby(c: ATSConfig, mode: JobMode): Promise<FetcherResult> {
  const t0 = Date.now();
  const url = `https://api.ashbyhq.com/posting-api/job-board/${c.slug}`;
  const result = await safeFetchJson<{ jobs?: AshbyJob[]; jobPostings?: AshbyJob[] }>(url);

  if (!result.ok)
    return {
      jobs: [],
      rawCount: 0,
      error: result.error,
      durationMs: Date.now() - t0,
      ok: false,
    };

  const jobs = result.data.jobs || result.data.jobPostings || [];
  const rawCount = jobs.length;
  const processed = processJobs(
    jobs.map((r) => ({
      id: `${mode}_ashby_${c.slug}_${r.id}`,
      title: r.title,
      location: r.locationName ?? c.city ?? c.country,
      url: r.jobUrl,
      postedAt: r.publishedAt,
      description: stripHtml(r.descriptionHtml || ""),
    })),
    c,
    mode,
  );
  return { jobs: processed, rawCount, durationMs: Date.now() - t0, ok: true };
}
