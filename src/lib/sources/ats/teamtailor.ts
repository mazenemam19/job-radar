// src/lib/sources/ats/teamtailor.ts
// Split out of ats-utils.ts (see AUDIT_STATUS.md row #2) — no behavior change.
import type { ATSConfig, FetcherResult, TeamtailorJob } from "@/types";
import type { JobMode } from "@/lib/types";
import { safeFetchJson } from "./http";
import { processJobs, stripHtml } from "./job-processing";

export async function fetchTeamtailor(c: ATSConfig, mode: JobMode): Promise<FetcherResult> {
  const t0 = Date.now();
  const publicUrl = `https://${c.slug}.teamtailor.com/jobs.json`;
  const result = await safeFetchJson<{ data?: TeamtailorJob[] }>(publicUrl, 30_000, {
    Accept: "application/json",
  });

  if (!result.ok)
    return {
      jobs: [],
      rawCount: 0,
      error: result.error,
      durationMs: Date.now() - t0,
      ok: false,
    };

  // safeFetchJson only confirms the body parsed as JSON — it doesn't confirm
  // this shape. Yodo1's board (issue-52-429-404-followup-part3.md) returned
  // valid JSON with no `data` array, which crashed the old `data.length` on
  // `undefined` — the live bug that put teamtailor first in this rollout.
  // Guard the shape explicitly instead of trusting it.
  const jobs = result.data.data;
  if (!Array.isArray(jobs))
    return {
      jobs: [],
      rawCount: 0,
      error: "Unexpected response shape: missing `data` array",
      durationMs: Date.now() - t0,
      ok: false,
    };

  const rawCount = jobs.length;
  const processed = processJobs(
    jobs.map((r) => ({
      id: `${mode}_tt_${c.slug}_${r.id}`,
      title: r.attributes.title,
      location: r.attributes["location-name"] ?? c.city ?? c.country,
      url: r.attributes["external-url"] || `https://${c.slug}.teamtailor.com/jobs/${r.id}`,
      postedAt: r.attributes["published-at"],
      description: stripHtml(r.attributes["body-html"] || ""),
    })),
    c,
    mode,
  );
  return { jobs: processed, rawCount, durationMs: Date.now() - t0, ok: true };
}
