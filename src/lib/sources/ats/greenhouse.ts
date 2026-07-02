// src/lib/sources/ats/greenhouse.ts
// Split out of ats-utils.ts (see AUDIT_STATUS.md row #2) — no behavior change.
import type { ATSConfig, FetcherResult, GreenhouseJob } from "@/types";
import type { JobMode } from "@/lib/types";
import { safeFetch } from "./http";
import { processJobs, stripHtml } from "./job-processing";

export async function fetchGreenhouse(c: ATSConfig, mode: JobMode): Promise<FetcherResult> {
  const t0 = Date.now();
  const url = `https://boards-api.greenhouse.io/v1/boards/${c.slug}/jobs?content=true`;
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
    const { jobs } = (await res.json()) as { jobs: GreenhouseJob[] };
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
