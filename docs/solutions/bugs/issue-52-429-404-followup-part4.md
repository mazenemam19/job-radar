---
date: 2026-07-07
category: bugs
tags:
  [
    ats,
    safefetchjson,
    teamtailor,
    workable,
    ashby,
    greenhouse,
    lever,
    smartrecruiters,
    bamboohr,
    submit-form,
  ]
files:
  [
    src/lib/sources/ats/http.ts,
    src/lib/sources/ats/teamtailor.ts,
    src/lib/sources/ats/ashby.ts,
    src/lib/sources/ats/greenhouse.ts,
    src/lib/sources/ats/lever.ts,
    src/lib/sources/ats/smart-recruiters.ts,
    src/lib/sources/ats/bamboohr.ts,
    src/lib/sources/ats/workable.ts,
    src/lib/constants.ts,
    src/app/submit/page.tsx,
    src/lib/__tests__/teamtailor-shape-guard.test.ts,
    src/lib/__tests__/ats-utils-tracking.test.ts,
    src/lib/__tests__/workable-detail-warnings.test.ts,
    src/lib/__tests__/workable-rate-limit.test.ts,
  ]
---

# Issue #52, 429/404 follow-up — part 4: closing priorities 1 and 2

Closes items 1 and 2 from part 3's remaining-work list: the rest of the
`safeFetchJson` rollout, and the `ATS_TYPES` extraction.

## Priority 1 — `safeFetchJson` rollout, remaining 7 fetchers

### `http.ts`: split `safeFetchJson` into `parseJsonBody` + a thin wrapper

`workable.ts` doesn't call `safeFetch` — it has its own queued/retried
`fetchWorkableUrl`, so it already has a `Response | null` by the time it
needs JSON-safety. Duplicating `safeFetchJson`'s body/content-type logic
inside `workable.ts` would drift from `http.ts`'s copy over time. Split
instead: `parseJsonBody(res: Response | null)` holds all the logic
(null check, status check, content-type check, parse), `safeFetchJson`
is now just `safeFetch` + `parseJsonBody`. No behavior change for any
existing caller — same three failure strings, same happy path.

### `teamtailor.ts` — migrated, plus a shape guard

Migrated to `safeFetchJson`. Additionally added an explicit
`Array.isArray(result.data.data)` guard before touching `.length`/`.map`.

This part matters: `safeFetchJson` only confirms the body parsed as JSON —
it says nothing about whether the parsed value has the shape the caller
expects. Yodo1's board (part 3) returned HTTP 200, valid JSON, content-type
`application/json`, and no `data` field. A blind `safeFetchJson` swap
would have "fixed" this by moving the exact same `TypeError: Cannot read
properties of undefined (reading 'length')` from an inner try/catch
(→ `Parse Error: TypeError...`) to `ats-bridge.ts`'s outer catch (→ same
message, no `Parse Error:` prefix) — a different string, not a different
outcome. The guard makes it an actual, named, non-crashing result:
`Unexpected response shape: missing \`data\` array`.

New test: `teamtailor-shape-guard.test.ts` — one case reproducing Yodo1's
exact response (valid JSON, no `data` field) asserting the clean error, one
happy-path case with a proper `data` array. This is the only fetcher change
in this rollout with a dedicated new test, because it's the only one with
new _logic_ — the other six are a mechanical pattern swap.

### `ashby.ts`, `greenhouse.ts`, `lever.ts`, `smart-recruiters.ts`, `bamboohr.ts` — migrated, list-call only where a detail-fetch exists

Straight `safeFetchJson` swap, each fetcher's existing null-safety
preserved exactly (`ashby.ts`'s `data.jobs || data.jobPostings || []`,
`bamboohr.ts`'s `data.result ?? []`).

**No shape guard added to `greenhouse.ts`, `lever.ts`, or
`smart-recruiters.ts`**, even though all three have the identical
no-fallback pattern teamtailor had (`const { jobs } = ... as {jobs: T[]}`,
`(await res.json()) as T[]` with no shape check, `const { content } = ...`).
This is a deliberate scope decision, not an oversight: teamtailor's guard
exists because Yodo1 proved it live. No board has shown this failure for
these three. Adding a guard on spec, with nothing to verify it against, is
unfalsifiable — flagged in each file's source as a comment instead, per
this project's own established pattern (see part 3's "Process gaps"
section) of flagging real-but-unevidenced issues rather than bundling
speculative fixes into an unrelated change.

