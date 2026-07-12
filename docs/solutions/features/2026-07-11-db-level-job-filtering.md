# Plan: Move Job Filtering to DB-Level SELECT

**Date:** 2026-07-11
**Goal:** Stop fetching up to 2,000 full `raw_jobs` rows per dashboard rebuild and
discarding most of them in Node. Push every filter gate that can be expressed as a
WHERE clause down into the query itself.
**Explicitly out of scope:** the Gemini gate, `scoreJob()`, and `mergeJobs()` — all
three either call an external API or depend on live, request-time computation and
cannot live in SQL. See "What stays in the app" below for the full list, including
two gates that only _partially_ migrate.

## Implementation status

Tasks 0, 2, and 3 are implemented and verified in this branch. Task 1 (applying
the migration to a real Supabase project) can't be done from a sandbox with no
project credentials — that step is still yours to run.

- ✅ **Task 0** — `supabase/migrations/20260711000000_jr_filtered_raw_jobs.sql`
  created, containing the SQL from §5 below.
- ⬜ **Task 1** — not run. Needs `supabase db push` (or the dashboard SQL editor)
  against a real project, then `supabase gen types typescript` to regenerate
  `database.types.ts` (see the `raw-jobs-query.ts` note below — this step is a
  hard dependency, not optional polish).
- ✅ **Task 2** — `src/lib/raw-jobs-query.ts` created and type-checks clean
  against the real, unmodified `database.types.ts`. One thing worth knowing
  before touching this file: the `db.rpc(...)` call **must** stay as one inline
  call (function name and args object together), not refactored into a
  `const params = {...}` passed separately. Both forms were tested directly —
  extracting `params` first makes TypeScript silently fall back to an
  unchecked path (confirmed: a deliberately wrong field name compiled without
  error), which quietly loses real argument-shape checking once
  `database.types.ts` is regenerated in Task 1. The inline form correctly
  errors today (expected, suppressed via a documented `@ts-expect-error`) and
  correctly catches real typos once the RPC is registered (verified both ways
  against a simulated post-codegen types file).
- ✅ **Task 3** — `dashboard-route.ts` and `src/app/api/dashboard/route.ts`
  updated. One design point worth flagging: `buildFeed()` is documented in its
  own file header as deliberately DB-call-free and unit-testable without
  mocking Supabase — so `fetchFilteredRawJobs()` is called from the route
  layer, not from inside `buildFeed()`, which now takes the already-filtered
  rows plus an explicit `dbFunnelCounts` param instead of computing
  `total_fetched`/`after_date_filter` itself. This is a real signature change
  (3 args → 4), not additive.
- ✅ **Task 6 (partial)** — `dashboard-route.test.ts` updated: 2 tests that
  exercised now-relocated gates (date, excluded-keywords) were removed — that
  exact coverage already exists independently in `scoring.test.ts`'s own
  `passesDateGate`/`passesExcludedKeywordsGate` describe blocks, confirmed via
  grep before deleting anything. 2 new tests were added for buildFeed's
  actual new contract (the `dbFunnelCounts` pass-through, and that the
  precision recheck genuinely still runs rather than trusting the coarse SQL
  prefilter blindly). Full suite: 44 files / 435 tests passing — identical
  count to the pre-change baseline (2 removed, 2 added), zero regressions.
- The SQL itself (§5) was verified against a real local Postgres 16 instance,
  not just reasoned through — see §3.5 for the specific values tested and
  results.
- **Not done:** Task 1 itself (needs real Supabase credentials), Task 4
  (parity script), Task 5 (shadow-mode flag), Task 7 (trigram indexes, and
  explicitly non-blocking anyway).

---

## 1. Current state (verified against source)

`src/app/api/dashboard/route.ts` calls:

```ts
db.from("raw_jobs")
  .select("*")
  .in("mode", enabledModes(settings))
  .order("fetched_at", { ascending: false })
  .limit(2000);
```

That's the only DB-level filter today. Everything else runs in
`src/lib/dashboard-route.ts::buildFeed()`, in this exact order:

1. `passesDateGate` — date/age check
2. `passesSettingsGate` — bundles 5 sub-gates: seniority, excluded keywords, required
   keywords, blacklisted locations, skill-match floor
3. `passesGlobalModeGate` — **only called when `job.mode === "global"`** (the check
   lives in the caller, `buildFeed()`, not inside the gate function itself)
4. Gemini gate
5. `scoreJob` (drops `total_score <= 0`)
6. `mergeJobs` (dedupe + sort)

`PipelineLog` records `total_fetched`, `after_date_filter`, `after_settings_filter`,
`after_gemini_filter`, `after_scoring` — and **`src/components/pipeline/FunnelView.tsx`
hardcodes these five field names**, and `DashboardClient.tsx` interpolates
`total_fetched`/`after_gemini_filter` directly into user-facing text
("`{X} fetched → {Y} after your Gemini filter`"). Any change to what these numbers
mean is a visible product change, not just a refactor. See §4.2.

