# Resolution: Job description truncation (Bug Fix Handoff — Job Description Truncation)

**Status: shipped in commit `6d2d68c` on `refactor/code-audit-and-enhancement`.**
This doc is the completion record for that commit — written after the fact
because `gemini.ts`'s updated comment referenced this file before it existed.
Original handoff brief is not committed to the repo (kept alongside `audit.md`
as planning input, same convention as `gemini-filter-audit.md`).

## The problem

Job descriptions were truncated at two points, and both ceilings were set
without looking at real data:

```
Real JD (could be 27,000+ chars)
    ↓ [1] Ingestion ceiling — ats-utils.ts processJobs()
Stored in raw_jobs (TEXT column)
    ↓ [2] Gemini window — gemini.ts filterBatch()
What Gemini actually sees
```

Bug 3 (`gemini-filter-audit.md`) had already raised these once — 3000 → 6000
(ingestion) and 1200 → 3000 (Gemini) — but that pass didn't check live data
either. Both numbers were still wrong.

## Architecture note (for context, not changed by this fix)

- Cron scrapes → `raw_jobs` (global table). No Gemini call here.
- Dashboard route (`GET /api/dashboard`) runs `passesSettingsGate` (free,
  regex, full stored description) → `filterBatch`/Gemini (user's own API
  key) → scores → caches → fires the new-job email.
- Gemini fails open. A quota/error doesn't drop jobs — they show with
  `gemini_reviewed: false`. Intentional, unchanged by this fix.
- Email fires from the dashboard route, already post-Gemini. Users who never
  open the dashboard never get emailed — a separate, out-of-scope product
  issue, not touched here.

## Step 1 — Remove the ingestion ceiling

`ats-utils.ts`'s `processJobs` stored `r.description.slice(0, 6000)`. Changed
to store the full description, uncapped — it's a `TEXT` column; there's no
storage-cost reason to cap it, and the old "shrink everything" policy was a
holdover from when ingestion also pre-filtered by skill match (it doesn't
anymore).

## What the real data showed

After removing the ceiling and letting one cron cycle run, the actual
`raw_jobs.description` length distribution:

| bucket    | jobs      | avg_chars | max_chars  |
| --------- | --------- | --------- | ---------- |
| < 1k      | 40        | 506       | 698        |
| 1k–2k     | 4         | 1,538     | 1,807      |
| 2k–3k     | 62        | 2,795     | 2,999      |
| 3k–4k     | 728       | 3,358     | 3,996      |
| 4k–5k     | 545       | 4,479     | 4,999      |
| 5k–6k     | 596       | 5,516     | 5,999      |
| 6k–8k     | 1120      | 6,925     | 7,994      |
| 8k–10k    | 588       | 8,858     | 9,998      |
| 10k–15k   | 332       | 11,384    | 14,952     |
| 15k–20k   | 29        | 16,430    | 19,825     |
| 20k+      | 2         | 24,261    | 27,707     |
| **Total** | **4,046** |           | **27,707** |

Coverage at different Gemini windows:

- 6,000 chars → 48.8% of jobs fully covered (the old ceiling was cutting the
  majority)
- 8,000 chars → 76.5%
- 10,000 chars → **91%** ← chosen
- 15,000 chars → 99.2%

## Decisions (locked)

| Decision                                   | Chosen            | Rationale                                                                                                                                                  |
| ------------------------------------------ | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Storage ceiling                            | Remove entirely   | `TEXT` column, no upside to any ceiling                                                                                                                    |
| Gemini chars/job                           | 10,000            | Covers 91%, data-driven; going to 15k buys only 8.2% more for a disproportionate token-cost increase                                                       |
| Batch size                                 | 15 (down from 30) | Proportional to the larger per-job window — keeps prompt size from scaling unchecked                                                                       |
| Disqualifier regex in `passesSettingsGate` | Rejected          | "No visa sponsorship / US only" are not universal disqualifiers — a US citizen wants those jobs. Belongs in per-user excluded keywords, not a shared gate. |
| Gemini 429 indicator                       | Yes               | Distinguish quota exhaustion from other fail-open cases with a specific badge, not the generic "not AI-reviewed" one                                       |

