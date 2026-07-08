---
date: 2026-07-08
category: bugs
tags: [ats, concurrency, cron, workable, cooldown, thundering-herd, jitter]
files:
  [
    src/lib/sources/ats/run-state.ts,
    src/lib/cron/fetch-jobs.ts,
    src/lib/sources/ats/workable.ts,
    src/lib/__tests__/run-state-workable-cooldown.test.ts,
    src/lib/__tests__/cron-fetch-jobs.test.ts,
    src/lib/__tests__/workable-rate-limit.test.ts,
  ]
---

# Issue #52, act 5 — the cooldown that unblocked everyone at once

Continues from `issue-52-504-recurrence-part4.md`, which fixed same-run
cooldown memory but left open "the underlying question of why ~50 distinct
Workable companies... are 429ing in the first place" and flagged that the
lane count/stagger might need raising independent of the cooldown fix. This
session answers a related but distinct question: once a batch does get
429'd together, why does it keep recurring on a ~24h cycle instead of
settling down.

## Symptoms

Three real cron runs, same 250 active companies each time:

| Run                                      | Slugs blocked | Jobs fetched | Duration | Fetch phase | Skipped |
| ---------------------------------------- | ------------- | ------------ | -------- | ----------- | ------- |
| 2026-07-07 (baseline)                    | 0             | 7,742        | 247.8s   | —           | 0       |
| 2026-07-08 00:04 (storm)                 | 33 (new)      | 5,922 (-24%) | 472.9s   | 317.3s      | 39      |
| 2026-07-08 01:39 (retest, ~95 min later) | 1 (new)       | 7,771        | 279.0s   | 121.0s      | 0       |

Every one of the 39 skipped companies in the storm run was non-Workable
(Greenhouse/Lever names: N26, Adyen, Monzo, Intercom, SumUp, etc.) — the
storm and the skip-list are the same event, not two separate bugs. The
retest confirmed the 33 blocked slugs correctly stayed blocked with zero new
attempts (cooldown persistence itself works) — but because all 33 shared
almost the same block timestamp, they were on track to expire again in
roughly the same ~90-minute window ~24h later and repeat the cycle
indefinitely.

## Root Cause

Two independent bugs, both present since before PR #58 (`cbe8936`, safeFetchJson
rollout — confirmed by diff to touch only 6 fetchers' JSON parsing and an
`ATS_TYPES` extraction; it never touched `run-state.ts` or `fetch-jobs.ts`).

**1. Flat, un-jittered cooldown expiry.** `markWorkableSlugsBlocked24h()` in
`run-state.ts` computed one `until = Date.now() + 864e5` outside its loop and
applied that same instant to every slug in the batch:

```ts
// before
export function markWorkableSlugsBlocked24h(slugs: string[]): void {
  const until = new Date(Date.now() + 864e5);
  for (const slug of slugs) setWorkableBlocked(slug, until);
}
```

This function is the one that actually persists — `flushWorkable429sToDB()`
calls it at the end of every run for every slug that 429'd, overwriting
whatever timestamp `markWorkable429()` set mid-run (itself also flat, but
irrelevant since this later call replaces it). A batch that gets rate-limited
together — the common case, since they share upstream infrastructure and
often get throttled by the same burst — comes off cooldown together too, at
the same near-identical instant, straight back into the conditions that
blocked them the first time. This is a real thundering-herd/synchronization
bug, not a one-off.

**2. One shared concurrency pool for every ATS type.** `fetch-jobs.ts` built a
single task list across all 250 companies × pipelines and ran it through one
`withConcurrencyLimit(tasks, CONCURRENCY_LIMIT)` (limit 8). A Workable company
task can occupy a slot for up to `WORKABLE_MAX_TOTAL_FETCH_MS` (90s) while
only making progress through `WORKABLE_LANE_COUNT` (2) internal lanes — so
when bug #1 released a large batch of Workable companies back into rotation
at once, several could occupy 5+ of the 8 global slots simultaneously for
extended periods, starving dispatch for every other ATS type until the
~268s fetch-phase deadline passed. That's the mechanism behind 39 skipped
companies that are all non-Workable.

**Secondary, lower-priority finding:** `resolveJobDescription()` in
`workable.ts` treated any non-2xx detail-page response identically —
`fetchWorkableUrl()` returns the final 429 `Response` itself (not `null`)
once retries exhaust, so a rate-limit casualty read as "dead/removed link"
in the warning message, indistinguishable from a genuine 404/410. Confirmed
by the fact that some companies' failure counts only appear during/after
their own active 429 episode, while others (Devsquad, Learnworlds) recur
identically across quiet runs — two different causes, one label.

## What This Session Fixed

