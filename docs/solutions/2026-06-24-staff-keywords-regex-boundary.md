# STAFF_KEYWORDS regex: word boundaries on both sides

**File:** `src/lib/scoring.ts`
**Regression test:** `src/lib/__tests__/scoring.test.ts` → `describe("STAFF_KEYWORDS regex")`
**Fixed in:** initial multi-tenant branch commit

---

## The symptom

The seniority gate was misclassifying jobs it should have passed through to
the user's Gemini filter. Specifically:

- `"Headless CMS experience required"` was treated as a Staff/Lead title
  (matching `head`) and promoted to "senior-level" rather than falling through
  to the label-unknown path.
- `"She leads the team"` in a job description also matched, tagging the role
  as senior.
- Conversely, `"mislead"` in a description produced a false positive match on
  `lead`.

In all three cases jobs were being either silently kept (false senior match)
or silently kept for the wrong reason, so the misclassification was invisible
in the UI — the jobs still appeared, just with wrong seniority logic applied.

---

## The root cause

The old pattern was:

```
/\blead|staff|principal|architect|director|vp|head\b/i
```

JavaScript regex alternation (`|`) binds looser than concatenation, so this
was parsed as:

```
/(\blead) | (staff) | (principal) | (architect) | (director) | (vp) | (head\b)/i
```

- `lead` had a **left** word boundary but no right boundary → matched `leads`,
  `mislead`, `leadership`.
- `head` had a **right** word boundary but no left boundary → matched
  `headless`, `forehead`, `beachhead`.
- The middle terms (`staff`, `principal`, `architect`, `director`, `vp`) had
  **no** word boundaries at all — they happened to work in practice only
  because they're long enough that accidental substring matches are rare.

This is the classic alternation-boundary pitfall: anchors on the outside of an
alternation group apply only to the first and last alternatives, not to all of
them.

---

## What was tried first (and why it didn't work)

Adding `\b` to the outside of the full pattern (`/\blead|...|head\b/i`) was
the first instinct, and it looked correct on a quick mental read — but it's
exactly the broken pattern above. The fix requires grouping first:

```
/\b(lead|staff|...|head)\b/i
```

The boundaries now sit outside the group and apply to whichever alternative
matches, not just the first and last term.

---

## The fix

```typescript
// Before
const STAFF_KEYWORDS = /\blead|staff|principal|architect|director|vp|head\b/i;

// After
export const STAFF_KEYWORDS = /\b(lead|staff|principal|architect|director|vp|head)\b/i;
```

One character change (`(` before `lead`, `)` before `\b`) eliminates all
three false-positive classes.

---

## How to verify it doesn't regress

The eight regression tests in `scoring.test.ts` cover both true positives
(standalone "lead", "head", "staff", "vp", "principal") and the three known
false-positive cases ("leads", "headless", "mislead"). Run:

```bash
npx vitest run --reporter=verbose src/lib/__tests__/scoring.test.ts
```

All eight `STAFF_KEYWORDS regex` tests must pass. If anyone rewrites or
simplifies the regex in the future, the `headless`/`leads`/`mislead` tests are
the ones to watch — they're the ones that look like they should obviously pass
but didn't before the fix.

---

## Why this is worth documenting

The fix is a single-line change. The bug required reading three levels of
JavaScript regex parsing rules to understand, and the "obvious" first attempt
(`/\blead|...|head\b/`) reproduces the original bug exactly. Without this
note, the next person who "simplifies" the regex will introduce the same bug
and the regression tests will be the only thing catching it — if they still
exist.
