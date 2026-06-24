# Plan: Deliberate truncation limits (Bug 3, gemini-filter-audit.md)

**Scope:** Tiny. 2 one-line changes, each a constant.

## Verification (done, outside this codebase)

Ran the recommended query against live `raw_jobs`:

```sql
select length(description) from raw_jobs order by length(description) desc limit 20;
```

Result: **all 20 of the longest descriptions are exactly 3000 characters**
— i.e. every one of them hit the ingestion ceiling and was cut off, not
coincidentally landing at exactly 3000. This confirms the truncation is
actively biting in practice, not just a theoretical concern.

## Decision

Raise both limits, deliberately, with the two now chosen to relate to each
other instead of having independently evolved:

- **Ingestion ceiling** (`ats-utils.ts` `processJobs`): **3000 → 6000
  characters.** This is the absolute ceiling on what's ever stored in
  `raw_jobs` and what the settings-gate (`passesSettingsGate`, including
  Bug 2's fix) searches against. Doubling it costs effectively nothing —
  it's a `TEXT` column, not an LLM call — and gives real long-form JDs
  (intro → responsibilities → requirements → benefits → EEO, often
  3000–5000+ characters per the original brief's own estimate) enough room
  for the requirements section to actually be stored, rather than reliably
  truncated away.
- **Gemini-call truncation** (`gemini.ts` `filterBatch`): **1200 → 3000
  characters.** This now exactly matches the _old_ ingestion ceiling, so
  Gemini at minimum sees everything that used to be the entire stored
  description. It does not match the _new_ 6000-char ingestion ceiling —
  that's a deliberate, accepted tradeoff: `BATCH_SIZE` is 30 jobs per
  Gemini call, so this is a 2.5x increase in prompt size per call (1200→3000
  chars × 30 jobs), already a meaningful added token/cost burden. Matching
  the full 6000-char ceiling would mean 5x the description tokens per call
  versus today. 3000 is chosen as the number explicitly suggested as a
  reasonable middle ground in the original brief ("maybe 2500–3000, to at
  least match what's actually stored" — referring to the old 3000 ceiling),
  while the _settings gate_ (cheap, no API cost) gets the full benefit of
  the larger 6000-char ingestion window.

**Why not match them exactly:** the settings gate's cost is effectively
free (a few extra regex scans over already-fetched text); Gemini's cost
scales directly with tokens sent. It's reasonable for the free pre-filter
to see more text than the paid filter, especially since Bug 1's idx-based
matching and Bug 2's boilerplate-aware matching already make the cheap
pre-filter meaningfully more accurate on its own.

## Tasks

### 1. `src/lib/sources/ats-utils.ts`

- `processJobs`: `description: r.description.slice(0, 3000)` →
  `description: r.description.slice(0, 6000)`, with the reasoning above
  added as a comment.

### 2. `src/lib/gemini.ts`

- `filterBatch`: `description: j.description.slice(0, 1200)` →
  `description: j.description.slice(0, 3000)`, with a comment noting this
  is deliberately less than the 6000-char ingestion ceiling — see
  `processJobs`'s comment for the cost/accuracy tradeoff.

## Acceptance criteria

- `tsc --noEmit` clean, `eslint --fix` clean, all vitest passing, `next build`
  successful.
- No test currently asserts on these exact numeric limits (checked); none
  expected to break.
- Both limits are now deliberate, cross-referenced choices instead of two
  independently-evolved magic numbers.
