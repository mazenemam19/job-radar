// src/lib/sources/ats/lever.ts
// Split out of ats-utils.ts (see AUDIT_STATUS.md row #2) — no behavior change.
import type { ATSConfig, FetcherResult, LeverJob } from "@/types";
import type { JobMode } from "@/lib/types";
import { safeFetch } from "./http";
import { processJobs, stripHtml } from "./job-processing";

export async function fetchLever(c: ATSConfig, mode: JobMode): Promise<FetcherResult> {
  const t0 = Date.now();
  const url = `https://api.lever.co/v0/postings/${c.slug}?mode=json`;
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
    const jobs = (await res.json()) as LeverJob[];
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
