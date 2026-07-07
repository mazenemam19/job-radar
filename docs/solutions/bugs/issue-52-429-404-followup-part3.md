---
date: 2026-07-07
category: bugs
tags: [ats, concurrency, cron, jazzhr, breezy, workable, teamtailor, validation]
files:
  [
    src/lib/cron/fetch-jobs.ts,
    src/lib/sources/ats/http.ts,
    src/lib/sources/ats/breezy.ts,
    src/lib/sources/ats/jazzhr.ts,
    src/lib/sources/ats/workable.ts,
    src/lib/sources/ats/teamtailor.ts,
    src/lib/ats-bridge.ts,
    src/lib/runner.ts,
    src/lib/types.ts,
    src/types/api.ts,
    src/scripts/cron.ts,
  ]
---

# Issue #52, 429/404 follow-up — part 3: shipped, validated, what's left

Continues from `issue-52-429-404-followup.md` (part 1, not committed to this
repo — session-local) and `issue-52-429-404-followup-part2.md` (part 2, also
session-local). Both are summarized below so this doc is self-contained;
future sessions shouldn't need the originals to pick this up.

## Lineage — what part 1 and part 2 found

**Part 1** parsed `cron-20260705-015011.log` and found: 9 "uncategorized"
errors, 13 permanent 404s (assumed all Workable — **this was wrong**), a
Devsquad company that succeeded but silently swallowed two dead job-detail
links, and a working theory that a cluster of generic network
errors/timeouts was caused by local network flakiness. Also shipped, in
part 1: a cross-platform rewrite of `cron:log` (`scripts/cron-log.ts`), since
the old bash-only `tee` invocation silently produced no log file on Windows.

**Part 2** (this doc's direct predecessor) re-derived everything from the
same log, line by line, instead of trusting part 1's summary, and corrected
two of its theories:

- The "local network flakiness" theory was wrong. `withConcurrencyLimit` in
  `fetch-jobs.ts` called every task unconditionally before checking the
  concurrency limit, so the limit only throttled how fast the `for` loop
  advanced, not how many tasks actually ran. Proven in an isolated
  instrumented script: **265 of 266 tasks running concurrently against a
  requested limit of 8.**
- The "13 dead companies are all Workable" theory was wrong. They're 9
  Greenhouse, 3 Lever, 1 Ashby — traced from dispatch line to actual
  `safeFetch` host, not assumed from a DB summary.

Part 2 also found and fixed-in-plan: every ATS fetcher trusts `res.ok` to
mean "this body is JSON," which a 200-status WAF/bot-challenge page defeats,
producing a misleading `Parse Error: SyntaxError` (confirmed repro:
Artefactual Systems Inc. on Breezy). And: TED / Roadpass Digital were
dispatched twice — once under their real ATS (success) and once under a
dead `jazzhr` row (timeout) — with JazzHR confirmed dead and slated for full
removal.

## What shipped this round — three commits

**`b9be705` — concurrency fix + `safeFetchJson`**
`withConcurrencyLimit` rewritten as a worker-pool (`limit` workers pulling
from a shared index) instead of task-then-check. Added `safeFetchJson()` to
`http.ts`: checks `res.ok`, then `content-type`, then parses — returns a
typed result instead of throwing past a fake-JSON body. Migrated `breezy.ts`
only (the confirmed repro case); the other 8 fetchers were left on the old
pattern on purpose, pending individual verification.

**`84cc45b` — JazzHR removal + dead-company pause**
Removed the JazzHR fetcher, its `ATSType` union member, its submit-form
option, and every reference across the codebase (grep turned up two more
spots part 2's list missed: `src/types/api.ts`'s independent ATS union, and
stale mentions in `README.md`/`docs/ARCHITECTURE.md` — both fixed;
`CHANGELOG.md` and the historical part3-504 doc were correctly left alone as
period records). DB-side: three `ats_companies` rows had `ats='jazzhr'`, not
two — a third, Humi Inc, turned up when the "stop and re-plan if anything
unexpected shows up" check was actually run; its pipelines were already off,
which is why it never appeared in the dispatch log part 2's claim was based
on. All three deleted by hand in Supabase. The 13 dead-404 companies were
paused (`is_active = false`), also by hand in Supabase, per the plan.

**`362bdd8` — Devsquad-style dead-link visibility**
`FetcherResult` gained an optional `warnings` field, distinct from `error`.
`fetchWorkable` tracks per-job detail-fetch failures and reports
`"N/M job detail fetches failed (dead/removed links) — used list
description as fallback"` without failing the company. Threaded through
`ats-bridge.ts` → `fetch-jobs.ts` → `CronRunResult` → `cron_logs_v2`
(new `warnings text[]` column) → `cron.ts`'s console summary (separate
`Warnings:` section, `⚠` vs `•`).

