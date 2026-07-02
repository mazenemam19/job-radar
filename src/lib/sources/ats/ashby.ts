// src/lib/sources/ats/ashby.ts
// Split out of ats-utils.ts (see AUDIT_STATUS.md row #2) — no behavior change.
import type { ATSConfig, FetcherResult, AshbyJob } from "@/types";
import type { JobMode } from "@/lib/types";
import { safeFetch } from "./http";
import { processJobs, stripHtml } from "./job-processing";

export async function fetchAshby(c: ATSConfig, mode: JobMode): Promise<FetcherResult> {
  const t0 = Date.now();
  const url = `https://api.ashbyhq.com/posting-api/job-board/${c.slug}`;
  const res = await safeFetch(url);

  if (!res)
    return {
      jobs: [],
      rawCount: 0,
      error: "Network/Timeout",
      durationMs: Date.now() - t0,
      ok: false,
    };
  if (!res.ok)
    return {
      jobs: [],
      rawCount: 0,
      error: `HTTP ${res.status}`,
      durationMs: Date.now() - t0,
      ok: false,
    };
  try {
    const data = (await res.json()) as { jobs?: AshbyJob[]; jobPostings?: AshbyJob[] };
    const jobs = data.jobs || data.jobPostings || [];
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
  } catch (e) {
    return {
      jobs: [],
      rawCount: 0,
      error: `Parse Error: ${e}`,
      durationMs: Date.now() - t0,
      ok: false,
    };
  }
}