**`bamboohr.ts`'s and `smart-recruiters.ts`'s per-job detail-fetch loops
are untouched**, same carve-out part 3 already gave `workable.ts`'s detail
path: `bamboohr.ts`'s already falls back to an empty description on any
bad response (own inline try/catch); `smart-recruiters.ts`'s already
returns `null` on any bad response, filtering the job out entirely. Neither
crashes today, so neither is the failure class this rollout targets.

One new thing worth naming, though: `smart-recruiters.ts`'s "silently drop
the job" behavior is a _worse_ degradation than `bamboohr.ts`'s or
`workable.ts`'s "fall back to a shorter description" — a job just vanishes
from results with no visibility, similar in spirit to the dead-link problem
`362bdd8` fixed for `workable.ts` specifically. Real, pre-existing, not
touched here — added to part 3's remaining-work list (item 8) rather than
silently left findable only in a code comment.

### `workable.ts` — list-call only

List-call swapped to call `parseJsonBody` directly on `fetchWorkableUrl`'s
`Response`. Detail-fetch path (`resolveJobDescription`) is completely
unchanged — part 3 already carved this out, and re-confirmed here: it
already degrades gracefully, so migrating it doesn't fix anything, and
`parseJsonBody`'s stricter content-type check would only make an existing
graceful-fallback outcome arrive by a longer path.

Three existing tests' mocks (`workable-detail-warnings.test.ts`,
`workable-rate-limit.test.ts`) had list-response mocks with no
`content-type` header and (in one file) only a `.json()` method, not
`.text()` — both are things the old `res.ok` + `res.json()` pattern never
cared about, but `parseJsonBody` does. Updated the shared
`mockListResponse` helper in both files to set
`content-type: application/json` and provide `.text()` instead of `.json()`
for the list mock — this is the mock catching up to what a real successful
JSON response looks like, not a weakened test. Same fix applied to
`ats-utils-tracking.test.ts`'s teamtailor mock, which had the same gap.

### What this rollout does _not_ cover

Live per-company verification (`pnpm cron:log` against each ATS's real
board) — the thing part 3's validation run actually did for the three
commits it covered. Not possible from this session's sandbox: no network
route to any of these ATS hosts, no Supabase credentials, and this repo
has no dry-run mode — a real run writes production data and emails real
users (part 3's "known limitation" note). Verified instead with
`tsc --noEmit`, `eslint`, and the full `vitest` suite (all green, 379/379,
2 new), plus the dedicated shape-guard test proving Yodo1's specific
failure is now handled. Live verification per company is still open —
someone with real access needs to run it.

## Priority 2 — `ATS_TYPES` extraction

Moved from an inline array in `src/app/submit/page.tsx` into
`src/lib/constants.ts`, next to the existing `VALID_ATS`. No new file —
this repo already has a shared constants file with the same domain's other
constant (`VALID_ATS`), so the extraction target already existed. Pure
relocation, zero behavior change; `tsc`/`eslint`/full suite all confirm
this independently of the commit message.

## Verification summary

- `tsc --noEmit`: clean.
- `eslint` on every touched file: clean.
- `vitest run src/lib/__tests__`: 38 files, 379 tests, all passing
  (377 pre-existing + 2 new in `teamtailor-shape-guard.test.ts`).
- Full diff: 13 files modified, 1 new test file. No `.ts`/`.tsx` file
  outside `src/lib/sources/ats/`, `src/lib/constants.ts`,
  `src/app/submit/page.tsx`, and test files touched.

## Remaining / open work, updated

See part 3's remaining-work list, items 3–7 (unchanged, still open) plus
new item 8 (shape-guard gap in 3 fetchers + smart-recruiters silent-drop,
both flagged not fixed — see above).