## Steps 2 & 3 — what was implemented

Both landed together in `6d2d68c` (the handoff brief had asked for them as
separate steps with their own validation passes; in practice they were
implemented and validated as one commit — logged as a process finding in
`audit.md`, not re-litigated here).

**`gemini.ts`:**

- `BATCH_SIZE`: 30 → 15.
- Gemini-call description window: 3000 → 10,000 chars.
- New `isQuotaError(msg)` helper (shared between `filterBatch`'s tracking and
  `generateApplicationStrategy`'s existing retry logic, which had its own
  inline copy of the same check).
- New `GeminiQuotaExhaustedError`, thrown by `callGemini` only when every
  model in `MODEL_QUEUE` failed and every one of those failures was
  specifically a quota/rate-limit error (not a network error, bad response,
  or other transient failure).
- `FilterResult` and `filterJobsWithGemini`'s return type both gained
  `quotaExhausted?: boolean` / `gemini_quota_exhausted: boolean`, set `true`
  only on that specific fail-open path.

**`types.ts` / `scoring.ts`:**

- `ScoredJob.gemini_quota_exhausted?: boolean` (optional — most call sites
  never hit this path).
- `scoreJob` gained a 6th param, `geminiQuotaExhausted = false`, threaded
  straight onto the returned job. Does not affect `total_score` — Gemini
  review status was never part of the score calculation (it's a pure
  skill/recency/relocation formula); this is purely a display signal.

**`JobCard.tsx` / `job/[id]/page.tsx`:**

- Badge logic now branches: quota-exhausted gets its own
  "⚠ Gemini quota exhausted" badge; any other not-reviewed case keeps the
  existing "⚠ Not AI-reviewed" badge (dropped the "(showing anyway)" suffix
  for brevity, behavior unchanged).

**`dashboard/route.ts`:**

- Threads `gemini_quota_exhausted` through the no-key fallback shape and the
  `scoreJob` call.

## Validation

- `tsc --noEmit` clean
- `eslint` clean
- vitest: 77/77 (added coverage in `gemini.test.ts` for the quota-exhausted
  detection — full quota failure vs. mixed quota/non-quota failure — and in
  `scoring.test.ts` for the new param threading)
- `next build` successful, all 30 routes

## Things ruled out (don't re-debate)

- Moving Gemini to the cron — cron doesn't own user API keys; timeout risk,
  settings staleness, rate-limit management across N users.
- Hardcoded disqualifier regex in `passesSettingsGate` — wrong, not
  universal (see decisions table).
- Raising the storage ceiling to another arbitrary number instead of
  removing it — pointless on a `TEXT` column.
- Sleep-based global rate limiting across users in cron — defeats
  parallelism, doesn't map to real quota boundaries.
- HEAD+TAIL split for the Gemini window — considered, deferred. The 10k
  window covers 91% of jobs completely, making the split unnecessary for
  now. Revisit only if a future cron cycle's data shows systematic misses
  still occurring past the 10k mark.

## Not yet done (deliberately out of scope here)

- **Detail-page rendering** (`job/[id]/page.tsx`) was never confirmed
  truncation-free independent of the above — the original handoff doc
  flagged this as "likely fine, not formally confirmed." Still unconfirmed.
  Low priority; address opportunistically, not blocking.
- A regression test asserting a disqualifying signal at position >3000 (or
  > 10,000) in a long description isn't silently dropped — the original
  > audit's acceptance criteria asked for this; not added in `6d2d68c`. The
  > "no hardcoded disqualifier regex" decision above made this less urgent
  > (there's no longer a position-dependent disqualifier check to regress),
  > but the broader principle — late-JD content reaching the gates it's
  > supposed to reach — isn't covered by an explicit test yet.
