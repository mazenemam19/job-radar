# Plan: Boilerplate-aware keyword/skill matching (Bug 2, gemini-filter-audit.md)

**Scope:** Small, well-understood. 2 files (1 source + its test file).

## Verification (done, outside this codebase)

Ran the recommended SQL against live `raw_jobs` for the 6 non-engineering
Vercel postings (Account Executive, Manager Commercial Sales, Partner
Operations Lead, People Operations Analyst, Senior HRBP, Senior Partner
Manager AWS) plus the 1 real engineering posting (Software Engineer, eve).

**Confirmed:** every single one of the 7 postings opens with an identical
`<div class="content-intro">About Vercel: ... As the team behind Next.js,
v0, and AI SDK...</div>` paragraph. Stripped to plain text this is ~788
characters, and "Next.js" sits at character index ~190 — comfortably inside
any reasonable "intro" window. For the 6 non-engineering roles, that's the
_only_ place "next.js"/"react" appears anywhere in the 3000-char stored
description — there is no second, role-specific mention. For the real
engineering role, "Next.js" is mentioned a second time inside the actual
"About the role" section, well past the intro.

This confirms the working hypothesis exactly: the required-keywords and
skill-match gates are matching company boilerplate, not job requirements,
for every non-engineering role at a company whose own product happens to be
in the user's stack.

## Decision

Implement Option B from the original brief: require a keyword/skill match
that occurs **after** a boilerplate-prone opening window, **or** two or
more distinct keywords/skills matched anywhere (breadth). Short texts (at
or under the window size) are exempt from the position check entirely —
there's no room for a real "intro vs. body" split, so a single early match
is trusted exactly as before (this keeps every existing short-fixture test
passing unchanged).

**Window size: 600 characters.** The confirmed Vercel intro is ~788 chars
with its only match at ~190 — well inside 600. The original brief suggested
300–500; 600 is chosen with a little extra margin since real "About
[Company]" paragraphs run longer than the shortest case, and the cost of a
too-small window (missing a genuine intro) is worse than the cost of a
too-large one (a few extra characters of real requirements text rarely
contain the _only_ keyword mention for an actually-relevant role).

**Known limitation, accepted deliberately:** a posting structured with no
"About us" intro at all, where the single real requirement happens to
sit within the first 600 characters, will now fail this gate unless a
second distinct keyword/skill also matches. This is the misfire risk Option
A/B always carried (see the original brief). It's accepted because: (a)
Bug 1 already restored Gemini as a real downstream judgment, so a
boundary-case false reject at this pre-filter stage isn't necessarily a
fully lost job — it just means this particular pre-filter, which the brief
itself frames as "a cheap, deliberately loose recall-favoring pre-filter,"
is now slightly less loose in one specific, previously-broken way. Revisit
if real-world false negatives turn up.

## Tasks

### 1. `src/lib/scoring.ts`

- New module constant `BOILERPLATE_WINDOW_CHARS = 600` near the top, with
  the reasoning above in a comment.
- New private helper `wordBoundaryPattern(word: string): string` — factors
  out the existing `escaped = word.replace(...).replace(...)` logic shared
  by the keyword-matching call sites (kept local to this concern; the
  pre-existing `excluded_keywords`/`blacklisted_locations` inline logic in
  `passesSettingsGate` is untouched — not in scope for this bug).
- New exported function `hasMeaningfulKeywordMatch(text: string, keywords: string[]): boolean`:
  - If `text.length <= BOILERPLATE_WINDOW_CHARS`: return true if any
    keyword matches anywhere (old behavior, unchanged).
  - Else: scan each keyword globally for every occurrence index. A keyword
    "counts" if it has at least one occurrence. Track (a) whether _any_
    occurrence of _any_ keyword falls at index `>= BOILERPLATE_WINDOW_CHARS`,
    and (b) how many distinct keywords matched at all. Return
    `matchOutsideWindow || distinctMatchCount >= 2`.
- `passesSettingsGate`, step 3 (required keywords): replace the
  `techKeywords.some(...)` single-match check with
  `hasMeaningfulKeywordMatch(textCombined, techKeywords)`.
- `passesSettingsGate`, step 5 (skill match): replace the
  `expertMatched.length === 0 && secondaryMatched.length === 0` check with
  `!hasMeaningfulKeywordMatch(job.description, [...settings.expert_skills, ...settings.secondary_skills])`
  for the early-return-false condition. (`matchSkills`/`computeSkillMatchScore`
  elsewhere — used for the actual `matched_skills` list and scoring — are
  untouched; this only changes the pass/fail gate.)

### 2. `src/lib/__tests__/scoring.test.ts`

Add to the `passesSettingsGate` describe block:

- A test reproducing the confirmed Vercel pattern: a long (>600 char)
  description whose only required-keyword/skill mention is a company-intro
  paragraph in the first ~200 characters, with no second mention anywhere
  else → `passesSettingsGate` returns `false`.
- A test for the same long intro pattern but where the real engineering
  section _also_ mentions the keyword past the 600-char mark → returns
  `true`.
- A test confirming two distinct keyword/skill matches anywhere (even both
  inside the window) still passes — the breadth escape hatch.
- Confirm (no new test needed, just don't break) the existing short-fixture
  tests in the same describe block still pass unchanged, since their
  descriptions are well under 600 chars.

## Acceptance criteria

- `tsc --noEmit` clean, `eslint --fix` clean, all vitest passing (new +
  existing), `next build` successful.
- All 7 existing `passesSettingsGate` tests pass unchanged.
- New tests confirm the Vercel false-positive pattern is rejected and the
  genuine-match-past-the-intro pattern is accepted.
