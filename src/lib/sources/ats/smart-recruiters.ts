// src/lib/sources/ats/smart-recruiters.ts
// Split out of ats-utils.ts (see AUDIT_STATUS.md row #2) — no behavior change.
import type { ATSConfig, ATSRawInput, FetcherResult, SRJob, SRDetail } from "@/types";
import type { JobMode } from "@/lib/types";
import { safeFetch, safeFetchJson } from "./http";
import { processJobs, stripHtml, pLimit } from "./job-processing";

export async function fetchSmartRecruiters(c: ATSConfig, mode: JobMode): Promise<FetcherResult> {
  const t0 = Date.now();
  const url = `https://api.smartrecruiters.com/v1/companies/${c.slug}/postings`;
  const result = await safeFetchJson<{ content: SRJob[] }>(url);

  if (!result.ok)
    return {
      jobs: [],
      rawCount: 0,
      error: result.error,
      durationMs: Date.now() - t0,
      ok: false,
    };

  // NOTE: no shape guard on `content` — same latent risk class as
  // teamtailor.ts's fix, no live evidence for SmartRecruiters specifically.
  // Flagged, not bundled in.
  const { content } = result.data;
  const rawCount = content.length;

  // Per-job detail fetch is left on the old safeFetch + res.ok + try/catch
  // pattern on purpose — same carve-out as workable.ts's detail path. A bad
  // detail response here already degrades without crashing: it returns
  // `null` and the job is filtered out below. That's a *different* defect
  // (a job silently dropped, rather than a description falling back to the
  // list description) — real, but pre-existing and out of scope for this
  // migration, which targets the list-call crash class only.
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
}
