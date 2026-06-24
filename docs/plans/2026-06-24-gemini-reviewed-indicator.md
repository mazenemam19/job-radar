# Plan: "Was this job actually AI-reviewed?" indicator (Feature Request 1, gemini-filter-audit.md)

**Scope:** Small, well-understood. 6 files, no DB migration (the field lives
inside the existing `jobs` JSONB column in `user_jobs_cache`, same as every
other `ScoredJob` field — no schema change needed).

## Problem

Bug 1's fix made the "Gemini didn't return a decision for this job" case
loud (a `console.error`) instead of silent, but it's still invisible to the
user. A job that fails open because Gemini's response was incomplete, or
because the whole call failed, looks identical in the UI to a job Gemini
genuinely evaluated and passed. There is currently no way for a user looking
at the dashboard to tell "Gemini actually looked at this and liked it" apart
from "Gemini's call had a problem and this slipped through by default."

## Decision

Add a new boolean, `gemini_reviewed`, alongside the existing
`gemini_pass`/`gemini_reason` fields — additive, not a replacement. `true`
only when Gemini returned a valid, matched decision for that job's index.
`false` for both fail-open paths (missing idx in an otherwise-successful
response, and total batch failure / `gemini-unavailable`). Surface it as a
small "⚠ Not AI-reviewed (showing anyway)" badge on the dashboard card and
job detail page when `false`; no visible change when `true` (the existing
"Gemini: <reason>" line already implies a real review).

## Tasks

### 1. `src/lib/gemini.ts`

- `FilterResult` interface: add `reviewed: boolean`.
- In `filterBatch`'s decision loop (where `resultMap.set(job.id, {...})` runs
  for a valid, matched idx): set `reviewed: true`.
- In the catch block (`gemini-unavailable` fail-open): set `reviewed: false`.
- In the final "any job not in Gemini's response" fail-open loop: set
  `reviewed: false`.
- `filterJobsWithGemini`'s return type: add `gemini_reviewed: boolean` to the
  returned object shape; read it off `d.reviewed` (default `false` if `d` is
  somehow undefined, but `filterBatch` always populates every job now so this
  is just a type-safety fallback, not a new behavior path).

### 2. `src/lib/types.ts`

- `ScoredJob`: add `gemini_reviewed: boolean` next to `gemini_pass`/`gemini_reason`.

### 3. `src/lib/scoring.ts`

- `scoreJob(job, settings, geminiPass = false, geminiReason = null, geminiReviewed = false)`
  — new 5th param, defaulted so every existing call site without it still
  compiles and behaves the same (default `false` matches "no real Gemini
  review happened," which is correct for the no-arg case used in tests).
- Include `gemini_reviewed: geminiReviewed` in the returned object.

### 4. `src/app/api/dashboard/route.ts`

- Line ~131: `scoreJob(job, settings, job.gemini_pass, job.gemini_reason, job.gemini_reviewed)`.

### 5. `src/components/dashboard/JobCard.tsx`

- In the tags row (next to the mode/visa-sponsorship badges) or directly
  above the Gemini-reason line in the expanded section: when
  `!job.gemini_reviewed`, render a small badge —
  `⚠ Not AI-reviewed (showing anyway)` — styled consistently with the
  existing tag badges (same `rounded-full px-2 py-0.5 text-[11px]` pattern,
  amber/warning tone to match the existing bonus-skill amber). When
  `job.gemini_reviewed` is `true`, no change — existing "Gemini: reason" line
  in the expanded section is unchanged and sufficient.

### 6. `src/app/job/[id]/page.tsx`

- Same badge, same condition, placed near the existing
  `{job.gemini_reason && (...)}` block (~line 211): show the not-reviewed
  badge when `!job.gemini_reviewed`, regardless of whether `gemini_reason`
  happens to be set (reason is `null` in both fail-open paths today, but the
  badge's condition is `gemini_reviewed`, not `reason`, to stay correct if
  that ever changes).

### 7. Tests

- `src/lib/__tests__/gemini.test.ts` — extend existing cases (no new
  describe block needed, this is additive to what's already covered):
  - "maps complete responses..." → assert `gemini_reviewed === true` for the
    matched job.
  - "fails open and logs loudly when some idx are missing" → assert
    `gemini_reviewed === false` for job "b" (the missing one).
  - "falls back to gemini-unavailable" → assert `gemini_reviewed === false`.
  - "handles malformed/non-JSON responses" → assert `gemini_reviewed === false`.
- `src/lib/__tests__/scoring.test.ts` — extend the existing
  "passes gemini_pass and gemini_reason through" test (or add one beside it)
  to also assert `gemini_reviewed` passes through, and that it defaults to
  `false` when omitted (covers the dashboard's existing un-migrated cache
  rows / any call site that doesn't pass it).

## Acceptance criteria

- `tsc --noEmit` clean, `eslint --fix` clean, all vitest passing (updated +
  existing), `next build` successful.
- A job whose Gemini decision was genuinely matched shows no new UI change.
- A job that fails open (missing idx or batch failure) shows the
  "⚠ Not AI-reviewed (showing anyway)" badge on both the dashboard card and
  the job detail page.
