// src/lib/sources/ats/smart-recruiters.ts
// Split out of ats-utils.ts (see AUDIT_STATUS.md row #2) — no behavior change.
import type { ATSConfig, ATSRawInput, FetcherResult, SRJob, SRDetail } from "@/types";
import type { JobMode } from "@/lib/types";
import { safeFetch } from "./http";
import { processJobs, stripHtml, pLimit } from "./job-processing";

export async function fetchSmartRecruiters(c: ATSConfig, mode: JobMode): Promise<FetcherResult> {
  const t0 = Date.now();
  const url = `https://api.smartrecruiters.com/v1/companies/${c.slug}/postings`;
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
    const { content } = (await res.json()) as { content: SRJob[] };
    const rawCount = content.length;
    const detailedJobs = await pLimit(
      content.map((r) => async () => {
        const detailRes = await safeFetch(r.ref);
        if (!detailRes || !detailRes.ok) return null;
        try {
          const detail = (await detailRes.json()) as SRDetail;
          return {
            id: `${mode}_sr_${c.slug}_${r.id}`,
            title: r.name,
            location: r.location.fullLocation ?? c.city ?? c.country,
            url: `https://jobs.smartrecruiters.com/${c.slug}/${r.id}`,
            postedAt: r.releasedDate,
            description: stripHtml(detail.jobAd?.sections?.jobDescription?.content || ""),
          };
        } catch {
          return null;
        }
      }),
      5,
    );
    const processed = processJobs(
      detailedJobs.filter((j): j is ATSRawInput => j !== null),
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
