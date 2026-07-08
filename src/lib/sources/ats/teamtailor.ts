// src/lib/sources/ats/teamtailor.ts
// Split out of ats-utils.ts (see AUDIT_STATUS.md row #2) — no behavior change.
import type { ATSConfig, FetcherResult, Job, TeamtailorFeedItem, TeamtailorJob } from "@/types";
import type { JobMode } from "@/lib/types";
import { safeFetchJson } from "./http";
import { processJobs, stripHtml } from "./job-processing";

/** `_jobposting.jobLocation` on a JSON Feed item is either a plain string
 * or a schema.org PostalAddress-shaped object — pull a display string out
 * of either, falling back to the company's configured city/country same as
 * the legacy `data[]` shape does for a missing `location-name`. */
function feedLocation(item: TeamtailorFeedItem, c: ATSConfig): string {
  const loc = item._jobposting?.jobLocation;
  if (typeof loc === "string") return loc;
  const locality = loc?.address?.addressLocality;
  const country = loc?.address?.addressCountry;
  return [locality, country].filter(Boolean).join(", ") || c.city || c.country;
}

function okResult(jobs: Job[], rawCount: number, t0: number): FetcherResult {
  return { jobs, rawCount, durationMs: Date.now() - t0, ok: true };
}

export async function fetchTeamtailor(c: ATSConfig, mode: JobMode): Promise<FetcherResult> {
  const t0 = Date.now();
  const publicUrl = `https://${c.slug}.teamtailor.com/jobs.json`;
  const result = await safeFetchJson<{ data?: TeamtailorJob[]; items?: TeamtailorFeedItem[] }>(
    publicUrl,
    30_000,
    { Accept: "application/json" },
  );

  if (!result.ok)
    return {
      jobs: [],
      rawCount: 0,
      error: result.error,
      durationMs: Date.now() - t0,
      ok: false,
    };

  // safeFetchJson only confirms the body parsed as JSON — it doesn't confirm
  // the shape. Teamtailor's public jobs.json serves one of two shapes
  // depending on the company: the legacy JSON:API-style `data[]` (below), or
  // JSON Feed's `items[]` (jsonfeed.org — confirmed live: Full Fabric).
  // Yodo1's board (issue-52-429-404-followup-part3.md) returned valid JSON
  // with neither array, which crashed the old `data.length` on `undefined` —
  // guard both shapes explicitly instead of trusting either.
  if (Array.isArray(result.data.data)) {
    const jobs = result.data.data;
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
    return okResult(processed, jobs.length, t0);
  }

  if (Array.isArray(result.data.items)) {
    const jobs = result.data.items;
    const processed = processJobs(
      jobs.map((r) => ({
        id: `${mode}_tt_${c.slug}_${r.id}`,
        title: r.title ?? "Untitled",
        location: feedLocation(r, c),
        url: r.url || `https://${c.slug}.teamtailor.com/jobs/${r.id}`,
        postedAt: r.date_published ?? "",
        description: stripHtml(r.content_html || ""),
      })),
      c,
      mode,
    );
    return okResult(processed, jobs.length, t0);
  }

  return {
    jobs: [],
    rawCount: 0,
    error: "Unexpected response shape: missing `data` or `items` array",
    durationMs: Date.now() - t0,
    ok: false,
  };
}
