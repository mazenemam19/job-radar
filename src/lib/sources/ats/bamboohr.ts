// src/lib/sources/ats/bamboohr.ts
// Split out of ats-utils.ts (see AUDIT_STATUS.md row #2) — no behavior change.
import type { ATSConfig, ATSRawInput, FetcherResult, BambooJob, BambooDetail } from "@/types";
import type { JobMode } from "@/lib/types";
import { safeFetch } from "./http";
import { processJobs, stripHtml, pLimit } from "./job-processing";

export async function fetchBambooHR(c: ATSConfig, mode: JobMode): Promise<FetcherResult> {
  const t0 = Date.now();
  const url = `https://${c.slug}.bamboohr.com/careers/list`;
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
    const data = (await res.json()) as { result?: BambooJob[] };
    const jobs = data.result ?? [];
    const rawCount = jobs.length;
    // BambooHR's list endpoint never includes a description.
    // Fetch each job's detail page for the real description,
    // mirroring fetchWorkable's detail-fetch pattern.
    const withDesc = await pLimit(
      jobs.map((r) => async () => {
        let description = "";
        const detailUrl = `https://${c.slug}.bamboohr.com/careers/${r.id}/detail`;
        const dr = await safeFetch(detailUrl);
        if (dr && dr.ok) {
          try {
            const detail = (await dr.json()) as BambooDetail;
            description = stripHtml(detail.result?.jobOpening?.description ?? "");
          } catch {}
        }
        return {
          id: `${mode}_bamboohr_${c.slug}_${r.id}`,
          title: r.jobOpeningName,
          location: r.city ? `${r.city}, ${r.country}` : (c.city ?? c.country),
          url: `https://${c.slug}.bamboohr.com/careers/${r.id}`,
          postedAt: r.datePosted,
          description,
        };
      }),
      5,
    );
    const processed = processJobs(withDesc.filter(Boolean) as ATSRawInput[], c, mode);
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
