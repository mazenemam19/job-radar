# Plan: BambooHR detail fetch for descriptions (Bug 4, gemini-filter-audit.md)

**Scope:** Small, isolated. 2 files (1 source + its type definitions),
narrow blast radius (only BambooHR-hosted companies).

## Verification (done, outside this codebase)

Confirmed the live shape of both BambooHR endpoints against a real company
(`instabug.bamboohr.com`):

- List endpoint (`/careers/list`) — already used by `fetchBambooHR` —
  confirmed to return only `{ result: [{ id, jobOpeningName, departmentId,
... }] }`, no description field. Matches existing code's assumption.
- Detail endpoint (`/careers/{id}/detail`) — confirmed shape:
  `{ result: { jobOpening: { description: "<p>...</p>", ... } } }`. The
  description is real HTML, same as every other ATS's detail/list response
  (`stripHtml` applies cleanly).

This confirms the fix direction in the original brief without guessing: add
a per-job detail fetch mirroring `fetchWorkable`'s existing pattern.

## Tasks

### 1. `src/types/api.ts`

- New `BambooDetail` interface for the confirmed detail-endpoint shape:
  `{ result?: { jobOpening?: { description?: string } } }`. Minimal — only
  the field this fetcher actually reads.

### 2. `src/lib/sources/ats-utils.ts`

- `fetchBambooHR`: after fetching the list, run a `pLimit`-bounded
  (concurrency 5, same as `fetchWorkable`) detail fetch per job:
  - `GET https://${c.slug}.bamboohr.com/careers/${r.id}/detail` via the
    existing `safeFetch` helper (consistent with this fetcher's list call;
    `fetchWorkable` uses a raw `fetch` instead, but there's no reason to
    diverge from `safeFetch` here — same timeout/User-Agent handling).
  - On success, `description: stripHtml(detail.result?.jobOpening?.description ?? "")`.
  - On any failure (network, non-OK, parse error), fall back to `""` —
    same fail-open shape as the rest of this fetcher and as
    `fetchWorkable`'s detail-fetch failure path. A BambooHR detail-fetch
    hiccup degrades a job back to today's "no description" state rather
    than breaking the whole fetch run.
- Not in scope (deliberately): the per-run `console.log` progress line that
  currently exists only in `fetchWorkable`. That's a separate, already-
  tracked cleanup item (Phase 7 in the full codebase audit) about deciding
  whether to add it everywhere or remove it — not something to half-decide
  as a side effect of this fix.

### 3. Tests

No existing test file mocks `fetch`/`safeFetch` for any of the 9 ATS
fetchers — `ats-bridge.test.ts` only tests the dispatch layer, with
`fetchBambooHR` itself mocked out entirely. That's a pre-existing gap
across all fetchers, not specific to BambooHR, and unlike Bug 1 (which
explicitly called for a new `gemini.test.ts`), the original brief doesn't
mandate new tests for this fix. Standing up a `fetch`-mocking convention
from scratch is a separate, broader decision (it'd set the pattern for all
9 fetchers) and out of scope for this narrow, low-risk fix. `tsc --noEmit`

- `eslint` + `next build` are the validation gates here, same as the
  project's other "no behavior risk" changes.

## Acceptance criteria

- `tsc --noEmit` clean, `eslint --fix` clean, all vitest passing, `next build`
  successful.
- BambooHR jobs now carry a real description, so `passesSettingsGate`'s
  required-keywords/skill-match steps (and Gemini) have real content to
  evaluate instead of title-only text.
- A failed detail fetch degrades gracefully to today's behavior (empty
  description), not a dropped job or an unhandled exception.
