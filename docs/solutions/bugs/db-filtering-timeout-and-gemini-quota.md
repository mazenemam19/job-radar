---
date: 2026-07-13
category: bugs
tags: [postgres, cte, materialized, statement-timeout, gemini, quota, caching, dashboard, pipeline]
files:
  [
    supabase/migrations/20260711000000_jr_filtered_raw_jobs.sql,
    supabase/migrations/20260714000000_gemini_review_cache.sql,
    src/lib/gemini.ts,
    src/lib/gemini-model-fallback.ts,
    src/lib/gemini-batch-filter.ts,
    src/lib/gemini-review-cache.ts,
    src/lib/dashboard-route.ts,
    src/app/api/dashboard/route.ts,
    src/components/pipeline/FunnelView.tsx,
    src/lib/__tests__/gemini.test.ts,
    src/lib/__tests__/gemini-review-cache.test.ts,
    src/lib/__tests__/dashboard-route.test.ts,
  ]
---

# PR #60 (DB-level job filtering) broke the dashboard twice after merge — a Postgres CTE inlining bug, then a Gemini quota/caching gap

## Symptoms

Immediately after merging PR #60 (`feat: move filtering logic from js to db`)
and applying `jr_get_filtered_raw_jobs`'s migration by hand in the Supabase
SQL editor, `/api/dashboard` returned a generic 500:

```json
{ "ok": false, "error": "Something went wrong. Please try again." }
```

The real error only reached the server console
(`[dashboard:GET:fetchFilteredRawJobs] fetchFilteredRawJobs failed: ...`,
by design — `catchErrorResponse` never leaks raw errors to the client) and
Supabase's own Postgres logs: `sql_state_code: 57014`,
`event_message: "canceling statement due to statement timeout"`.

Once that was fixed and the dashboard started returning jobs again, two
further problems surfaced:

