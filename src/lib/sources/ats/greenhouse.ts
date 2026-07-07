// src/lib/sources/ats/greenhouse.ts
// Split out of ats-utils.ts (see AUDIT_STATUS.md row #2) — no behavior change.
import type { ATSConfig, FetcherResult, GreenhouseJob } from "@/types";
import type { JobMode } from "@/lib/types";
import { safeFetchJson } from "./http";
import { processJobs, stripHtml } from "./job-processing";

export async function fetchGreenhouse(c: ATSConfig, mode: JobMode): Promise<FetcherResult> {
  const t0 = Date.now();
  const url = `https://boards-api.greenhouse.io/v1/boards/${c.slug}/jobs?content=true`;
  const result = await safeFetchJson<{ jobs: GreenhouseJob[] }>(url);

  if (!result.ok)
    return {
      jobs: [],
      rawCount: 0,
      error: result.error,
      durationMs: Date.now() - t0,
      ok: false,
    };

  // NOTE: no fallback/shape guard on `jobs` here, unlike teamtailor.ts — that
  // guard was added because Yodo1 proved the failure live. No Greenhouse
  // board has shown this shape in practice; adding a speculative guard here
  // would be unfalsifiable. Flagged, not bundled in, same as this repo's own
  // convention (see issue-52-429-404-followup-part3.md).
  const { jobs } = result.data;
  const rawCount = jobs.length;
  const processed = processJobs(
    jobs.map((r) => {
      const officeNames = (r.offices || [])
        .map((o) => o.name)
        .filter((n) => n && n !== "Remote")
        .join(", ");
      const location = officeNames || r.location?.name || c.city || c.country;

      return {
        id: `${mode}_gh_${c.slug}_${r.id}`,
        title: r.title,
        location,
        url: r.absolute_url,
        postedAt: r.updated_at,
        description: stripHtml(r.content || ""),
      };
    }),
    c,
    mode,
  );
  return { jobs: processed, rawCount, durationMs: Date.now() - t0, ok: true };
}
