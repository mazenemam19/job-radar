---
date: 2026-07-04
category: bugs
tags: [ats, rate-limiting, 504, timeout, cron, workable, smartrecruiters, http]
files:
  [
    src/lib/sources/ats/http.ts,
    src/lib/sources/ats/workable.ts,
    src/lib/cron/fetch-jobs.ts,
    src/lib/runner.ts,
    src/lib/__tests__/ats-utils-rate-limit.test.ts,
  ]
---

# Issue #52, act 3 — the 504 came back after both Part A and Part B shipped

## Symptoms

Part A (Workable lane pool, `ce8f266`) and Part B (cron time budget, `802c33d`)
both merged and were verified: 312/312 tests, clean `tsc`, clean lint, clean
build. First live cron run after both landed still hit:

```
Vercel Runtime Timeout Error: Task timed out after 300 seconds.
```

Same failure mode as before either fix. Zero rows in `cron_logs_v2` for the
run — the function died before the insert at the end of `runCronJob` ever
executed, and there was no logging anywhere in the fetch pipeline to leave a
trace of what was running at the moment of the kill. That absence of data is
itself a finding, not just an inconvenience — see "What this session actually
fixed," item 3.

## Root Cause

**Part A and Part B were both correct fixes for what they targeted. Neither
touched the actual bottleneck, because the bottleneck was never in Workable's
code to begin with — it was copy-pasted into Workable's code, and the
original also still exists.**

Timeline, precisely:

