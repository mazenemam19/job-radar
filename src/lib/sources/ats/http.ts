// src/lib/sources/ats/http.ts
// Split out of ats-utils.ts (see AUDIT_STATUS.md row #2) — no behavior change.
import { trackDomainRequest } from "./run-state";

// Per-host request queue. Greenhouse, Lever, Ashby, and SmartRecruiters each
// serve every company from a single shared host (e.g. boards-api.greenhouse.io),
// but the runner's concurrency limit (8) has no host awareness — 8 companies
// on the same ATS can fire simultaneously with zero stagger,
// which is exactly the pattern that trips a shared API's rate limiter.
// This staggers requests to the same host and, on a 429, backs off and
// retries instead of just giving up for the rest of the run.
const hostQueues = new Map<string, Promise<unknown>>();
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

function queueByHost<T>(host: string, fn: () => Promise<T>): Promise<T> {
  const stagger = HOST_STAGGER_MS[Math.floor(Math.random() * HOST_STAGGER_MS.length)];
  const prev = hostQueues.get(host) ?? Promise.resolve();
  const result = prev.then(() => new Promise((r) => setTimeout(r, stagger))).then(fn);
  hostQueues.set(
    host,
    result.catch(() => {}),
  );
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
    const res = await queueByHost(host, doFetch);
    if (!res) return null;
    if (res.status !== 429 || attempt === MAX_429_RETRIES) return res;

    const backoffMs = parseRetryAfterMs(res) ?? 1000 * 2 ** (attempt + 1);
    await new Promise((r) =>
      setTimeout(r, Math.min(Math.max(backoffMs, 500), RETRY_BACKOFF_CAP_MS)),
    );
  }
  return null; // unreachable — loop always returns
}
