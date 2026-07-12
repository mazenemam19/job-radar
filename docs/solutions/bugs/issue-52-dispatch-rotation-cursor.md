---
date: 2026-07-12
category: bugs
tags: [cron, dispatch, rotation, ats-companies, app_config]
files:
  [
    src/lib/cron/dispatch-cursor.ts,
    src/lib/cron/fetch-jobs.ts,
    src/lib/runner.ts,
    src/lib/database.types.ts,
    src/types/api.ts,
    src/lib/__tests__/dispatch-cursor.test.ts,
    src/lib/__tests__/cron-fetch-jobs-rotation.test.ts,
  ]
---

# Issue #52 act 7 — the same tail companies got skipped on every run because `ats_companies` had no stable, rotating dispatch order

## Symptoms

`cron_logs_v2`'s only two known "time budget exceeded" events (2026-07-07,
2026-07-08) shared 4 companies — SmartNews, Elements Interactive, Learnosity,
Plan A — despite drawing from batches of 39 and 23 companies respectively.
Same losers both times, from differently-sized batches.

## Root Cause

`runCronJob` fetched `ats_companies` with no `.order()` clause
(`src/lib/runner.ts`), so the same companies landed in the same array
position every run. `fetchAllCompanyJobs`'s time-budget check
(`src/lib/cron/fetch-jobs.ts`) skips whichever tasks haven't been dispatched
once the deadline passes — and with a fixed order, that's always the same
tail. Nothing ever moved them off it.

## Fix

`src/lib/cron/dispatch-cursor.ts` sorts the non-Workable ("other") bucket into
a stable order (`created_at asc, id asc`) and rotates it to resume right
after the last company actually dispatched last run, persisted as
`{ companyId, createdAt }` in a new `app_config.dispatch_cursor` column (one
value, not a per-row column — same pattern as `workable_blocked` /
`workable_budget` / `domain_counts`). Workable's own bucket is untouched —
its dispatch order was never implicated in either known incident (see
`issue-52-workable-429.md`).

Storing the cursor's own sort key (not just its id) means a cursor company
that's since been deactivated or deleted resolves correctly with a plain
value comparison — no extra lookup, no special case for "does this row still
exist."

## A subtlety worth flagging: rotated order, not canonical order

The obvious reading of "persist the last dispatched company, in order" is to
scan the canonical (`created_at`) order. Simulating that under a sustained
partial-skip pattern (adversarial, but not exotic — a budget that
consistently fits 4 of 5 companies) shows it gets stuck: the cursor
oscillates between only two companies forever, and the other three never see
the tail. Scanning the _rotated_ order actually used for dispatch instead
cycles every company through the skipped position exactly once per full
rotation — proved directly in
`dispatch-cursor.test.ts`'s "cycles every company through the skipped
position exactly once per full rotation" test, not just asserted.

A run that dispatches everyone (no skip at all) leaves the cursor unchanged
under this scheme rather than jumping to the canonical-last company. That's
intentional, not a gap: the rotation's starting point only matters on a run
where something gets skipped, and nothing is left behind either way when
nothing skips.

## Verification

- `dispatch-cursor.test.ts`: sort/tie-break, rotation, wrap-to-start, a
  deactivated/deleted cursor company resolving correctly, the round-robin
  proof, and DB load/flush persistence.
- `cron-fetch-jobs-rotation.test.ts`: an end-to-end regression test that
  fails against the pre-fix behavior (run 2 restarts at the top) and passes
  post-fix (run 2 resumes right after run 1's last dispatch) — confirmed by
  temporarily reverting the fix and re-running the same test. Plus an FR6
  check that Workable's dispatch order is untouched.
- Live confirmation, same bar as `issue-52-workable-429.md`: pending — needs
  the next two real "time budget exceeded" events to show no repeat overlap
  in skipped companies.