---

## 2. Best-practice decisions

### 2.1 One Postgres RPC function, not query-builder `.or()` strings

Every gate depends on per-user arrays of arbitrary strings. The default
`required_keywords` array is literally
`["react", "next.js", "react native", "react.js", "reactjs"]` — two entries contain
a period. PostgREST's `.or()` filter syntax uses `.` and `,` as structural
delimiters, so building that filter as a client-side string is fragile with data
this app ships by default, not just in some theoretical adversarial case.

An RPC function takes `text[]` parameters as real bound values (sent in the request
body, not spliced into a URL query string), so the entire escaping problem doesn't
exist. Precedent already exists in this codebase: `increment_domain_counts` in
`src/lib/sources/ats/run-state.ts`.

### 2.2 Regex only where word-boundary actually matters; ILIKE everywhere else

Three gates need genuine word-boundary regex (a plain substring match would change
behavior): **seniority**, **excluded keywords**, **global-mode blocked regions**.

Three gates are pure substring matching and need no regex at all:

- **Blacklisted locations** — the current JS does
  `matchesAnyWholeWord(...) || textCombined.includes(...)`. A whole-word match
  always implies a substring match, so that `||` is dead weight — the gate's
  actual behavior is 100% substring-driven. `ILIKE '%term%'` is an **exact**
  match to current behavior, not an approximation.
- **Global-mode allowed locations** — already plain `.includes()` in the source.
- **Required-keywords / skill-match coarse prefilter** — see §2.3.

Fewer gates need real regex, which means less of the escaping/`\y`-vs-`\b` surface
area (§3.3) to get right.

### 2.3 Coarse SQL superset + exact JS precision pass, for the two gates that don't cleanly migrate

`passesRequiredKeywordsGate` and `passesSkillMatchGate` both route through
`hasMeaningfulKeywordMatch()`, which ignores matches in the first 600 characters
of text _unless_ two-or-more distinct keywords hit, or a match lands past that
window. That's stateful, positional logic — replicating it faithfully in SQL means
a second implementation of the same algorithm in PL/pgSQL, in a different language,
that will drift the moment one side changes without the other.

Instead: SQL does a coarse "does any keyword appear anywhere" superset check, and the
exact `hasMeaningfulKeywordMatch()` runs in Node afterward, on whatever small set
survives. This is safe specifically because of how the exact gate is built: both of
its passing conditions (`matchOutsideWindow`, and `distinctMatchCount >= 2`) can only
become true via an actual regex match inside the loop — so **every job that passes
the exact gate necessarily has at least one keyword appearing as a plain substring
somewhere in the text.** A coarse "any keyword, anywhere" check can therefore never
reject a row the exact gate would have kept; it can only over-admit rows that the
precision recheck then correctly drops. Same precision as today; the row-count
reduction still happens at the DB.

### 2.4 Call it via the existing admin/service-role client — no RLS changes

`raw_jobs` has no RLS policy today; it's only ever read through the admin client.
The new function should be `SECURITY INVOKER` (Postgres default) and called through
the same `createAdminClient()` used today. No `SECURITY DEFINER`, no new grants to
`authenticated` or `anon` — don't introduce a privilege-escalation surface to solve
a problem that doesn't exist here.

### 2.5 Lock EXECUTE to `service_role` explicitly

Even as `SECURITY INVOKER`, a new function defaults to `PUBLIC` execute rights in
Postgres. Explicitly `REVOKE ... FROM PUBLIC` and `GRANT ... TO service_role` so it
can't be called directly by the anon/authenticated key from a browser — this
function does more scanning work per call than a simple `select`, so it's worth
closing off as a minor DoS surface even though nothing points to it being exposed
today.

### 2.6 Preserve `PipelineLog`'s field names; be deliberate about what they now mean

Non-negotiable: `total_fetched`, `after_date_filter`, `after_settings_filter`,
`after_gemini_filter`, `after_scoring` keep their exact names — `FunnelView.tsx`
depends on them verbatim.

`total_fetched` and `after_date_filter` carry over as exact equivalents (§4.2).
`after_settings_filter` gets a small, deliberate, disclosed redefinition — see §4.2
for why folding the global-mode gate into this bucket is actually a minor accuracy
_improvement_, not just an acceptable side effect.

### 2.7 Track this as schema-as-code, not a dashboard hand-edit

There's no `supabase/` or `migrations/` directory in this repo today — schema
changes have presumably been applied by hand via the Supabase SQL editor. Given this
plan adds real business logic to the DB (not just a table), it should live in a
checked-in, reviewable `.sql` file from day one. Task 0 below sets up the minimum
viable version of this (a tracked migration file), not a full local Postgres/Docker
CI setup — that's a bigger lift than this migration alone justifies.

### 2.8 Shadow-mode verification before cutover, behind a flag

