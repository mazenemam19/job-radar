// src/lib/sources/ats/jazzhr.ts
// Split out of ats-utils.ts (see AUDIT_STATUS.md row #2) — no behavior change.
import type { ATSConfig, FetcherResult, JazzJob } from "@/types";
import type { JobMode } from "@/lib/types";
import { safeFetch } from "./http";
import { processJobs, stripHtml } from "./job-processing";

export async function fetchJazzHR(c: ATSConfig, mode: JobMode): Promise<FetcherResult> {
  const t0 = Date.now();
  const url = `https://api.resumator.com/v1/jobs/board/public/account/${c.slug}`;
  const res = await safeFetch(url, 60_000); // Increased timeout to 60s

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
    const jobs = (await res.json()) as JazzJob[];
    const rawCount = jobs.length;
    const processed = processJobs(
      jobs.map((r) => ({
        id: `${mode}_jazz_${c.slug}_${r.id}`,
        title: r.title,
        location: r.location || c.city || c.country,
        url: r.apply_url,
        postedAt: new Date(r.posted).toISOString(),
        description: stripHtml(r.description || ""),
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
