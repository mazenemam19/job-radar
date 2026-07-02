// src/lib/sources/ats/workable.ts
// Split out of ats-utils.ts (see AUDIT_STATUS.md row #2) — no behavior change.
import type { ATSConfig, ATSRawInput, FetcherResult, WorkableJob, WorkableDetail } from "@/types";
import type { JobMode } from "@/lib/types";
import { processJobs, stripHtml, pLimit } from "./job-processing";
import {
  isWorkableBlocked,
  getWorkableBudget,
  getWorkableUsed,
  incrementWorkableUsed,
  markWorkable429,
} from "./run-state";

const workableQueues = new Map<JobMode, Promise<unknown>>();

function queueWorkable<T>(fn: () => Promise<T>, mode: JobMode): Promise<T> {
  const delays = [1500, 2000, 3000];
  const randomDelay = delays[Math.floor(Math.random() * delays.length)];

  if (!workableQueues.has(mode)) {
    workableQueues.set(mode, Promise.resolve());
  }

  const currentQueue = workableQueues.get(mode)!;
  const result = currentQueue.then(() => new Promise((r) => setTimeout(r, randomDelay))).then(fn);
  workableQueues.set(
    mode,
    result.catch(() => {}),
  );
  return result;
}

export async function fetchWorkable(c: ATSConfig, mode: JobMode): Promise<FetcherResult> {
  const t0 = Date.now();
  if (isWorkableBlocked(c.slug))
    return {
      jobs: [],
      rawCount: 0,
      error: "Blocked (Cooldown)",
      durationMs: Date.now() - t0,
      ok: false,
    };

  const budget = getWorkableBudget();
  const limit = budget[mode as JobMode];
  const used = getWorkableUsed(mode);
  if (used >= limit)
    return {
      jobs: [],
      rawCount: 0,
      error: "Budget Exceeded",
      durationMs: Date.now() - t0,
      ok: false,
    };
  incrementWorkableUsed(mode);

  const listUrl = `https://apply.workable.com/api/v1/widget/accounts/${c.slug}?details=true`;
  const doFetch = () => {
    return fetch(listUrl, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      signal: AbortSignal.timeout(30_000),
    })
      .then((r) => {
        if (r.status === 429) markWorkable429(c.slug);
        return r;
      })
      .catch(() => null);
  };

  const res = await queueWorkable(doFetch, mode);

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
    const data = (await res.json()) as { jobs?: WorkableJob[] };
    const rawJobs = data.jobs || [];
    const rawCount = rawJobs.length;
    // NOTE: title pre-filtering was removed — all jobs now flow through
    // to the per-user scoring pipeline where filtering actually belongs.
    // Removed for the same reason as processJobs — role filtering is the
    // user's call via /settings now, not a hardcoded gate. If Workable detail-fetch
    // volume becomes a real budget concern, that's a separate, deliberate decision —
    // not a silent side effect of this filter.
    const jobs = rawJobs;
    const withDesc = await pLimit(
      jobs.map((r) => async () => {
        const detailUrl = `https://apply.workable.com/api/v1/widget/accounts/${c.slug}/jobs/${r.shortcode}`;
        const dr = await fetch(detailUrl, {
          headers: { "User-Agent": "Mozilla/5.0" },
          signal: AbortSignal.timeout(30_000),
        }).catch(() => null);
        let desc = stripHtml(r.description || "");
        if (dr && dr.ok) {
          try {
            const detail = (await dr.json()) as WorkableDetail;
            desc = stripHtml(detail.full_description || detail.description || desc);
          } catch {}
        }
        return {
          id: `${mode}_workable_${c.slug}_${r.shortcode}`,
          title: r.title,
          location: r.city ?? c.city ?? c.country,
          url: r.url,
          postedAt: r.published_on,
          description: desc,
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
