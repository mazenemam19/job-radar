# Plan: Gemini index-based matching (Bug 1, gemini-filter-audit.md)

**Scope:** Small-medium, well-understood. 5 files, no DB migration needed yet
(single user today; architecture must not require one when a second user
with a custom prompt shows up).

## Problem

`filterBatch` in `src/lib/gemini.ts` asks Gemini to echo back each job's
full composite ID string (`visa_gh_vercel_4827193`) in its JSON response,
then matches on that string. Any echo mismatch — dropped char, reorder,
truncation — silently fails open to `{ pass: true, reason: null }` with no
log, no error. 18/19 jobs in a real run hit this path. The response-format
instructions (`{"id": "<job_id>", ...}`) also currently live inside
`gemini_filter_prompt`, which is user-editable — so the JSON contract isn't
owned by code, it's owned by whatever text happens to be sitting in
`default_settings`/`user_settings`.

## Decision

Switch to index-based matching (each job's position in its batch, not its
DB id) and move the JSON-contract instructions out of the user-editable
prompt entirely. The wrapper is appended in code, at call time. The
user-editable text becomes pure evaluation criteria — it can never again
break the response contract, for this user or any future one.

## Tasks

### 1. `src/lib/gemini.ts`

- `GeminiDecision`: `{ idx: number; pass: boolean; reason: string }` (was `id: string`).
- New const `RESPONSE_FORMAT_INSTRUCTIONS` — fixed, code-owned, not stored anywhere user-editable. Tells Gemini to return `{"idx": <number>, "pass": bool, "reason": "..."}` keyed to the index given per job.
- `filterBatch`: job summaries get `idx: i` (position in batch) instead of `id: j.id`. Prompt = `criteria + RESPONSE_FORMAT_INSTRUCTIONS + job list`.
- Parsing: validate each returned `idx` is an integer in `[0, batch.length)` and not a duplicate. Reject/log (don't crash) on anything else. Map `idx → batch[idx].id` to build `resultMap` keyed by job id (no change to the function's external contract — callers still look up by job id).
- Any `idx` never returned by Gemini, or invalid → `console.error` with the raw response text attached (this was previously silent). Still fails open (`pass: true, reason: null`) — fail-open behavior is intentional per the existing design, only the silence is the bug.
- Total batch failure path (`gemini-unavailable`) — unchanged.

### 2. `src/lib/settings.ts`

- `FALLBACK_PROMPT` → strip the `Return a JSON array where each element is...` sentence entirely. Becomes pure criteria text. No other change — same field name, same plumbing, same fallback chain.

### 3. `src/components/settings/SettingsForm.tsx`

- Section label "Gemini filter prompt" → "Gemini evaluation criteria", short helper text noting the response format is handled automatically. Copy-only, no logic change.

### 4. `src/lib/__tests__/gemini.test.ts` (new)

Mock the `@google/genai` SDK call. Cover:

- Complete response (all idx present) → correct pass/reason per job.
- Partial response (some idx missing) → those jobs default to pass/null AND trigger a `console.error`.
- Out-of-range or duplicate idx → logged, ignored, no crash.
- Thrown SDK error → `gemini-unavailable` fallback (existing behavior, regression-guard it).
- Malformed/non-JSON response → empty decisions, no crash.

### 5. `ARCHITECTURE.md`

Update the "Gemini gate" paragraph (~line 317) to describe index-based matching instead of implying the ID round-trip is reliable.

## Manual step required outside this codebase (cannot be done from this sandbox — no DB access)

The live `default_settings.gemini_filter_prompt` row in Supabase almost
certainly still contains the _old_ full prompt text, including the
`Return a JSON array... "id"...` sentence — that's a stored value, not the
`FALLBACK_PROMPT` code constant, and code changes don't touch it. If left
as-is, the final prompt sent to Gemini after this fix would contain BOTH
the old `"id"` instruction (from the stored row) and the new `"idx"`
instruction (appended by code) — a direct contradiction, not a fix.

Action: inspect and clean the stored row before/right after deploying this fix:

```sql
select gemini_filter_prompt from default_settings where id = 1;
-- if it contains the old "Return a JSON array..." sentence, replace it with
-- pure criteria text only, e.g. the new FALLBACK_PROMPT content.
update default_settings set gemini_filter_prompt =
  'You are a job filter for a Senior React/Next.js engineer. Evaluate each job listing on whether it''s a genuine fit based on seniority, tech stack, and role type.'
where id = 1;
```

Also check your own `user_settings` row in case `uses_defaults = false` with a stored override there too.

## Acceptance criteria

- `tsc --noEmit` clean, `eslint --fix` clean, all vitest passing (new + existing), `next build` successful.
- A run against a real batch shows `gemini_reason` populated with real, distinct reasons instead of `null` for jobs Gemini actually evaluated.
