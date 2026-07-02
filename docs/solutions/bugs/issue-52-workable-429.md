---
date: 2026-07-02
category: bugs
tags: [ats, rate-limiting, 429, workable, cron]
files:
  [
    src/lib/sources/ats/http.ts,
    src/lib/sources/ats/workable.ts,
    src/lib/__tests__/ats-utils-rate-limit.test.ts,
    src/lib/__tests__/workable-rate-limit.test.ts,
  ]
---

# Issue #52 recurred after the first fix merged — root cause was in a file the first fix never touched

## Symptoms

Two cron runs after `afba5dc` (the original issue #52 fix: per-host queue + retry
in `safeFetch`) merged to `main`, `cron_logs_v2` still showed 429s:

| run_at (UTC)        | count_429 | companies                                                                                            |
| ------------------- | --------- | ---------------------------------------------------------------------------------------------------- |
| 2026-07-02 17:44:09 | 9         | Dubizzle, Magnetis, JupiterOne, Rubikal, Uncapped, Blink22, Isentia, SmartNews, Elements Interactive |
| 2026-07-02 11:30:04 | 7         | Devsquad, Moneyfellows, Sideup, Hugging Face, Cartona, Mediavine, Mixcloud                           |

Two runs the day before (2026-07-01 17:52, 2026-07-01 11:54) had 0 429s, so this
wasn't a standing regression — it reappeared.

## Root Cause

Joining the two `companies_429` lists above against `ats_companies` showed **all
16 distinct companies across both runs use `ats = 'workable'`**. Zero from
Greenhouse, Lever, Ashby, or SmartRecruiters — the ATS types `afba5dc` actually
covers via `safeFetch` in `http.ts`.

That join is the evidence, not an assumption: with dozens of non-Workable
companies also in the pipeline and zero of them 429ing on either run, "Workable
specifically" is the only pattern the data supports.

`workable.ts` has its own fetch path — `queueWorkable()` — that never calls
`safeFetch()`. `afba5dc` never touched this file, so nothing it fixed applied
here. `workable.ts` had two of its own bugs:

1. **Queue keyed by the wrong thing.** `queueWorkable()` used a
   `Map<JobMode, Promise<unknown>>` — separate queues for `"local"` and
   `"global"`. But every Workable request, regardless of mode, hits the same
   host (`apply.workable.com`). Two independent queues meant a local-mode and
   a global-mode request could fire at the same instant, defeating the stagger
   entirely.
2. **Detail-page fetches bypassed the queue completely.** The per-job detail
   loop in `fetchWorkable()` used a raw `fetch()` with only a `pLimit(5)`
   concurrency cap — no stagger, no retry, no relation to the list-call queue.
   A company with 20 open roles could fire 5 simultaneous hits to
   `apply.workable.com`, repeated per company, per run. A 429 there was
   silently swallowed (fell back to the list description) and never counted
   toward the cooldown, so it never showed up as an error either.

## What Didn't Work

The first instinct was to treat this as insufficient tuning of the existing
`safeFetch` fix (bump `MAX_429_RETRIES`, raise the backoff cap) and go looking
for which of Greenhouse/Lever/Ashby/SmartRecruiters needed the extra budget.
That's chasing the wrong file — `safeFetch` isn't in the Workable call path at
all, so no amount of tuning it touches these companies. The retry-budget/backoff
change (see Solution, part 1) turned out to be a real fix for a real gap in
`safeFetch`, just not the cause of _this_ incident — worth keeping, wrong
target.

The correct move, and the one that actually found the root cause, was one SQL
join: `companies_429` slugs against `ats_companies.ats`. That should be the
first move next time a 429 pattern shows up, not the last.

## Solution

Two independent changes, in two commits:

**1. `http.ts` — `safeFetch` retry budget and backoff cap (real gap, not this
incident's cause).** `MAX_429_RETRIES` raised 2 → 3; backoff cap raised 15s →
30s (`RETRY_BACKOFF_CAP_MS`) so a `Retry-After` value up to 30s is honored in
full instead of silently truncated. This affects Greenhouse, Lever, Ashby, and
SmartRecruiters, none of which appeared in either affected run's list — it's
correct and tested, but doesn't touch Workable.

**2. `workable.ts` — the actual fix.** Replaced the `Map<JobMode, ...>` with a
single `workableQueue: Promise<unknown>` (one host, so no map needed). Added
`fetchWorkableUrl()`, a queued-and-retried fetch used by both the list call and
every detail call, with the same `parseRetryAfterMs`-driven backoff as
`safeFetch` (imported and exported from `http.ts` for reuse). A 429 that
exhausts retries now calls `markWorkable429()` from either call site, so it
correctly feeds the existing cross-run cooldown instead of being swallowed.

New tests in `workable-rate-limit.test.ts` were run against the pre-fix code
first and confirmed to fail there before being run against the fix:

- Queue-merge test: pre-fix spread ~500ms (two queues racing) vs. post-fix
  > 1000ms (one shared queue).
- Unqueued-detail-loop test: pre-fix spread ~0ms (5 simultaneous detail
  fetches) vs. post-fix >4000ms (queued).
- No-retry test: pre-fix 1 fetch call (429 on the list call was terminal) vs.
  post-fix 2 calls (retries and succeeds).

Full suite: 300/300 passing.

## Prevention

- **When a 429 pattern shows up again, join the affected company list against
  `ats_companies.ats` before touching any code.** That one query is what found
  the actual root cause here; guessing which fetcher needs tuning wastes a full
  session.
- Every ATS fetcher that bypasses the shared `safeFetch`/`queueByHost`
  machinery (Workable is the only one today — it predates that refactor) is a
  place a future rate-limit fix can silently not apply. If another
  fetcher grows a bespoke fetch path, it needs its own regression coverage
  like `workable-rate-limit.test.ts`, not an assumption that `http.ts`
  changes cover it.
- The regression tests here prove the code takes the queued/retried path
  against a _mocked_ `fetch` — they don't prove `apply.workable.com`'s real
  limiter clears within this budget. That can only be confirmed against a live
  cron run (see Verification below).

## Verification

Not yet confirmed — this fix has unit-test coverage but no live cron run
against it. To confirm after merge:

1. Wait for the next scheduled cron run, or trigger one manually via
   `workflow_dispatch`.
2. Re-run the established `cron_logs_v2.errors ilike '%429%'` query. Compare
   `count_429` against the two affected runs above (9 and 7).
3. Cross-check the specific 16 slugs from this incident individually via
   `jsonb_each(source_health)` — the bug could be fixed for Workable in
   general but still recur for a subset if any of these particular accounts
   have unusually aggressive per-account limits.
4. One clean run isn't sufficient on its own (2026-07-01 was clean twice before
   this recurred) — treat this as fixed only after multiple consecutive clean
   runs, and specifically confirm no Workable slug reappears in
   `companies_429`.

If it recurs _and_ the recurring companies are still all Workable: cross-run
cooldown persistence (mirroring `workable_blocked`) is the escalation, flagged
as out-of-scope in the original commit message — needs a migration.

## Related

None yet — first recurrence of issue #52.