This is filtering logic for someone's actual job search — getting it wrong either
hides jobs that should show up, or shows jobs that shouldn't. Ship it behind an env
flag, run both the old JS path and the new SQL path for a sample of real users, diff
the resulting job-ID sets, and only flip the default once the diff rate is ~0 or
fully explained. Detailed in §6.

---

## 3. Edge cases

These are the ones that will silently break the feature if missed — not a
generic checklist, each is tied to something concrete in this codebase.

### 3.1 The NULL-empty-array trap (the most important one)

If a settings array is empty (e.g. a user clears `excluded_keywords`), the JS gate
returns `true` — no filtering. In SQL, an empty array fed into
`string_agg(...) over unnest(empty_array)` returns **NULL**, and
`title ~* NULL` evaluates to **NULL**, not `true` — and `WHERE` only keeps rows
where the condition is `TRUE`, not `NULL`/unknown. A naive translation would
silently reject **every row** for any user with an empty filter array — the exact
opposite of "no filter," and the single most likely way this migration breaks
production for real accounts (anyone who's intentionally cleared a list expecting
it to stop filtering).

**Mitigation:** `jr_word_boundary_pattern()` returns `NULL` for an empty/null array
by design, and every WHERE clause explicitly guards with
`pattern IS NULL OR <test>` (for exclude-if-match gates) so a NULL pattern always
means "pass everyone," never "match nothing."

### 3.2 One gate is the _exception_ to 3.1 — don't "fix" it

`passesSkillMatchGate` has **no empty-array guard** in the current source:

```ts
export function passesSkillMatchGate(job: RawJob, settings: ResolvedSettings): boolean {
  return hasMeaningfulKeywordMatch(job.description, [
    ...settings.expert_skills,
    ...settings.secondary_skills,
  ]);
}
```

If both `expert_skills` and `secondary_skills` are empty, `hasMeaningfulKeywordMatch`
is called with `keywords = []`. Tracing both branches of that function with an empty
array: the short-text branch does `[].some(...)` → `false`; the long-text branch's
loop runs zero times → `distinctMatchCount = 0`, `matchOutsideWindow = false` →
`false || false` → `false`. **Every other gate explicitly special-cases "empty
array → pass." This one doesn't, and returns `false` (reject) for every job when
both skill lists are empty.** Whether that was intentional or an oversight in the
original code, it's the _current, live_ behavior, reachable if a user clears both
skill lists in settings (nothing in `saveUserSettings` blocks saving `[]`).

The SQL prefilter must reproduce this exactly: `p_skill_terms` empty/null →
reject every row, not pass every row. This is the one gate in the whole set where
the "empty means no filter" instinct is wrong. Flagged explicitly in the reference
SQL (§5) so it doesn't get "corrected" into consistency with the other five gates
during implementation or a future refactor.

### 3.3 `\b` in Postgres means backspace, not word boundary

JS's `\b` (word boundary) does not mean the same thing in PostgreSQL's regex
flavor (Advanced Regular Expressions) — there, `\b` is the backspace character.
The word-boundary token is **`\y`**. Porting a `\bterm\b` pattern to SQL by find-
and-replacing `\b` → `\b` produces a pattern that compiles without error and matches
nothing like what's intended. Every pattern in §5 uses `\y`, not `\b` — this is
the single easiest mistake to make when porting this specific piece of logic, and
it fails silently (no error, just wrong matches) rather than loudly.

### 3.4 The `.NET` / `C++` limitation carries over unchanged — this is a good thing

The current source already documents this in `scoring.ts`:

> "Terms starting/ending with non-word chars (e.g. `.NET`, `C++`) will NOT match as
> expected because `\b` requires a word character at the boundary."

Postgres's `\y` has the identical word-character-boundary requirement, so this
known, already-accepted limitation carries over exactly, with no behavior change.
Worth stating explicitly so nobody re-discovers it mid-migration and assumes it's a
new bug introduced by the SQL rewrite.

### 3.5 Regex-escaping the escape list, robustly

