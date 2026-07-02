// src/lib/sources/ats/teamtailor.ts
// Split out of ats-utils.ts (see AUDIT_STATUS.md row #2) — no behavior change.
import type { ATSConfig, FetcherResult, TeamtailorJob } from "@/types";
import type { JobMode } from "@/lib/types";
import { safeFetch } from "./http";
import { processJobs, stripHtml } from "./job-processing";

export async function fetchTeamtailor(c: ATSConfig, mode: JobMode): Promise<FetcherResult> {
  const t0 = Date.now();
  const publicUrl = `https://${c.slug}.teamtailor.com/jobs.json`;
  const res = await safeFetch(publicUrl, 30_000, { Accept: "application/json" });

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
    const { data } = (await res.json()) as { data: TeamtailorJob[] };
    const rawCount = data.length;
    const processed = processJobs(
      data.map((r) => ({
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
