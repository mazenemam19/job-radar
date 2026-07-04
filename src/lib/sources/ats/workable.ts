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
// same host (apply.workable.com). A single fully-serial queue is safe from
// bursts but scales wall-clock time linearly with total request count across
// every company in the run. WORKABLE_LANE_COUNT independent lanes cap
// concurrency instead of eliminating it: at most this many requests are ever
// in flight at once, so throughput scales with lane count while every
// request still staggers behind the others in its own lane. Every
// detail-page fetch routes through the same lane pool and gets the same 429
// retry-with-backoff treatment as the list call, via fetchWorkableUrl below.
//
// Lane count is an informed default, not a measured one — validate against
// cron_logs_v2 duration and 429 count after a live run; raise it if duration
// is still too high with zero 429s, lower it if 429s reappear.
export const WORKABLE_LANE_COUNT = 2;
const workableLanes: Promise<unknown>[] = Array.from({ length: WORKABLE_LANE_COUNT }, () =>
  Promise.resolve(),
);
let nextLane = 0;
const WORKABLE_STAGGER_MS = [1500, 2000, 3000];
const WORKABLE_MAX_429_RETRIES = 3;
const WORKABLE_BACKOFF_CAP_MS = 30_000;
// Same reasoning as MAX_TOTAL_FETCH_MS in http.ts: a lane is a serial chain,
// so one request stuck retrying holds up every other request behind it in
// that lane regardless of any dispatch-level deadline. Kept as its own
// constant (not imported from http.ts) since Workable's per-request timeout
// (30s) and retry count differ from safeFetch's — the two ceilings are
// allowed to diverge if that's ever warranted, but start at the same value.
const WORKABLE_MAX_TOTAL_FETCH_MS = 90_000;

function queueWorkable<T>(fn: () => Promise<T>): Promise<T> {
  const lane = nextLane;
  nextLane = (nextLane + 1) % WORKABLE_LANE_COUNT;
  const stagger = WORKABLE_STAGGER_MS[Math.floor(Math.random() * WORKABLE_STAGGER_MS.length)];
  const result = workableLanes[lane]
    .then(() => new Promise((r) => setTimeout(r, stagger)))
    .then(fn);
  workableLanes[lane] = result.catch(() => {});
  return result;
}

/** Queued, retried fetch for any apply.workable.com URL (list or detail). */
async function fetchWorkableUrl(url: string, slug: string): Promise<Response | null> {
  trackDomainRequest(url);
  const t0 = Date.now();
  const doFetch = () =>
    fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      signal: AbortSignal.timeout(30_000),
    }).catch(() => null);

  for (let attempt = 0; attempt <= WORKABLE_MAX_429_RETRIES; attempt++) {
    if (Date.now() - t0 >= WORKABLE_MAX_TOTAL_FETCH_MS) {
      console.error(
        `[workable] ${slug}: giving up before attempt ${attempt} — total-time ceiling (${WORKABLE_MAX_TOTAL_FETCH_MS}ms) reached`,
      );
      return null;
    }

    const res = await queueWorkable(doFetch);
    const elapsed = Date.now() - t0;

    if (!res) {
      console.error(
        `[workable] ${slug}: attempt ${attempt} network error/timeout after ${elapsed}ms`,
      );
      return null;
    }
    if (res.status !== 429) {
      console.log(`[workable] ${slug}: attempt ${attempt} -> ${res.status} (${elapsed}ms elapsed)`);
      return res;
    }
    if (attempt === WORKABLE_MAX_429_RETRIES) {
      console.warn(`[workable] ${slug}: exhausted retries on 429, marking blocked`);
      markWorkable429(slug);
      return res;
    }

    console.warn(
      `[workable] ${slug}: attempt ${attempt} -> 429, backing off (${elapsed}ms elapsed)`,
    );
    const backoffMs = parseRetryAfterMs(res) ?? 1000 * 2 ** (attempt + 1);
    const cappedBackoff = Math.min(Math.max(backoffMs, 500), WORKABLE_BACKOFF_CAP_MS);

    if (elapsed + cappedBackoff >= WORKABLE_MAX_TOTAL_FETCH_MS) {
      console.error(
        `[workable] ${slug}: backoff would exceed total-time ceiling — returning last 429 after ${elapsed}ms instead of waiting`,
      );
      return res;
    }
    await new Promise((r) => setTimeout(r, cappedBackoff));
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