Rather than transliterating the JS special-character class
(`[.*+?^${}()|[\]\\]`) into a Postgres bracket expression — which involves a second,
different layer of escaping rules and is easy to get subtly wrong by hand (bracket
expressions have their own quoting quirks around `]`, `^`, `-`, and, in Postgres's
ARE flavor specifically, `\`) — the reference implementation escapes _every_
character that isn't `[a-zA-Z0-9 ]`, unconditionally. Over-escaping ordinary
punctuation is harmless (an escaped ordinary character is just that character,
literally, in Postgres's regex engine), and this sidesteps needing to enumerate
"the correct" special-character set a second time in a different regex dialect.
Whitespace is handled as a second pass (runs of spaces → `\s+`), matching the
current JS's separate whitespace-normalization step.

**Verified against a real Postgres 16 instance** (not just reasoned through) —
`jr_escape_regex_term()` was run directly against this app's actual gnarlier
default values:

| Input              | Output               |
| ------------------ | -------------------- |
| `next.js`          | `next\.js`           |
| `site reliability` | `site\s+reliability` |
| `C++`              | `C\+\+`              |
| `C#`               | `C\#`                |
| `react.js`         | `react\.js`          |
| `a.b(c)[d]`        | `a\.b\(c\)\[d\]`     |

Also confirmed against real rows in a scratch `raw_jobs` table:

- `\y(next\.js)\y` matches "Senior **Next.js** Developer" but not "use**next.js**
  today" (no left word-boundary) — boundary logic works as intended.
- `\y(c\+\+)\y` does **not** match "we use **C++** daily," reproducing the exact
  `.NET`/`C++` limitation already documented in `scoring.ts` (§3.4) — confirmed
  identical, not just claimed identical.
- `\y(sre)\y` correctly does **not** match "mi**sre**ading the room" (a genuine
  substring occurrence of "sre"), which is exactly the failure mode `ILIKE` alone
  would have let through, and the reason `excluded_keywords` needs real
  word-boundary regex rather than substring matching.
- `jr_word_boundary_pattern(array[]::text[])` and `jr_word_boundary_pattern(null)`
  both return `NULL`, confirmed directly.
- Ran the full `jr_get_filtered_raw_jobs()` against 9 synthetic rows covering
  every gate (seniority multi-label, excluded, required, blacklist, both
  branches of the global-mode conditional, `date_unknown=true`, and the
  misreading/sre case) — every row landed exactly where hand-tracing the gate
  logic predicted, and the returned funnel counts (9 → 8 → 5) matched a manual
  tally exactly.
- Separately confirmed the §3.2 fix: calling the function with `p_skill_terms`
  empty returns zero rows, not all rows — the deliberate exception held up under
  an actual call, not just in the standalone helper.

Two things remain unverified and should still get a look before this ships:
non-ASCII/Unicode input (§3.10) and behavior against production data volume/shape
rather than 9 synthetic rows (Task 1's `EXPLAIN ANALYZE` still applies).

### 3.6 `posted_at` can be `NULL` in the schema — but verify before assuming it happens

The schema allows it (`posted_at: string | null` in `database.types.ts`, no CHECK
constraint tying it to `date_unknown`) — but checking the actual write path changes
the picture. `raw_jobs` has exactly one insert path
(`src/lib/cron/upsert-raw-jobs.ts`, fed by `src/lib/ats-bridge.ts::fetchCompany()`;
confirmed via grep that the other two `raw_jobs` references — the admin route and
`known-jobs.ts` — only `.delete()` or `.select()`, never insert). `ats-bridge.ts`
line 105 sets `posted_at: dateUnknown ? fetchedAt : postedAt` unconditionally, and
`postedAt` itself already falls back to `fetchedAt` one line earlier if the
source's raw date was missing (line 91). **So the invariant "posted_at is
non-null, and equals fetched_at exactly when date_unknown is true" is actually
enforced by the sole write path today** — this isn't a live bug, just a schema gap
with no DB-level CHECK constraint behind it. The reference SQL's
`COALESCE(posted_at, fetched_at)` is defensive against a future write path (a
script, a manual seed, a bypass of `ats-bridge.ts`) breaking that invariant, not a
fix for something observed — worth keeping as cheap insurance, but don't present
it as closing a bug that exists today. If minimizing behavior surface is preferred,
drop the `COALESCE` and use `posted_at` directly instead — it will produce
identical results against current data either way.

### 3.7 ReDoS — an existing risk, arguably reduced by this migration

Keyword arrays are user-editable, and they get compiled into alternation regexes.
A pathological term could cause catastrophic backtracking. This risk already exists
today in the JS/V8 regex engine, which has no guarantee against exponential
worst-case blowup — this migration doesn't introduce it. If anything, PostgreSQL's
regex engine (derived from Henry Spencer's library) is generally understood to
avoid the worst exponential-time pathologies that backtracking engines like V8's
can hit. Not a reason to skip a `statement_timeout` as defense in depth, but not a
new risk either.

### 3.8 `%` and `_` are ILIKE wildcards

If a keyword ever contains a literal `%` or `_`, `ILIKE '%term%'` would treat it as
a wildcard, not a literal character. Unlikely given current keyword data (no
existing array has one), but worth a defensive
`replace(term, '%', '\%')`/`replace(term, '_', '\_')` in the ILIKE-building helper
if this becomes a real concern later. Not blocking for v1 — call it out in code
review, don't over-build for a case with zero evidence it occurs.

### 3.9 The funnel gap moves — and gets more honest, not less

See §4.2 for the full reasoning: folding the global-mode gate into
`after_settings_filter` (rather than leaving its attrition invisibly bundled into
"after your Gemini filter," which is what happens today) makes the funnel _more_
accurate, not less, since global-mode is a settings-driven filter, not part of
Gemini's job.

### 3.10 Unicode / non-ASCII content — untested, flag for verification

This app handles international job postings and (per the user's own relocation
context) has reason to encounter non-ASCII company/location names. Postgres's
"escape everything non-alphanumeric" rule (§3.5) will backslash-escape non-ASCII
letters too (e.g. accented characters), which should be harmless — an escaped
"ordinary" character in Postgres's regex engine is just that character — but this
is reasoned from documented behavior, not verified against a real instance. Add a
handful of non-ASCII sample values to the manual verification pass in §3.5 before
trusting it in production.

---

## 4. Gate-by-gate mapping

| Gate                        | Current location                           | SQL treatment                                                                | Notes                                   |
| --------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------- | --------------------------------------- |
| `mode` ∈ enabled pipelines  | `dashboard/route.ts`                       | `mode = ANY(p_modes)`                                                        | Already DB-level today                  |
| Date gate                   | `passesDateGate`                           | Plain date/timestamp comparison, no regex                                    | §3.6 COALESCE decision                  |
| Seniority                   | `passesSeniorityGate` / `getMatchedLevels` | `\y` regex, two patterns (all-levels, selected-levels)                       | §4.1 below                              |
| Excluded keywords           | `passesExcludedKeywordsGate`               | `\y` regex, title only                                                       | Exact match to current behavior         |
| Blacklisted locations       | `passesBlacklistedLocationsGate`           | `ILIKE` substring, title+description+location                                | Exact match — see §2.2                  |
| Required keywords           | `passesRequiredKeywordsGate`               | `ILIKE` coarse superset (SQL) + exact `hasMeaningfulKeywordMatch` (app)      | §2.3                                    |
| Skill-match floor           | `passesSkillMatchGate`                     | `ILIKE` coarse superset (SQL, **no empty-pass**, §3.2) + exact recheck (app) | §2.3                                    |
| Global-mode allowed/blocked | `passesGlobalModeGate`                     | `ILIKE` (allowed) / `\y` regex (blocked), conditional on `mode='global'`     | §4.1                                    |
| Gemini gate                 | `gemini.ts`                                | Stays in app                                                                 | External API call                       |
| Scoring                     | `scoreJob`                                 | Stays in app                                                                 | Live recency + user weights             |
| Merge/dedupe                | `mergeJobs`                                | Stays in app                                                                 | Post-scoring, unrelated to fetch volume |

### 4.1 Formula reference (worked out from the actual gate logic, not assumed)

**Seniority** — `passesSeniorityGate` passes if `matched.length === 0` OR
`matched.some(l => seniority_levels.includes(l))`. Since matching a _selected_
level's regex directly implies that level is a "matched level," this reduces to:

```
PASS ⟺ (text matches none of the 4 level regexes) OR (text matches ≥1 selected-level regex)
```

**Global mode** — `passesGlobalModeGate` has no internal `mode` check; `buildFeed()`
calls it only when `job.mode === "global"`. Combined:

```
PASS ⟺ mode ≠ 'global' OR allowed-match OR NOT blocked-match
```

### 4.2 The `after_settings_filter` decision, written out

Today, `after_settings_filter` is counted **before** the global-mode gate runs (a
separate stage further down in `buildFeed()`), so global-mode's own attrition is
invisible — it's silently absorbed into the gap the UI labels _"Jobs passing your
personal AI filter prompt"_ (`FunnelView.tsx`), which is not what's actually
happening in that gap today.

The new SQL applies global-mode filtering in the same pass as everything else,
because splitting it into a separate round trip just to preserve an old, already-
slightly-inaccurate boundary isn't worth the extra complexity for a telemetry
number. Recommendation: let `after_settings_filter` include global-mode attrition
going forward. This makes the label _more_ accurate (global-mode is a
settings-driven filter, not part of Gemini's job) — a disclosed, deliberate
redefinition, not a silent one. If exact historical parity in this one field
matters more than accuracy, the alternative is a second `count(*) filter (where
...)` clause computing a pre-global-mode count separately — doable, not included
in the reference SQL because it adds complexity for a number nothing else in the
app depends on programmatically (confirmed via grep — only `FunnelView.tsx` and
`DashboardClient.tsx` read `PipelineLog` fields, both display-only). This is
consumed by Task 3, below.

---

## 5. Reference SQL

This is a working sketch to build Task 1 from — **not** copy-paste-ready without the
verification pass in §3.5 and an `EXPLAIN ANALYZE` against production-sized data.

```sql
-- ── Helpers ──────────────────────────────────────────────────────────────

create or replace function jr_escape_regex_term(term text)
returns text
language sql
immutable
as $$
  select regexp_replace(
    regexp_replace(term, '([^a-zA-Z0-9 ])', '\\\1', 'g'),  -- escape every non-alnum, non-space char
    ' +', '\\s+', 'g'                                        -- then make whitespace runs flexible
  );
$$;

comment on function jr_escape_regex_term(text) is
  'Escapes a term for safe use inside a Postgres ARE and normalizes internal '
  'whitespace to \s+. Mirrors wordBoundaryPattern()/buildLevelRegex() in '
  'src/lib/scoring.ts. Verified against next.js/C++/site reliability and other '
  'real default values -- see plan docs/plans/2026-07-11-db-level-job-filtering.md §3.5.';

create or replace function jr_word_boundary_pattern(terms text[])
returns text
language sql
immutable
as $$
  select case
    when terms is null or array_length(terms, 1) is null then null
    else '\y(' || string_agg(jr_escape_regex_term(t), '|') || ')\y'
  end
  from unnest(terms) as t
  where t is not null and length(trim(t)) > 0;
$$;

comment on function jr_word_boundary_pattern(text[]) is
  'NULL in, NULL out. Callers MUST guard with "pattern IS NULL OR <test>" so an '
  'empty settings array means "no filter" -- never assume NULL means "matches '
  'nothing" (see plan §3.1). Exception: the skill-match floor gate, which has no '
  'empty-array escape hatch by design -- see plan §3.2.';

-- ── Main function ────────────────────────────────────────────────────────
-- Replaces the .select("*").in("mode",...).order().limit(2000) call in
-- src/app/api/dashboard/route.ts.

create or replace function jr_get_filtered_raw_jobs(
  p_modes                text[],
  p_job_age_days          int,
  p_all_level_terms       text[],  -- junior+mid+senior+staff keywords, unioned by the caller
  p_selected_level_terms  text[],  -- only the arrays for settings.seniority_levels
  p_excluded_terms        text[],
  p_required_terms        text[],  -- required_keywords, or expert_skills fallback -- caller decides
  p_skill_terms           text[],  -- expert_skills + secondary_skills
  p_blacklist_terms       text[],
  p_global_allowed_terms  text[],
  p_global_blocked_terms  text[],
  p_limit                 int default 2000
)
returns jsonb
language sql
stable
as $$
  with cutoff as (
    select now() - make_interval(days => greatest(p_job_age_days, 0)) as ts
  ),
  patterns as (
    select
      jr_word_boundary_pattern(p_all_level_terms)      as all_level_pat,
      jr_word_boundary_pattern(p_selected_level_terms) as sel_level_pat,
      jr_word_boundary_pattern(p_excluded_terms)       as excluded_pat,
      jr_word_boundary_pattern(p_global_blocked_terms) as blocked_pat
  ),
  mode_scoped as (
    select * from raw_jobs where mode = any(p_modes)
  ),
  after_date as (
    select ms.* from mode_scoped ms, cutoff
    where (ms.date_unknown and ms.fetched_at >= cutoff.ts)
       or (not ms.date_unknown and coalesce(ms.posted_at, ms.fetched_at) >= cutoff.ts)
    -- ^ COALESCE is a deliberate small behavior change -- see plan §3.6.
    -- Drop it (use ms.posted_at directly) for exact parity instead.
  ),
  base as (
    select ad.*
    from after_date ad, patterns
    where
      -- seniority: pass if unlabelled, or matches a selected level (§4.1)
      (
        patterns.all_level_pat is null
        or not (ad.title ~* patterns.all_level_pat or ad.description ~* patterns.all_level_pat)
        or (
          patterns.sel_level_pat is not null
          and (ad.title ~* patterns.sel_level_pat or ad.description ~* patterns.sel_level_pat)
        )
      )
      -- excluded keywords: title only, empty array => pass (§3.1)
      and (patterns.excluded_pat is null or ad.title !~* patterns.excluded_pat)
      -- blacklisted locations: substring, title+description+location, empty => pass (§3.1, §2.2)
      and (
        p_blacklist_terms is null or array_length(p_blacklist_terms, 1) is null
        or not exists (
          select 1 from unnest(p_blacklist_terms) as bl
          where (ad.title || ' ' || ad.description || ' ' || ad.location) ilike ('%' || bl || '%')
        )
      )
      -- required keywords: COARSE superset only, empty => pass (§3.1, §2.3)
      and (
        p_required_terms is null or array_length(p_required_terms, 1) is null
        or exists (
          select 1 from unnest(p_required_terms) as rk
          where (ad.title || ' ' || ad.description || ' ' || ad.location) ilike ('%' || rk || '%')
        )
      )
      -- skill-match floor: COARSE superset, empty => REJECT, not pass (§3.2 -- deliberate exception)
      and (
        p_skill_terms is not null and array_length(p_skill_terms, 1) is not null
        and exists (
          select 1 from unnest(p_skill_terms) as sk
          where ad.description ilike ('%' || sk || '%')
        )
      )
      -- global-mode gate: only applies to mode='global' rows (§4.1)
      and (
        ad.mode <> 'global'
        or (
          p_global_allowed_terms is not null and array_length(p_global_allowed_terms, 1) is not null
          and exists (
            select 1 from unnest(p_global_allowed_terms) as ga
            where (ad.title || ' ' || ad.description || ' ' || ad.location) ilike ('%' || ga || '%')
          )
        )
        or (
          patterns.blocked_pat is null
          or not (
            ad.title ~* patterns.blocked_pat
            or ad.description ~* patterns.blocked_pat
            or ad.location ~* patterns.blocked_pat
          )
        )
      )
  ),
  limited as (
    select * from base order by fetched_at desc limit greatest(p_limit, 0)
  )
  select jsonb_build_object(
    'jobs', coalesce((select jsonb_agg(to_jsonb(limited.*)) from limited), '[]'::jsonb),
    'funnel', jsonb_build_object(
      'total_fetched', (select count(*) from mode_scoped),
      'after_date_filter', (select count(*) from after_date),
      -- NOTE: this is the COARSE count (before the app's exact precision
      -- recheck). buildFeed() must NOT copy this straight into
      -- PipelineLog.after_settings_filter -- see plan §4.2 / Task 3.
      'after_settings_filter_coarse', (select count(*) from base)
    )
  );
$$;

-- ── Grants (§2.5) ────────────────────────────────────────────────────────

revoke all on function jr_escape_regex_term(text) from public;
revoke all on function jr_word_boundary_pattern(text[]) from public;
revoke all on function jr_get_filtered_raw_jobs(
  text[], int, text[], text[], text[], text[], text[], text[], text[], text[], int
) from public;

grant execute on function jr_get_filtered_raw_jobs(
  text[], int, text[], text[], text[], text[], text[], text[], text[], text[], int
) to service_role;
```

---

## 6. Task breakdown

### Task 0 — Schema-as-code (prerequisite)

- Create `supabase/migrations/` in the repo (§2.7).
- Add `20260711_jr_filtered_raw_jobs.sql` containing exactly the SQL in §5.
- If the team wants full local verification later, `supabase` CLI + `supabase start`
  is the natural next step — not required to ship this task, flagged as follow-up.

### Task 1 — Apply the migration

- Run the SQL in §5 against staging first.
- §3.5's escaping logic and the full function are already verified against a local
  Postgres 16 instance with synthetic data (see §3.5's results). What's still
  needed before production: re-run against a copy of this app's actual
  `raw_jobs`/`user_settings` data (real keyword arrays, real job descriptions,
  real volume) rather than 9 synthetic rows — different data can still surface
  something 9 hand-picked rows didn't.
- `EXPLAIN ANALYZE` the function against a production-sized `raw_jobs` copy; note
  the result in the PR description.

### Task 2 — New TS query module

- Create `src/lib/raw-jobs-query.ts`, exporting `fetchFilteredRawJobs(modes,
settings, limit)`, wrapping `db.rpc("jr_get_filtered_raw_jobs", {...})` via the
  existing `createAdminClient()` (§2.4).
- Caller composes `p_all_level_terms` / `p_selected_level_terms` from
  `settings.{junior,mid,senior,staff}_keywords` + `settings.seniority_levels` (plain
  array concatenation — no need to push this trivial logic into SQL, §2.1 spirit).
- Caller resolves the `required_keywords`-or-`expert_skills` fallback (mirrors
  `passesRequiredKeywordsGate`'s existing fallback logic) before calling the RPC.

**Reference shape** (illustrative — not compiled/type-checked, refine during
implementation):

```ts
// src/lib/raw-jobs-query.ts
import { createAdminClient } from "./supabase/admin";
import type { ResolvedSettings, RawJob } from "./types";

export interface FilteredRawJobsResult {
  jobs: RawJob[];
  funnel: {
    total_fetched: number;
    after_date_filter: number;
    after_settings_filter_coarse: number;
  };
}

const LEVEL_KEYWORD_FIELDS = {
  junior: "junior_keywords",
  mid: "mid_keywords",
  senior: "senior_keywords",
  staff: "staff_keywords",
} as const;

export async function fetchFilteredRawJobs(
  modes: string[],
  settings: ResolvedSettings,
  limit = 2000,
): Promise<FilteredRawJobsResult> {
  const db = createAdminClient();

  const requiredTerms =
    settings.required_keywords.length > 0 ? settings.required_keywords : settings.expert_skills;

  const { data, error } = await db.rpc("jr_get_filtered_raw_jobs", {
    p_modes: modes,
    p_job_age_days: settings.job_age_days,
    p_all_level_terms: [
      ...settings.junior_keywords,
      ...settings.mid_keywords,
      ...settings.senior_keywords,
      ...settings.staff_keywords,
    ],
    p_selected_level_terms: settings.seniority_levels.flatMap(
      (level) => settings[LEVEL_KEYWORD_FIELDS[level]],
    ),
    p_excluded_terms: settings.excluded_keywords,
    p_required_terms: requiredTerms,
    p_skill_terms: [...settings.expert_skills, ...settings.secondary_skills],
    p_blacklist_terms: settings.blacklisted_locations,
    p_global_allowed_terms: settings.global_mode_allowed_locations,
    p_global_blocked_terms: settings.global_mode_blocked_regions,
    p_limit: limit,
  });

  if (error) throw new Error(`fetchFilteredRawJobs failed: ${error.message}`);
  return data as unknown as FilteredRawJobsResult;
}
```

### Task 3 — Update `buildFeed()` / `dashboard-route.ts`

- Replace the raw `.select("*")...` call with `fetchFilteredRawJobs(...)`.
- Remove `passesDateGate`, `passesSeniorityGate`, `passesExcludedKeywordsGate`,
  `passesBlacklistedLocationsGate`, and the global-mode conditional from the JS
  pipeline — they're now done in SQL.
- **Keep** `hasMeaningfulKeywordMatch()` calls for required-keywords and
  skill-match, run against the (now much smaller) SQL-filtered rows — this is the
  exact precision recheck from §2.3, not optional.
- Recompute `pipelineLog.after_settings_filter` as `.length` of the array **after**
  this precision recheck — do not copy `funnel.after_settings_filter_coarse`
  straight from the RPC response into `PipelineLog` (§4.2, and the comment in the
  SQL itself).
- `total_fetched` and `after_date_filter` come straight from the RPC's `funnel`
  object — exact equivalents, no recomputation needed.

### Task 4 — Parity verification script

Add `scripts/verify-db-filter-parity.ts`, matching the existing convention
(`scripts/send-salary-reminders.ts`, `scripts/smoke-test-email.ts`). For a sample of
real users: run both the old JS-gate pipeline and the new
`fetchFilteredRawJobs()` + precision-recheck path against the same raw pool, diff
the resulting job-ID sets, and print any mismatches with enough context (which gate,
which job) to debug. This is the primary correctness gate before cutover — not a
new test-infrastructure project (§2.7's scope note applies here too: no local
Postgres/Docker CI stack is being proposed, since none of the existing tests
(`dashboard-route.test.ts`, `scoring.test.ts`) exercise a real DB today).

### Task 5 — Shadow-mode rollout

- Env flag (e.g. `DB_LEVEL_FILTERING=shadow|on|off`).
- `shadow`: call both paths, serve the OLD path's result to the user, log a diff
  if the new path would have returned a different job-ID set.
- Watch for zero (or fully-explained) diffs for a few days across real traffic,
  then flip to `on`.
- `off` remains available as an instant rollback — no schema rollback needed, since
  the old query path (`.select("*")...`) still works unmodified until it's
  physically deleted from the codebase, which should happen only after `on` has
  been stable for a while.

### Task 6 — Tests

- Extend `dashboard-route.test.ts`'s existing `makeJob`/`makeSettings` fixtures for
  the precision-recheck logic that remains in `buildFeed()`.
- SQL-level correctness is covered by Task 4's parity script + the manual
  verification in §3.5, not new vitest suites — there's no existing pattern in this
  repo for testing SQL functions directly, and standing one up is a bigger lift than
  this migration justifies (ponytail: solve the problem in front of you).

### Task 7 — Follow-up, non-blocking: `pg_trgm` indexes

`ILIKE '%term%'` and `~*` regex predicates don't use a plain btree index. Postgres's
`pg_trgm` extension supports GIN indexes that accelerate exactly these patterns
(including `~*`). Worth adding on `title`, `description`, `location` once real
query plans (Task 1's `EXPLAIN ANALYZE`) show it's needed — not a blocker for
shipping the WHERE-clause pushdown itself, since even an unindexed sequential scan
in Postgres, filtering rows before they're serialized and sent over the wire, is
cheaper than fetching all of them into Node and running the same regex there.

```sql
create extension if not exists pg_trgm;
create index concurrently if not exists idx_raw_jobs_title_trgm on raw_jobs using gin (title gin_trgm_ops);
create index concurrently if not exists idx_raw_jobs_description_trgm on raw_jobs using gin (description gin_trgm_ops);
create index concurrently if not exists idx_raw_jobs_location_trgm on raw_jobs using gin (location gin_trgm_ops);
```

`CONCURRENTLY` cannot run inside a transaction block — if this gets pasted into a
migration runner that wraps files in a transaction by default, run these three
statements as a separate, standalone migration rather than appending them to the
Task 0/1 migration file.

---

## 7. What stays in the app (restated)

- **Gemini gate** (`gemini.ts`) — external API call, cannot be a WHERE clause.
- **Scoring** (`scoreJob`) — depends on live recency + user-configurable weights at
  read time.
- **Merge/dedupe** (`mergeJobs`) — operates on already-scored data, unrelated to
  `raw_jobs` fetch volume.
- **Exact `hasMeaningfulKeywordMatch()` recheck** for required-keywords and
  skill-match, run over the SQL-narrowed result set (§2.3) — the coarse SQL version
  is a superset filter, not a replacement for the real algorithm.

## 8. Rollback

Set the env flag to `off` (Task 5). The old `.select("*")...` code path stays in
the repo, untouched, until `on` has been stable — no schema rollback is needed
either way, since the new functions are additive (nothing about `raw_jobs` itself
changes) and simply go unused if the flag is off.
