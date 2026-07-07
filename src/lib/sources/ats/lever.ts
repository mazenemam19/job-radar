// src/lib/sources/ats/lever.ts
// Split out of ats-utils.ts (see AUDIT_STATUS.md row #2) — no behavior change.
import type { ATSConfig, FetcherResult, LeverJob } from "@/types";
import type { JobMode } from "@/lib/types";
import { safeFetchJson } from "./http";
import { processJobs, stripHtml } from "./job-processing";

export async function fetchLever(c: ATSConfig, mode: JobMode): Promise<FetcherResult> {
  const t0 = Date.now();
  const url = `https://api.lever.co/v0/postings/${c.slug}?mode=json`;
  const result = await safeFetchJson<LeverJob[]>(url);

  if (!result.ok)
    return {
      jobs: [],
      rawCount: 0,
      error: result.error,
      durationMs: Date.now() - t0,
      ok: false,
    };

  // NOTE: no shape guard on the body being an array — same latent risk class
  // as teamtailor.ts's fix, no live evidence for Lever specifically. Flagged,
  // not bundled in, per this repo's convention (issue-52-429-404-followup-part3.md).
  const jobs = result.data;
  const rawCount = jobs.length;
  const processed = processJobs(
    jobs.map((r) => ({
      id: `${mode}_lever_${c.slug}_${r.id}`,
      title: r.text,
      location: r.categories?.location ?? c.city ?? c.country,
      url: r.hostedUrl,
      postedAt: new Date(r.createdAt).toISOString(),
      description: stripHtml(r.description || ""),
    })),
    c,
    mode,
  );
  return { jobs: processed, rawCount, durationMs: Date.now() - t0, ok: true };
}