1. **`markWorkableSlugsBlocked24h()` now jitters per slug**, drawing an
   independent random expiry in `[20h, 28h)` instead of sharing one flat
   timestamp across the whole batch:

   ```ts
   const WORKABLE_COOLDOWN_MIN_MS = 20 * 3600e3;
   const WORKABLE_COOLDOWN_MAX_MS = 28 * 3600e3;

   export function markWorkableSlugsBlocked24h(slugs: string[]): void {
     for (const slug of slugs) {
       const jitterMs =
         WORKABLE_COOLDOWN_MIN_MS +
         Math.random() * (WORKABLE_COOLDOWN_MAX_MS - WORKABLE_COOLDOWN_MIN_MS);
       setWorkableBlocked(slug, new Date(Date.now() + jitterMs));
     }
   }
   ```

   A batch blocked together now unblocks staggered across ~8 real hours
   instead of one ~90-minute window.

2. **Workable dispatch gets its own concurrency pool**, capped at
   `WORKABLE_LANE_COUNT` (imported directly from `workable.ts`, not
   duplicated) instead of sharing the global `CONCURRENCY_LIMIT` (8):

   ```ts
   const WORKABLE_CONCURRENCY_LIMIT = WORKABLE_LANE_COUNT;
   // ...
   const [workableResults, otherResults] = await Promise.all([
     withConcurrencyLimit(workableTasks, WORKABLE_CONCURRENCY_LIMIT),
     withConcurrencyLimit(otherTasks, CONCURRENCY_LIMIT),
   ]);
   ```

   Companies are partitioned by `row.ats === "workable"` before task-list
   construction. Workable can now never hold more global-equivalent slots
   than it can actually make use of internally, so a future pileup can't
   starve dispatch for unrelated ATS types.

3. **`workable.ts`'s detail-fetch warning now distinguishes cause.**
   `resolveJobDescription()` returns an optional `failureReason:
"rate-limited" | "dead-link"` alongside `detailFailed`, and a new
   `detailFailureWarning()` helper builds one of three messages depending on
   the mix:
   - all rate-limited: `"N/M job detail fetches failed (rate-limited — 429
after retries exhausted) — used list description as fallback"`
   - all dead links: unchanged, `"N/M job detail fetches failed
(dead/removed links) — used list description as fallback"`
   - mixed: `"N/M job detail fetches failed (X rate-limited, Y dead/removed
links) — used list description as fallback"`

## Test Changes

- `run-state-workable-cooldown.test.ts`: new `describe` block asserts two
  slugs marked in the same `markWorkableSlugsBlocked24h()` call land at
  different expiries — `Math.random` mocked to return exactly `0` and `1`
  to pin one slug at the 20h floor and the other at the 28h ceiling, then
  asserts `isWorkableBlocked` diverges between them at the 20h mark.
- `cron-fetch-jobs.test.ts`: new `describe` block mocks `fetchCompany` so
  every Workable call returns a promise that never resolves on its own
  (simulating a stuck batch) while every other-ATS call resolves
  immediately. Asserts `workableCallCount` sticks at exactly
  `WORKABLE_LANE_COUNT` while all 10 non-Workable tasks still dispatch and
  complete — proving the pools are actually independent, not just
  differently labeled.
- `workable-rate-limit.test.ts`: new test with one job whose detail fetch
  404s and one whose detail fetch always 429s (exhausting retries); asserts
  the resulting warning reads `"2/2 job detail fetches failed (1
rate-limited, 1 dead/removed links) — used list description as fallback"`.
- Full suite: 405/405 (was 402). Clean `tsc --noEmit`, clean `eslint` on
  every touched file (0 errors; pre-existing unrelated warnings elsewhere
  untouched).

## Not Yet Confirmed

Same caveat as every prior act in this series: this fixes confirmed,
log-verified bugs with passing unit tests, but has **not** been validated
against a live cron run. This sandbox has no network access to
Workable/Supabase. Next step is the same loop as before: run `pnpm
cron:log` for real and compare against the 2026-07-08 00:04 storm log —
looking specifically for (a) blocked-slug expiries no longer clustering
within a narrow window on the next occurrence, and (b) zero non-Workable
companies appearing under "skipped — time budget exceeded" even if a
Workable batch is mid-pileup.

**Still open, not addressed here** (same open question part 4 flagged):
_why_ batches of Workable companies 429 together in the first place. This
session's fixes reduce the blast radius and recurrence of a storm, but
don't change whether one happens. That needs a clean post-fix log to
evaluate, not a guess now.

## Related

- `docs/solutions/bugs/issue-52-504-recurrence-part4.md` — same-run cooldown
  memory; the file this doc's fixes build directly on top of.
- `docs/solutions/bugs/issue-52-504-recurrence-part3.md` — the lane pool,
  90s ceiling, and logging that made both this and part 4's bugs visible.
- `docs/solutions/bugs/issue-52-429-404-followup-part3.md` /
  `-part4.md` — the separate global-concurrency worker-pool fix and
  `safeFetchJson` rollout; confirmed by diff not to touch any file this
  session changed.
- `docs/solutions/bugs/issue-52-workable-429.md` — acts 1 & 2.