1. **Before July 2:** Workable's own queue (`queueWorkable`, pre-`c33d44b`)
   was keyed by `JobMode`, so local/global requests raced each other, and
   detail-page fetches bypassed the queue entirely via a raw `pLimit(5)`.
   Net effect: lots of _accidental_ concurrency → fast (~150s) but 429s
   (issue #52 proper).
2. **`c33d44b` (July 2):** Fixed the 429s by collapsing Workable to one fully
   serial queue (`workableQueue`) shared by every list and detail call across
   every company. Net effect: zero accidental concurrency → no more 429s, but
   wall-clock scales linearly with total Workable request count → 504.
3. **This session, earlier (Part A):** Fixed _that_ by replacing the single
   serial chain with a `WORKABLE_LANE_COUNT`-lane bounded pool. Correct fix,
   verified against the pre-fix code specifically to confirm it would have
   caught the regression.
4. **Part B, same session:** Added a 270s dispatch-time deadline so companies
   not yet _started_ when time runs out get skipped and recorded, instead of
   the whole run blowing past 300s. Correct, but only has power over work
   that hasn't started yet.
5. **Live run, after both:** 504 again.

The reason: `http.ts`'s `queueByHost` — shared by Greenhouse, Lever, Ashby,
SmartRecruiters, JazzHR, Breezy, and Teamtailor — was **the exact same
single-fully-serial-chain-per-shared-host pattern as step 2, and had been
since before `c33d44b`.** Nobody wrote it as part of this incident; it
predates it. It just never got exercised hard enough to produce a visible
504, because:

- Greenhouse/Lever/Ashby only make one request per company (list call
  embeds full descriptions, no detail fanout) — linear-in-company-count, but
  with only one request per company the total was apparently small enough
  not to cross 300s on its own.
- **SmartRecruiters is the exception.** Its per-company detail-page fanout
  (`pLimit(5)` in `smart-recruiters.ts`) hits `r.ref` URLs that resolve to the
  same host as the list endpoint (`api.smartrecruiters.com`) — meaning every
  SmartRecruiters company's _entire_ detail fanout funnels into **one**
  `queueByHost` chain shared across **every** SmartRecruiters company in the
  run. Structurally identical to what Workable had before Part A. A company
  with a large careers page can single-handedly back up every other
  SmartRecruiters company behind it in that one chain.
- BambooHR's equivalent fanout is safer by construction, not by design intent
  — its detail URLs are `{slug}.bamboohr.com`, a distinct host per company,
  so its `pLimit(5)` doesn't compound across companies the way
  SmartRecruiters' does. Worth knowing, not urgent.

**The amplifier that made this worse than "SmartRecruiters is a bit slow":**
`safeFetch`'s retry loop had no ceiling tied to the clock. Worst case for a
_single_ call: 4 attempts × 45s timeout + 3 × 30s backoff ≈ 270s. Because
`queueByHost` chains requests with `.then()`, a request stuck in that retry
loop holds its position in the chain for the _entire_ time — every other
request queued behind it in that chain waits for all of it, and Part B's
dispatch-time deadline check has zero visibility into or power over a fetch
that's already in flight. One slow/flaky SmartRecruiters company could
single-handedly eat most of the 270s fetch budget while blocking every other
SmartRecruiters company behind it — the exact 504 shape, just from a
different fetcher than either Part A or Part B was scoped to touch.

**Smoking gun, independent of the live-run evidence:** the test file that
was supposed to guard this exact pattern —
`ats-utils-rate-limit.test.ts` — had a test named _"staggers concurrent
requests to the same host instead of firing them all at once"_ asserting
`spread > 400` for 5 concurrent requests to one host. That's not a
concurrency guard. That's "5 requests took at least 400ms of pure serial
stagger" — i.e. it defined full serialization as correct, framed as a
passing test. Identical shape to the `workable-rate-limit.test.ts` bug from
the July 2 recurrence, in the file split out from the exact commit that
fixed that one (`http.ts`, per its own header comment: "Split out of
ats-utils.ts — no behavior change"). The bug moved sideways during a refactor
that explicitly claimed it wasn't changing behavior, and nothing caught it
because the test enshrined the bug as the spec.

**What's still unconfirmed:** which specific host/company actually triggered
_this_ particular 300s kill. There is no data — that's the whole reason
logging was priority #1 this session. The architectural analysis above
identifies real, currently-verified-present hazards consistent with the
symptom (and now fixed), but "SmartRecruiters did it" is the best-supported
hypothesis, not a certainty, until a logged live run confirms it.

## What Didn't Work / Wasn't Enough

- Part A's lane pool: correct, necessary, not sufficient — it only ever
  covered Workable.
- Part B's dispatch-time deadline: correct, necessary, not sufficient — it
  has no power over work already dispatched, and the actual stall happens
  _inside_ an in-flight request's retry/queue wait, not at dispatch.
- Assuming "the file was split out with no behavior change" meant no
  behavior change. It was true for the split itself; it just preserved a
  latent bug that predated the split, and "no behavior change" language in a
  refactor commit is not the same claim as "no bugs in the current
  behavior."

## What This Session Actually Fixed

**1. `queueByHost` (`http.ts`) — same fix as Part A, one file over.**
Replaced the single `Map<string, Promise<unknown>>` (one fully-serial chain
per host) with a per-host lane pool: `Map<string, Promise<unknown>[]>`,
`HOST_LANE_COUNT = 2` lanes, round-robin assignment — structurally identical
to `workable.ts`'s `WORKABLE_LANE_COUNT` pattern. Every ATS sharing this
function (Greenhouse, Lever, Ashby, SmartRecruiters, JazzHR, Breezy,
Teamtailor) gets bounded real concurrency per host instead of full
serialization.

**2. A total-wall-clock ceiling per call, independent of retry count** — new,
not present in Part A's Workable fix either. `MAX_TOTAL_FETCH_MS` /
`WORKABLE_MAX_TOTAL_FETCH_MS` = 90s in both `safeFetch` and
`fetchWorkableUrl`. Checked before every attempt and before every backoff
wait; if a wait would cross the ceiling, the function returns the last real
response (or `null`) immediately instead of waiting. This directly fixes the
"one stuck request blocks everyone behind it in the lane for up to 270s"
amplifier — no single call can now occupy a lane for more than 90s, with or
without a deadline check anywhere upstream.

**3. Logging, end to end.** There was zero `console.*` anywhere in the fetch
pipeline before this session — confirmed by grep, not assumed. Added:

- `safeFetch` / `fetchWorkableUrl`: per attempt — host/slug, attempt number,
  status or error, elapsed ms.
- `fetch-jobs.ts`: per company+mode — dispatch start, completion with
  duration, or skipped-past-deadline.
- `runner.ts`: per phase — companies loaded, Workable state loaded, fetch
  phase start/end with job/error counts, upsert done.

This is the only way a _future_ kill leaves a trace. `console.log` output
streams to Vercel's runtime logs as it's written, independent of whether the
function completes — so even a hard-killed invocation's logs up to the kill
point are retrievable, unlike the `cron_logs_v2` row, which only gets written
if the function finishes.

**Retrieving these logs (Hobby plan):** runtime logs are retained for **1
hour** on Hobby (no log drains — that's Pro/Enterprise only). Right after a
run:

```
vercel logs <deployment-url>          # last 24h of request logs, filtered to retention window
vercel logs <deployment-url> --follow # live stream, auto-stops after 5 min
```

or the Logs tab in the Vercel dashboard for the same project. Given the cron
job itself can run up to 300s, plan to pull logs within the hour, not the
next day.

## Test Changes

`ats-utils-rate-limit.test.ts`:

- Replaced the full-serialization assertion (`spread > 400`) with a bounded-
  concurrency assertion (`maxActive > 1`, `maxActive <= HOST_LANE_COUNT`),
  same pattern Part A applied to `workable-rate-limit.test.ts`.
- Added a new test asserting the 90s ceiling actually cuts a stuck-retrying
  request off before it reaches the full 4-attempt budget.
- The three pre-existing tests (basic retry, max-retries give-up,
  Retry-After honoring, cross-host independence) all still pass unmodified —
  none of them depended on full serialization, only the stagger one did.

Full suite: 312/312 (was 311 after Part B; +1 new ceiling test). Clean `tsc
--noEmit`, clean `eslint` on every touched file, clean `next build`.

## Prevention

- **A test asserting "requests are slow/serial" as the correct behavior is
  the bug, framed as a passing test — every single time.** This is the
  second time in this exact incident (`workable-rate-limit.test.ts`, then
  `ats-utils-rate-limit.test.ts`) that a test enshrined full serialization as
  the spec. If a future test asserts a _minimum_ elapsed time for concurrent
  requests to the same resource, that assertion needs to justify why slower
  is more correct — usually it can't, and it's actually testing "did we
  accidentally remove all concurrency."
- **"Split out with no behavior change" is a claim about the mechanical
  diff, not a guarantee the pre-split code was correct.** A refactor can
  faithfully preserve a bug. Treat that language as "verified identical,"
  not "verified correct."
- **Any ATS fetcher whose detail-page fanout resolves to the same host as
  its list call is a candidate for the SmartRecruiters shape of bug** — one
  company's fanout compounds against every other company on that ATS. Worth
  a quick host audit (`new URL(url).host` for every fetcher's list vs. detail
  URLs) next time a new ATS type is added, not just for the ones that already
  bit us.
- **A retry/backoff loop with no wall-clock ceiling, sitting behind a serial
  or lane-bounded queue, means "one request is slow" silently becomes
  "everything behind it in that lane is slow."** Any future queue of this
  shape needs the ceiling from day one, not bolted on after the second 504.

## Verification

**Not yet confirmed live — this is the one thing that matters most and the
one thing that can't be done from this session.** No unit test proves a real
cron run finishes under 300s against real ATS endpoints; it only proves the
code takes the bounded-concurrency, ceiling-respecting path against a mocked
`fetch`. To confirm after this patch is applied and pushed:

1. Trigger a run (`workflow_dispatch` or wait for schedule).
2. Within the hour, pull logs: `vercel logs <deployment-url>`. Look for:
   - Whether any `[safeFetch]` or `[workable]` line shows a total-ceiling
     give-up (`giving up before attempt...`) — if so, note which host, since
     that's direct evidence for which ATS is actually the slow one.
   - The `[cron] fetch phase done` line's duration and error count.
3. Check `cron_logs_v2` for the run: `duration_ms` should be comfortably
   under 300,000, and `errors` should show `Skipped — time budget exceeded`
   entries only if the fetch phase genuinely ran long — not silently, either
   way.
4. If it 504s again: the logs from this session's changes are the first
   real data point in this entire incident. Read them before touching any
   more code — that's the whole point of adding them.

## Open Questions for the User

1. `HOST_LANE_COUNT = 2` mirrors `WORKABLE_LANE_COUNT` for consistency, but
   is an equally unmeasured guess — same caveat as Part A's lane count.
2. `MAX_TOTAL_FETCH_MS` / `WORKABLE_MAX_TOTAL_FETCH_MS` = 90s is a round
   number, not derived from anything. If live logs show legitimate slow (but
   not hung) hosts regularly hitting this ceiling and getting cut off short
   of a real response, it needs raising; if 504s persist, it needs lowering.
3. Deliberately **not done this session, scoped out on purpose**: threading
   the cron's own deadline down into every individual ATS fetcher signature
   (Greenhouse, Lever, Ashby, Workable, SmartRecruiters, BambooHR, JazzHR,
   Breezy, Teamtailor, plus `ats-bridge.ts`'s dispatcher) so a single
   in-flight fetch can abort early against the _run's_ deadline, not just its
   own fixed 90s ceiling. That's a ~10-file change with real blast radius —
   worth doing if live data shows the 90s ceiling alone isn't enough, but it
   deserves its own session and its own checkpoint, not a bolt-on to this
   one. If you pick this up next: start from live `vercel logs` output, not
   from guessing which fetcher needs it most.

## Related

- `docs/solutions/bugs/issue-52-workable-429.md` — acts 1 & 2 (the original
  429 and its Workable-specific recurrence). Has zero mention of the 504
  either of those fixes caused — that's act 3, this document.
- Original session handover: `HANDOVER-issue52-504-regression.md` (Part A/B
  scope and rationale, superseded by this doc for anything Part A/B-related
  now that both are on `main` and this session's findings supersede its
  "not yet verified" caveats).
