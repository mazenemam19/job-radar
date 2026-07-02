// src/lib/sources/ats/breezy.ts
// Split out of ats-utils.ts (see AUDIT_STATUS.md row #2) — no behavior change.
import type { ATSConfig, FetcherResult, BreezyJob } from "@/types";
import type { JobMode } from "@/lib/types";
import { safeFetch } from "./http";
import { processJobs, stripHtml } from "./job-processing";

export async function fetchBreezy(c: ATSConfig, mode: JobMode): Promise<FetcherResult> {
  const t0 = Date.now();
  const url = `https://${c.slug}.breezy.hr/json`;
  const res = await safeFetch(url, 30_000, { Accept: "application/json" });

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
    const jobs = (await res.json()) as BreezyJob[];
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