## Validation

Ran `pnpm run cron:log` for real (production Supabase, production SMTP —
there is no dry-run mode or staging environment in this repo; see the
"known limitation" note below). Compared the resulting
`cron-20260707-032609.log` against the original `cron-20260705-015011.log`
the whole investigation was built from.

| Metric                       | Before (07-05)           | After (07-07)                            |
| ---------------------------- | ------------------------ | ---------------------------------------- |
| Active companies loaded      | 266                      | 250 (-16 = 13 paused + 3 jazzhr deleted) |
| Peak concurrent dispatches\* | **217**                  | **8**                                    |
| Total errors                 | 55                       | 29                                       |
| `Network/Timeout` errors     | 19                       | 1                                        |
| `Blocked (Cooldown)` errors  | 22                       | 22 (unrelated, unchanged as expected)    |
| Warnings                     | n/a (field didn't exist) | 1                                        |
| Duration                     | 246.1s                   | 247.8s                                   |
| Jobs fetched                 | 7,748                    | 7,742                                    |

\* computed by walking each log counting `dispatching` against `done in`
lines and tracking the running total — reproducible with:

```python
import re
def peak_concurrency(path):
    open_count = peak = 0
    for line in open(path):
        if re.search(r'\[cron\].*: dispatching', line):
            open_count += 1; peak = max(peak, open_count)
        elif re.search(r'\[cron\].*: done in', line):
            open_count -= 1
    return peak
```

**Every expected outcome from the pre-validation plan matched:**

- Peak concurrency 217 → 8. The worker-pool fix works exactly as designed —
  this is the single biggest number in this doc.
- TED and Roadpass Digital each dispatch exactly once now, under their real
  ATS (`smartrecruiters`, `workable`), with no errors — the jazzhr duplicate
  is gone, the real row still works. Humi Inc doesn't appear at all
  (pipelines were already off).
- None of the 13 paused companies appear anywhere in the new log.
- Artefactual Systems Inc. (the confirmed Breezy repro) now reports
  `Non-JSON response (content-type: "text/html; charset=utf-8")...` instead
  of the old misleading `Parse Error: SyntaxError`.
- Devsquad reports exactly `2/2 job detail fetches failed (dead/removed
links) — used list description as fallback` under `Warnings (1):`, and
  does not appear under `Errors` — confirms it's treated as a success with
  a caveat, not a failure.
- `cron_logs_v2 insert done` with no error — confirms the `warnings text[]`
  column was actually added in Supabase (verified separately via
  `information_schema.columns`) and the insert no longer risks the silent
  "column does not exist" failure mode flagged as a blocker before this run.

### New findings surfaced by the validation run itself

The concurrency fix didn't just reduce the timeout count — it **unmasked
what several of those timeouts actually were**, because a request that used
to lose the socket-contention race and time out now completes far enough to
get a real response:

- **Connexa and Skillcrush** were `Network/Timeout` in the old log. In the
  new log, both — along with Artefactual Systems Inc. — return the exact
  same 200-status Webflow page (`<!DOCTYPE html><!-- Last Published: Thu
Jul 02 2026 13:13:26 GMT...`). All three are Breezy companies, all three
  are now correctly diagnosed as `Non-JSON response` instead of a generic
  timeout or a misleading parse error. **Not yet actioned**: these three
  share the exact failure signature of the 13 already-paused dead companies
  (a board that no longer serves real content). Worth a human decision on
  whether they join the pause list — not done here, same reason the JazzHR
  DB check wasn't skipped: don't assume, verify each one.
- **BookingSync and Exness** were `Network/Timeout` in the old log; now
  `HTTP 403` in the new one. Likely real bot-detection/Cloudflare blocking,
  not a code bug. Needs its own investigation (headers, UA string) —
  unrelated to anything in this doc's scope, flagged so it isn't lost.
- **Yodo1** (Teamtailor) was `Network/Timeout` in the old log; now
  `Parse Error: TypeError: Cannot read properties of undefined (reading
'length')`. This is a live, production-confirmed instance of the exact
  same bug class Priority 1 fixes — `teamtailor.ts` still does
  `const { data } = await res.json(); data.length` with no shape check —
  it's just an unmigrated fetcher hitting it for real, not a hypothetical.
  **This should move `teamtailor.ts` to the front of the remaining
  `safeFetchJson` rollout** — see priorities below.
- **Full Fabric** is `Network/Timeout` in both logs — before and after the
  concurrency fix. This one is a genuine isolated host issue (also
  Teamtailor), not something this round's fixes touch. Separate
  investigation, low priority.

### Known limitation surfaced during validation planning

`pnpm cron` / `pnpm run cron:log` has no dry-run mode and this repo has no
staging Supabase project — every invocation (local or via the `cron.yml`
GitHub Actions `workflow_dispatch`, which just curls the live `/api/cron`)
writes real data and sends real "scan complete" emails to real users. Not a
bug, just worth remembering before re-running validation casually.

## Process gaps worth fixing in how we work, not just what we ship

Two commit-message/reality mismatches turned up while diffing this session
against the actual repo — neither is a functional bug, both are worth
naming so they don't recur:

1. **`362bdd8`'s commit message claims it added
   `supabase/migrations/0001_cron_logs_v2_add_warnings.sql`. It didn't** —
   that file is not in that commit's diff stat and doesn't exist anywhere in
   the repo's history. The column was applied by hand directly in Supabase's
   SQL editor (confirmed working, per the validation above) but never
   captured in a file. This is the second time this has happened — compare
   `31ecc78` (added `supabase/migrations/20260627_increment_domain_counts.sql`,
   correctly, in the diff) followed by `a5e39cc` ("remove sql script") once
   it was confirmed applied. That's the right pattern — commit the file,
   confirm it's applied, remove it in a follow-up commit — and it just
   wasn't followed this time. Recommendation: when a commit message names a
   specific file, `git show --stat` your own commit before finalizing the
   message.
2. **Same commit's message says "the other 7 ATS fetchers" and names exactly
   six** (ashby, bamboohr, greenhouse, lever, smart-recruiters, teamtailor).
   `workable.ts`'s own list-call — in the very file that commit was already
   editing for the Devsquad warning feature — has the identical `res.ok` +
   bare `res.json()` pattern and was not named. It's 7 files, and workable
   is one of them.

## Remaining / open work — priority order for next session

1. ~~**`safeFetchJson` rollout, teamtailor first.**~~ **Done** — see
   `issue-52-429-404-followup-part4.md`. All 7 remaining fetchers migrated;
   `teamtailor.ts` additionally got an explicit shape guard (Yodo1's actual
   failure was valid JSON with no `data` array, which `safeFetchJson` alone
   doesn't catch). Live per-company verification against `pnpm cron:log`
   still needs to happen in a real environment — not done from this
   session's sandbox, see part 4 for why.
2. ~~**`ATS_TYPES` array in `submit/page.tsx`**~~ **Done** — extracted to
   `src/lib/constants.ts`, see `issue-52-429-404-followup-part4.md`.
3. **Admin dashboard cron-summary card** — doesn't display `errors` or
   `warnings` today (confirmed: `select("run_at, total_fetched, duration_ms,
trigger")` in `src/app/(protected)/admin/page.tsx`). Explicitly deferred
   in `362bdd8` pending a real fetch-health view. Still deferred; not urgent.
4. **Artefactual Systems Inc. / Connexa / Skillcrush** — confirm with the
   user whether these three Breezy boards (identical stale Webflow page)
   should join the pause list, same as the original 13.
5. **BookingSync / Exness** — real `HTTP 403`s, likely bot-detection. Needs
   its own investigation (headers/UA), unrelated to this doc's fixes.
6. **Full Fabric** — persistent isolated Teamtailor timeout, present before
   and after the concurrency fix. Separate, low-priority investigation.
7. **Commit hygiene** — see the two process gaps above. No code change
   needed, just a habit: verify file lists and counts against `git show
--stat` before writing the message that describes them.
8. **New from part 4**: no shape guard was added to `greenhouse.ts`,
   `lever.ts`, or `smart-recruiters.ts`, which have the same latent
   shape-trust gap teamtailor had — no live evidence of it firing for these
   three, so flagged in-code rather than fixed. Also new:
   `smart-recruiters.ts`'s per-job detail-fetch loop silently drops a job
   entirely on a bad detail response (returns `null`, filtered out) rather
   than falling back to a list-level description like `workable.ts`/
   `bamboohr.ts` do — pre-existing, real, out of scope for part 4.

## Files touched or referenced this session

- `docs/solutions/bugs/issue-52-429-404-followup-part3.md` — this doc, new.
- `CHANGELOG.md` — `[Unreleased]` entry added summarizing the three commits
  above, referencing this doc.
- No code changes this session — this was validation + documentation only.
  All three commits (`b9be705`, `84cc45b`, `362bdd8`) were already merged
  going into this session.
