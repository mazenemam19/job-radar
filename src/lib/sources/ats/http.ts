// src/lib/sources/ats/http.ts
// Split out of ats-utils.ts (see AUDIT_STATUS.md row #2) — no behavior change.
import { trackDomainRequest } from "./run-state";

// Per-host lane pool. Greenhouse, Lever, Ashby, SmartRecruiters, JazzHR,
// Breezy, and Teamtailor each serve every company from a single shared host
// (e.g. boards-api.greenhouse.io), but the runner's concurrency limit (8) has
// no host awareness — 8 companies on the same ATS can fire simultaneously
// with zero stagger, which is exactly the pattern that trips a shared API's
// rate limiter. HOST_LANE_COUNT independent lanes per host cap concurrency
// instead of eliminating it — mirrors workable.ts's WORKABLE_LANE_COUNT
// pattern exactly, for the same reason: a single fully-serial chain (the
// previous version of this function) scales wall-clock time linearly with
// total request count on that host across every company in the run, which
// is what caused the Workable 504 regression and was silently present here
// too, just never exercised hard enough to notice — see
// docs/solutions/bugs/issue-52-504-recurrence-part3.md.
export const HOST_LANE_COUNT = 2;
const hostLanes = new Map<string, Promise<unknown>[]>();
const hostNextLane = new Map<string, number>();
const HOST_STAGGER_MS = [200, 400, 600];
// Some hosts need a third attempt to clear their limiter, so the retry
// budget allows one more than the common case requires. The backoff cap is
// wide enough to honor a Retry-After value up to 30s in full — a capped
// wait shorter than the requested delay means retrying before the host
// says it's ready, which defeats the point of reading the header at all.
// This queue is per-run only; a host that stays hostile for an entire run's
// retry budget needs cross-run cooldown tracking (see workable.ts's
// isWorkableBlocked/markWorkable429 for the pattern), not a bigger budget.
const MAX_429_RETRIES = 3;
const RETRY_BACKOFF_CAP_MS = 30_000;
// Hard ceiling on total wall-clock time a single safeFetch call — across
// every attempt, queue wait, and backoff combined — is allowed to spend.
// Without this, one slow or persistently-429ing host can hold a lane for
// close to the full theoretical worst case (4 attempts x 45s timeout + 3 x
// 30s backoff ~= 270s) — and because a lane is a serial chain, every other
// request queued behind it in that lane waits for the whole thing,
// regardless of any deadline the caller checks before dispatch. This cap is
// independent of, and in addition to, the cron's own dispatch-time deadline
// (see fetch-jobs.ts) — that one stops new work from starting; this one
// stops work already in flight from running away.
const MAX_TOTAL_FETCH_MS = 90_000;

function queueByHost<T>(host: string, fn: () => Promise<T>): Promise<T> {
  if (!hostLanes.has(host)) {
    hostLanes.set(
      host,
      Array.from({ length: HOST_LANE_COUNT }, () => Promise.resolve()),
    );
    hostNextLane.set(host, 0);
  }
  const lanes = hostLanes.get(host)!;
  const lane = hostNextLane.get(host)!;
  hostNextLane.set(host, (lane + 1) % HOST_LANE_COUNT);

  const stagger = HOST_STAGGER_MS[Math.floor(Math.random() * HOST_STAGGER_MS.length)];
  const result = lanes[lane].then(() => new Promise((r) => setTimeout(r, stagger))).then(fn);
  lanes[lane] = result.catch(() => {});
  return result;
}

/** Reads Retry-After (seconds or HTTP date) into a millisecond delay, if present. */
export function parseRetryAfterMs(res: Response): number | null {
  const header = res.headers.get("retry-after");
  if (!header) return null;
  const seconds = Number(header);
  if (!Number.isNaN(seconds)) return seconds * 1000;
  const dateMs = Date.parse(header);
  return Number.isNaN(dateMs) ? null : dateMs - Date.now();
}

/** Increased timeout to 45s to avoid AbortErrors under load */
export async function safeFetch(
  url: string,
  timeout = 45_000,
  extraHeaders?: Record<string, string>,
): Promise<Response | null> {
  trackDomainRequest(url);
  const t0 = Date.now();

  let host: string;
  try {
    host = new URL(url).host;
  } catch {
    host = "unknown";
  }

  const doFetch = () =>
    fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        ...extraHeaders,
      },
      signal: AbortSignal.timeout(timeout),
    }).catch(() => null);

  for (let attempt = 0; attempt <= MAX_429_RETRIES; attempt++) {
    if (Date.now() - t0 >= MAX_TOTAL_FETCH_MS) {
      console.error(
        `[safeFetch] ${host}: giving up before attempt ${attempt} — total-time ceiling (${MAX_TOTAL_FETCH_MS}ms) reached`,
      );
      return null;
    }

    const res = await queueByHost(host, doFetch);
    const elapsed = Date.now() - t0;

    if (!res) {
      console.error(
        `[safeFetch] ${host}: attempt ${attempt} network error/timeout after ${elapsed}ms`,
      );
      return null;
    }
    if (res.status !== 429 || attempt === MAX_429_RETRIES) {
      console.log(
        `[safeFetch] ${host}: attempt ${attempt} -> ${res.status} (${elapsed}ms elapsed)`,
      );
      return res;
    }

    console.warn(
      `[safeFetch] ${host}: attempt ${attempt} -> 429, backing off (${elapsed}ms elapsed)`,
    );
    const backoffMs = parseRetryAfterMs(res) ?? 1000 * 2 ** (attempt + 1);
    const cappedBackoff = Math.min(Math.max(backoffMs, 500), RETRY_BACKOFF_CAP_MS);

    if (elapsed + cappedBackoff >= MAX_TOTAL_FETCH_MS) {
      console.error(
        `[safeFetch] ${host}: backoff would exceed total-time ceiling — returning last 429 after ${elapsed}ms instead of waiting`,
      );
      return res;
    }
    await new Promise((r) => setTimeout(r, cappedBackoff));
  }
  return null; // unreachable — loop always returns
}

/**
 * Wraps safeFetch + JSON parsing behind one result type, so callers can't
 * repeat the same three failure modes inconsistently: no response, a non-2xx
 * status, and a 2xx status whose body still isn't JSON (a bot-challenge or
 * WAF page served with HTTP 200 satisfies `res.ok` but crashes `res.json()`).
 * Checking content-type before parsing catches that third case explicitly
 * instead of it surfacing as an ambiguous parse-error further down.
 */
export async function safeFetchJson<T>(
  url: string,
  timeout?: number,
  extraHeaders?: Record<string, string>,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const res = await safeFetch(url, timeout, extraHeaders);
  if (!res) return { ok: false, error: "Network/Timeout" };
  if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };

  const contentType = res.headers.get("content-type") ?? "";
  const text = await res.text();
  if (!contentType.includes("application/json")) {
    return {
      ok: false,
      error:
        `Non-JSON response (content-type: "${contentType || "none"}") — ` +
        `first 120 chars: ${text.slice(0, 120).replace(/\s+/g, " ")}`,
    };
  }
  try {
    return { ok: true, data: JSON.parse(text) as T };
  } catch (e) {
    return { ok: false, error: `Parse Error: ${e}` };
  }
}
