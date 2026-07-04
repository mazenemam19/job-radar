---
date: 2026-07-04
category: bugs
tags: [ats, rate-limiting, 504, workable, cooldown]
files:
  [
    src/lib/sources/ats/run-state.ts,
    src/lib/sources/ats/workable.ts,
    src/lib/__tests__/run-state-workable-cooldown.test.ts,
    src/lib/__tests__/workable-rate-limit.test.ts,
  ]
---

# Issue #52, act 4 — the cooldown that only protected tomorrow's run

## Symptoms

Local run via `pnpm cron` (no Vercel 300s kill, so it just ran long instead
of dying): `[cron] SmartNews (global): done in 562878ms` — one company, over
9 minutes. Grepping the full log: 415 separate `429, backing off` lines
across 50 distinct Workable slugs, and zero `marking blocked` lines despite
that volume. One slug (`imachines`) appears in 51 separate `[workable]` log
lines across the run.

## Root Cause

Two bugs stacked on top of each other:

**1. `markWorkable429` never protected the run that called it.** It only
added the slug to an in-memory `Set` (`workable429SlugsThisRun`), which
`flushWorkable429sToDB` reads and persists to `app_config.workable_blocked`
— but that flush happens in `runner.ts` _after the entire fetch phase
completes_. `isWorkableBlocked()` only ever checked the DB-loaded cache from
the _start_ of the run (`loadWorkableStateFromDB`). Net effect: a slug that
429s at minute 2 gets zero protection for the rest of that same run. Every
other in-flight or not-yet-started detail-page request for that company
independently walks into the same wall, with no memory of the ones that
already failed.

**2. The one call site that marked a slug blocked was effectively
unreachable.** `markWorkable429` was only invoked when
`attempt === WORKABLE_MAX_429_RETRIES` (3 retries exhausted). But 3 retries'
worth of backoff (capped at `WORKABLE_BACKOFF_CAP_MS` = 30s each) adds up to
close to `WORKABLE_MAX_TOTAL_FETCH_MS` (90s) on its own — so the per-call
wall-clock ceiling from part 3 almost always cuts the loop short first,
hitting the `"backoff would exceed total-time ceiling"` early return instead
of ever reaching the exhausted-retries branch. Confirmed by the log: 0
`"marking blocked"` lines against 415 429s.

Combined: a company whose careers page lists many jobs (`pLimit(5)`
detail-page fanout) can have dozens of detail requests, each one
independently discovering the 429, each paying up to ~90-100s before giving
up, with no slug-level memory carried between them within the run. That's
the arithmetic behind a single company taking 562 seconds.

## What This Session Fixed

1. **`markWorkable429` now calls `setWorkableBlocked` immediately** (24h
   window, same as the cross-run block), so `isWorkableBlocked` reflects it
   for the rest of the _current_ run, not just the next one. The end-of-run
   DB flush is unchanged and still persists it for future runs.
2. **The ceiling-triggered give-up path in `fetchWorkableUrl`
   (`"backoff would exceed total-time ceiling"`) now calls
   `markWorkable429`** when the last response was a 429 — this is the path
   that actually fires in practice, unlike the exhausted-retries branch.
3. **The detail-page fanout in `fetchWorkable` checks `isWorkableBlocked`
   before each request**, not just once at the top of the function before
   the list call. Once any detail request for a company gets the slug
   blocked, later batches (`pLimit(5)`) skip the network call entirely
   instead of re-discovering the same 429.

## Test Changes

- New `run-state-workable-cooldown.test.ts`: asserts `isWorkableBlocked`
  flips to `true` immediately after `markWorkable429`, with no DB round
  trip — directly targets bug 1.
- New test in `workable-rate-limit.test.ts`: 15-job company where every
  detail call 429s forever; asserts total detail-fetch attempts stay well
  under `15 × retries`, proving later batches short-circuit instead of each
  independently re-discovering the block.
- Full suite: 315/315 (was 312). Clean `tsc --noEmit`, clean `eslint` on
  every touched file.

## Not Yet Confirmed

Same caveat as part 3: this fixes a confirmed, log-verified bug, but hasn't
been validated against a live Vercel cron run yet. Local `pnpm cron:log`
(no 300s kill) is the right next step to confirm total run duration drops
and per-company outliers like the SmartNews line disappear — then a real
scheduled run to confirm the 504 itself is gone.

**Still open, deliberately out of scope this session**: the underlying
question of _why_ ~50 distinct Workable companies (out of 266 total) are
429ing in the first place. Two lanes with a 1.5-3s stagger is roughly
0.6-1.3 req/s sustained across the entire Workable integration — this
session's fix stops one bad slug from being repeatedly re-punished within a
run, but if Workable's actual limit is lower than that sustained rate, the
lane count/stagger themselves may need raising independent of the cooldown
fix. That needs a clean log (post this fix) to evaluate, not a guess now.

## Related

- `docs/solutions/bugs/issue-52-504-recurrence-part3.md` — the lane pool,
  90s ceiling, and logging that made this bug visible in the first place.
- `docs/solutions/bugs/issue-52-workable-429.md` — acts 1 & 2.
