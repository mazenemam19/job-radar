// src/lib/sources/ats/workable.ts
import type { ATSConfig, ATSRawInput, FetcherResult, WorkableJob, WorkableDetail } from "@/types";
import type { JobMode } from "@/lib/types";
import { processJobs, stripHtml, pLimit } from "./job-processing";
import { parseRetryAfterMs } from "./http";
import {
  trackDomainRequest,
  isWorkableBlocked,
  getWorkableBudget,
  getWorkableUsed,
  incrementWorkableUsed,
  markWorkable429,
} from "./run-state";

// Every Workable request — list or detail, local or global mode — hits the
// same host (apply.workable.com), so a single shared queue staggers all of
// it. There's exactly one host here, so a plain Promise chain is enough;
// no Map keyed by host or mode is needed. Every detail-page fetch also
// routes through this queue and gets the same 429 retry-with-backoff
// treatment as the list call, via fetchWorkableUrl below.
let workableQueue: Promise<unknown> = Promise.resolve();
const WORKABLE_STAGGER_MS = [1500, 2000, 3000];
const WORKABLE_MAX_429_RETRIES = 3;
const WORKABLE_BACKOFF_CAP_MS = 30_000;

function queueWorkable<T>(fn: () => Promise<T>): Promise<T> {
  const stagger = WORKABLE_STAGGER_MS[Math.floor(Math.random() * WORKABLE_STAGGER_MS.length)];
  const result = workableQueue.then(() => new Promise((r) => setTimeout(r, stagger))).then(fn);
  workableQueue = result.catch(() => {});
  return result;
}

/** Queued, retried fetch for any apply.workable.com URL (list or detail). */
async function fetchWorkableUrl(url: string, slug: string): Promise<Response | null> {
  trackDomainRequest(url);
  const doFetch = () =>
    fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      signal: AbortSignal.timeout(30_000),
    }).catch(() => null);

  for (let attempt = 0; attempt <= WORKABLE_MAX_429_RETRIES; attempt++) {
    const res = await queueWorkable(doFetch);
    if (!res) return null;
    if (res.status !== 429) return res;
    if (attempt === WORKABLE_MAX_429_RETRIES) {
      markWorkable429(slug);
      return res;
    }
    const backoffMs = parseRetryAfterMs(res) ?? 1000 * 2 ** (attempt + 1);
    await new Promise((r) =>
      setTimeout(r, Math.min(Math.max(backoffMs, 500), WORKABLE_BACKOFF_CAP_MS)),
    );
  }
  return null; // unreachable — loop always returns
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
  const res = await fetchWorkableUrl(listUrl, c.slug);

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
        const dr = await fetchWorkableUrl(detailUrl, c.slug);
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
