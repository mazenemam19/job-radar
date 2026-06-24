# Plan: Optional Gemini key at onboarding (Feature Request 2, gemini-filter-audit.md)

**Approved**, with one explicit modification from the original brief:
onboarding becomes **one screen instead of two** (the original brief's
"current 2-step flow" framing is now moot — the key being optional removes
the reason to gate Step 2 behind Step 1 at all).

**Scope:** Medium. Touches the dashboard route's hard-block logic and a
full rewrite of the onboarding component. No DB schema change — both
`gemini_api_key` and `uses_defaults`/`onboarding_complete` already save via
a single `PATCH /api/settings` call (confirmed in `settings/route.ts`).

## The inconsistency being fixed

Today: no key → hard 422, dashboard never loads. Key present but
invalid/rate-limited/exhausted → Gemini fails open silently, user sees
everything. The strictest outcome is reserved for the most-correct user
behavior (no key, because they haven't gotten one yet); the most lenient
outcome happens on the path where something's actually wrong. Feature
Request 1's `gemini_reviewed` indicator now gives every job an honest,
visible answer to "was this AI-reviewed?" regardless of key presence —
which removes the only reason the hard block existed.

## Decision

- Missing key → skip Gemini entirely (don't call `filterJobsWithGemini`).
  Jobs that pass the settings gate go straight to scoring, marked
  `gemini_pass: true, gemini_reason: null, gemini_reviewed: false` — same
  shape Bug 1's fail-open path already produces, so Feature Request 1's
  badge ("⚠ Not AI-reviewed (showing anyway)") shows up for free, no new
  UI logic needed.
- Present key → unchanged: run Gemini as today, with Bug 1's fixed
  matching and Bug 2's fixed pre-filter.
- Onboarding becomes a single screen: an optional Gemini-key field at the
  top (skippable — leave blank and continue), with the existing
  defaults-vs-customize choice immediately below it, also on that same
  screen. Each of the two choice buttons now does both jobs in one
  submit: save the key if one was entered, set `uses_defaults` to match
  the button pressed, and mark `onboarding_complete: true` — all in the
  single existing `PATCH /api/settings` call. No new step, no progress
  bar needed since there's only one screen.

## Tasks

### 1. `src/app/api/dashboard/route.ts`

- Remove the `if (!profile?.gemini_api_key) return 422 ...` hard block.
- Branch step 4: if `profile?.gemini_api_key` is present, call
  `filterJobsWithGemini` as today. If absent, build the same return shape
  directly from `afterSettingsFilter` — each job spread with
  `gemini_pass: true, gemini_reason: null, gemini_reviewed: false` — so
  step 5 (scoring) runs unchanged either way.

### 2. `src/components/onboarding/OnboardingFlow.tsx`

- Full rewrite: drop the `Step` state machine and progress-bar markup
  entirely (no longer a multi-step flow).
- Single screen: optional Gemini key input (label no longer marked
  required; helper copy explains that without a key, jobs are shown
  settings-filtered only, with the "not AI-reviewed" badge, and a key can
  always be added later in Settings), key-format validation only runs if
  a non-empty key is entered, then the two existing defaults/customize
  choice buttons immediately below — each calling one combined submit
  function that saves whatever key (if any) + the chosen `uses_defaults`
  value + `onboarding_complete: true` in a single `PATCH /api/settings`
  call, then routes to `/dashboard` or `/settings` respectively (same
  destinations as today).

### 3. Tests

No existing test file covers `OnboardingFlow.tsx` or the dashboard route's
key-branching logic directly (checked — `dashboard/route.ts` has no
dedicated test file, consistent with the rest of the API route layer in
this codebase, which is validated via `next build` + manual/integration
testing rather than route-level unit tests). Not introducing a new test
pattern as a side effect of this change; `tsc --noEmit` + `eslint` +
`next build` are the validation gates, consistent with how this codebase
already treats its route handlers and components.

## Acceptance criteria

- `tsc --noEmit` clean, `eslint --fix` clean, all vitest passing, `next build`
  successful.
- A user with no Gemini key reaches `/dashboard` and sees settings-filtered
  jobs, each marked `gemini_reviewed: false` (visible via Feature Request
  1's badge).
- A user with a valid key sees the same behavior as before this change.
- Onboarding is a single screen: key field (optional) + the two
  defaults/customize choices, no second step.