- Some jobs displayed a **"⚠ Not AI-reviewed"** (or **"⚠ Gemini quota
  exhausted"**) badge despite a valid, freshly-added Gemini API key — while
  other jobs in the same feed reviewed fine.
- The `/pipeline` funnel view's "Settings filter" tooltip still read
  _"Removed jobs that failed seniority gate or disabled pipelines"_, which
  undersold what that stage now actually does post-PR#60, making it look
  like filtering had regressed to the old all-JS behavior when it hadn't.

## Root Cause

Two unrelated causes, found in sequence because the first one blocked the
app entirely and the second only became visible once jobs were reaching the
UI again.

### 1. `patterns` CTE wasn't materialized — rebuilt on every row, not once per query

`jr_get_filtered_raw_jobs` builds its keyword/regex patterns once, in a
`patterns` CTE, then references those columns throughout the main `WHERE`
clause. Postgres 12+ silently inlines simple CTEs unless they're marked
`MATERIALIZED`. This one wasn't. `EXPLAIN (analyze, buffers)` on the
function's body **inlined**, not on the opaque function call — the latter
just reports one wall-clock number for the whole call and hides this
entirely — showed the `Seq Scan on raw_jobs` filter calling
`jr_word_boundary_pattern($9)` / `jr_substring_pattern($11)` directly inside
the per-row filter expression. Both helpers do a `string_agg` +
per-term `regexp_replace` over the settings arrays (60 excluded keywords,
~20 blacklist terms, etc. for the account this was diagnosed against) —
that cost was being paid **once per row of `raw_jobs`**, not once per query.
Cheap and invisible on a small table; a full statement-timeout on a
production-sized one.

### 2. No persistent Gemini decision cache, and unpaced sequential batches

`filterJobsWithGemini` had no memory across calls. Every cache rebuild —
which happens on every cron run (`.github/workflows/cron.yml`, twice
daily) — re-sent every still-in-age-window job to Gemini from scratch, in
batches of 15, in a tight sequential loop with zero delay between batches.
Two compounding effects:

- **Wasted spend**: a job that's still in the pool 5 days after its first
  review (well within a typical `job_age_days` setting) gets re-asked the
  identical question, with the identical prompt, and gets the identical
  answer — for every cron cycle it survives.
- **Quota exhaustion mid-rebuild**: on a cold rebuild (e.g. right after a
  `user_jobs_cache` row is deleted to force a refresh), the number of
  batches can run into the hundreds. Firing them back-to-back with no
  pacing burns through a model's per-minute quota partway through, and
  `filterBatch`'s fail-open path (by design — see `gemini-batch-filter.ts`)
  marks every job in an exhausted batch `reviewed: false`. Later batches,
  once quota resets, succeed normally — hence some jobs reviewed, some not,
  in the same feed.

## What Didn't Work

- **First guess (mine, and the person's — 80% confidence): the SQL file
  itself was wrong.** It wasn't. The migration ran clean against a real
  Postgres 16 instance, and the function returned correct results for every
  edge case tried (regex-special-character keywords like `C++`/`node.js`,
  empty-array gates, the skill-match floor's deliberate empty-array
  rejection). Root cause #1 is a planner behavior, not a logic bug — the
  function was _correct_, just catastrophically re-executing part of its own
  work per row.
- **The person's first applied fix (Gemini-suggested): `||` → `concat_ws`
  for NULL-safety, labeled "security."** Verified as a byte-for-byte no-op
  against the actual schema — `title`/`description`/`location` are all
  `NOT NULL` columns. It wasn't wrong to apply, just irrelevant to either
  problem, and mislabeled (there's no injection vector in either form; this
  is string-concatenation into an `ILIKE` value, not dynamic SQL). What
  actually made the dashboard start working again after this was pasted in:
  re-running `CREATE OR REPLACE FUNCTION` at all re-triggers Supabase's
  PostgREST schema-cache reload — coincidental, not causal.
- **My own first "optimization" attempt at root cause #1: converting the
  four ILIKE-loop gates (blacklist, required-keywords, skill-match,
  global-allowed) to combined regex patterns, matching the style already
  used by the other three gates.** Measured _slower_ (935ms → 1340ms at
  30k synthetic rows), not faster — because it added four more
  per-row-recomputed pattern-building calls on top of the four the original
  code already had, without fixing the actual defect (the CTE not being
  materialized). Only `EXPLAIN (analyze, buffers)` on the **inlined** query
  — not the function call — surfaced the real mechanism.
- **Suspected stale `user_jobs_cache` entry as the reason results "didn't
  match settings."** Checked `from_cache` / `cached_at` in the dashboard
  API response first — it was `true`, but `cached_at` was recent (written
  by the _new_ pipeline, post-fix), so this wasn't stale pre-PR data. The
  caching mechanism itself was working as designed; it just wasn't the
  explanation for that particular complaint, which turned out to just be
  correct pipeline behavior misread against a stale tooltip (see Solution,
  part 3).

## Solution

**1. `MATERIALIZED` on the `patterns` CTE** (`jr_get_filtered_raw_jobs`,
`supabase/migrations/20260711000000_jr_filtered_raw_jobs.sql`):

```sql
patterns as materialized (
  select
    jr_word_boundary_pattern(p_all_level_terms)      as all_level_pat,
    ...
),
```

Forces the pattern-building calls to execute exactly once per query
instead of once per row. Verified with `EXPLAIN (analyze, buffers)` against
synthetic tables built to the real schema, same real settings arrays, both
before and after:

| Rows    | Before (inlined) | After (materialized) |
| ------- | ---------------- | -------------------- |
| 30,000  | 935 ms           | 544 ms               |
| 200,000 | 4,059 ms         | 1,413 ms             |

The gap widens with scale (1.7× → 2.9×), consistent with removing an
O(rows) cost rather than a constant one. Also folded in, while already
touching the grants: `revoke ... from public, anon, authenticated` (the
original only revoked from `public`, leaving a latent gap if this project's
default privileges ever grant `anon`/`authenticated` execute on new
functions).

**2. `user_job_gemini_reviews` — a persistent, prompt-scoped review cache**
(`supabase/migrations/20260714000000_gemini_review_cache.sql`):

```sql
create table user_job_gemini_reviews (
  user_id      uuid not null references auth.users(id) on delete cascade,
  job_id       text not null references raw_jobs(id) on delete cascade,
  prompt_hash  text not null,
  gemini_pass  boolean not null,
  gemini_reason text,
  reviewed_at  timestamptz not null default now(),
  primary key (user_id, job_id)
);
```

Keyed by `(user_id, job_id)`, scoped by a SHA-256 hash of
`gemini_filter_prompt` so editing the prompt naturally invalidates old
decisions instead of needing an explicit cache-bust. RLS-scoped to the
owning user (same access pattern as `user_jobs_cache`), not admin-client
reads. **Only real decisions (`reviewed: true`) are ever written** — a
job that failed open (quota exhausted, missing idx in Gemini's response)
is deliberately left uncached, so it retries on the next rebuild instead
of being stuck "unreviewed" forever.

`filterJobsWithGemini` (previously one function in `gemini.ts`) now:
consults the cache first (`loadCachedDecisions`) → only sends
still-uncached jobs to Gemini, in batches, with a 300ms pace between
batches → persists only the real decisions it got back
(`persistDecisions`). Split across four files during this change, purely
to stay under this project's own `max-lines`/`complexity` ESLint limits
once the new logic pushed both over their caps:

- `gemini-model-fallback.ts` — the shared try-each-model-in-`MODEL_QUEUE`
  loop (pre-existing, unmoved logic, just relocated)
- `gemini-batch-filter.ts` — per-batch Gemini call + response
  parsing/validation (pre-existing logic, relocated)
- `gemini-review-cache.ts` — the new cache read/write (new)
- `gemini.ts` — orchestration (`filterJobsWithGemini`,
  `generateApplicationStrategy`) — what's left after the above three moved
  out

`buildFeed()` (`dashboard-route.ts`) and the `/api/dashboard` route now
thread `userId`/`db` through to `filterJobsWithGemini`, since it needs a
Supabase client to read/write the new table.

**3. `FunnelView.tsx` "Settings filter" tooltip** — text-only fix, no
behavior change. Was: _"Removed jobs that failed seniority gate or disabled
pipelines."_ Now accurately describes what that stage covers post-PR#60:
seniority + excluded-keywords + blacklisted-locations + global-mode (all
DB-side) plus the required-keywords/skill-match precision recheck
(JS-side, deliberately kept there — see
`docs/solutions/features/2026-07-11-db-level-job-filtering.md` §2.3 for
why the boilerplate-window logic doesn't translate cleanly to SQL).

## Prevention

- **Any `language sql`/PL-pgSQL function with a CTE whose inputs are
  query-parameters only (never references a table column) needs an
  explicit check that it isn't being inlined and re-evaluated per row.**
  Postgres 12+'s default CTE inlining makes this silent — `EXPLAIN` on the
  function _call_ won't show it; the query body has to be pasted in and run
  directly, with real parameter values, to see the per-node breakdown.
  `MATERIALIZED` (or an equivalent optimization fence) is the fix whenever
  the CTE's cost is meant to be paid once.
- **Test at a realistic row count before merging, not just a handful of
  hand-picked rows.** The original plan doc for this migration
  (`docs/solutions/features/2026-07-11-db-level-job-filtering.md`)
  explicitly flagged "Task 1's `EXPLAIN ANALYZE`" as outstanding before
  production. It shipped without it. This is exactly the failure mode that
  flag existed to prevent.
- **`dashboard-route.test.ts`'s pre-existing "green" tests never exercised
  `fetchFilteredRawJobs`/the RPC call at all** — they test `buildFeed()`
  with jobs handed to it directly, so passing tests gave zero signal about
  the one thing that actually changed in PR #60. The new
  `gemini-review-cache.test.ts` was written specifically so the same gap
  doesn't recur for the caching logic — 9 tests directly exercising
  cache-hit, cache-miss, prompt-change invalidation, non-persistence of
  fail-open results, multi-batch batching, and cache-read-failure
  resilience, all against a mocked Supabase client, not just asserted.
- **Any external, metered API called in a loop from a cache-rebuild path
  should default to having both pacing between calls and a persistence
  layer for idempotent results**, not just the pacing or just the cache.
  This class of bug (redundant paid-API calls on every rebuild) can recur
  for any future integration that follows the same "call it in a loop
  every time the cache goes stale" shape without this pattern in mind.

## Verification

- Root cause #1: `EXPLAIN (analyze, buffers)` timings above, at 30k and
  200k synthetic rows, reproduced against the real schema and the
  account's real settings arrays. **Not yet confirmed against the actual
  production `raw_jobs` row count** — that number was never obtained
  during this session. Pending: confirm no further `57014` timeouts occur
  in Supabase's Postgres logs after this ships.
- Root cause #2: `pnpm test` — 462/462 passing project-wide, including 9
  new tests in `gemini-review-cache.test.ts`. `tsc --noEmit` and
  `next lint` both clean on every touched file (pre-existing warnings on
  untouched files unaffected). Both migrations applied cleanly to a real
  Postgres 16 instance, individually and in sequence. **Not yet confirmed
  against live Gemini quota behavior** — pending observation across a real
  cron cycle to confirm "Not AI-reviewed" jobs become rare instead of
  common.

## Related

`docs/solutions/features/2026-07-11-db-level-job-filtering.md` — the
original plan this PR implemented; §2.3 (why required-keywords/skill-match
precision stays in JS), §3.2 (the skill-match floor's deliberate
empty-array rejection), and the flagged-but-skipped Task 1 EXPLAIN ANALYZE
this incident is a direct consequence of.
