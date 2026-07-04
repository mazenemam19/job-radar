# Code Health Audit — Status

Last updated: 2026-07-04 (row #21 closed)
Purpose: resume this work in a new chat without re-deriving findings. Point Claude
at this file + the repo and say "read docs/AUDIT_STATUS.md and continue."

## Config changes already made

- [x] `.eslintrc.json`: added `max-lines-per-function` (150), `complexity` (10),
      `max-lines` (300) — all set to `"warn"`, not `"error"`, until triage below
      is complete. Do not flip to error until the queue is empty or it breaks CI.
- [ ] `database.types.ts` needs to be excluded from these rules (Supabase-generated,
      do not hand-refactor it) — not yet added to `.eslintrc.json` ignore/overrides.
- [ ] CI (`.github/workflows/e2e.yml`) does not run lint at all. Add a lint step
      once rules are at `error`, or the config change above is decorative.

## Findings not yet fixed

- 16/19 components in `src/components` have zero test files. `SettingsForm.tsx`,
  `DefaultsForm.tsx`, and (as of row #14) `DashboardClient.tsx` are exceptions in
  substance, not in count: each was split into a thin render layer, a stateful hook
  (`hooks/useSettingsForm.ts` / `hooks/useDefaultsForm.ts` / `hooks/useDashboardFeed.ts`),
  and pure logic (`lib/settings-form.ts` / `lib/defaults-form.ts` / `lib/dashboard-client.ts`)
  — only the lib layer has a test file, but it now holds the mode-counting/filtering
  logic that used to be inline and untested. Neither component nor any of the three
  hooks has a direct test file;
  `vitest.config.ts`'s `include` only covers `src/lib/__tests__/**` and
  `src/app/api/**`, so component/hook-level tests wouldn't even run today without
  a config change — out of scope for this row.
- API route coverage — CORRECTED after checking git history + actual imports,
  not just filename matching. Some route tests live in `src/lib/__tests__/`
  and import the handler directly (e.g. `salary-route.test.ts` imports
  `app/api/salary/route`), which a naive `find *.test.ts` colocated search misses.
  - Actually tested: `jobs/[id]`, `submit`, `tracker` (root only, not `[id]`),
    `salary` (GET only — POST untested), `admin/companies/[id]` (PUT+DELETE),
    `account` (DELETE only).
  - Still fully untested (verified, not guessed): `admin/companies` (root),
    `admin/users`, `admin/users/[id]`, `admin/submissions`,
    `admin/test-ats`, `admin/defaults`, `cron`, `tracker/[id]`, `settings`,
    `strategy`, `dashboard`. (`admin/submissions/[id]` PATCH is now covered via
    `build-submission-patch.test.ts` / `approve-submission.test.ts` — the
    handler logic that used to live inline is now tested at the lib layer;
    DELETE on this route is still untested.)
- `src/pages/_document.js` — Pages Router leftover in an App Router project.
  Status: unverified whether it's dead code or load-bearing. Check before deleting.
- Two test files themselves exceed the new size rules (`scoring.test.ts` now 520
  lines after row #12's sub-gate tests, up from 468; one 163-line function in
  `settings.test.ts`). Lower priority than untested files.

## Fix queue — priority order (by complexity/size severity)

Status column: `pending` / `in progress` / `done`

| #   | File                                                        | Issue                                                      | Status     |
| --- | ----------------------------------------------------------- | ---------------------------------------------------------- | ---------- |
| 1   | `src/app/api/admin/defaults/route.ts`                       | complexity 47                                              | done       |
| 2   | `src/lib/sources/ats-utils.ts`                              | 815 lines, complexity 16                                   | done       |
| 3   | `src/components/settings/SettingsForm.tsx`                  | 605 lines, complexity 21, 29 useState, no tests            | done       |
| 4   | `src/app/api/admin/companies/[id]/route.ts`                 | complexity 26                                              | done       |
| 5   | `src/lib/runner.ts`                                         | complexity 24, 160-line function                           | done       |
| 6   | `src/lib/settings.ts`                                       | complexity 23 (`mergeWithDefaults`)                        | done       |
| 7   | `src/components/admin/AdminComponents/DefaultsForm.tsx`     | 320 lines, complexity 21, no tests                         | done       |
| 8   | `src/lib/ats-bridge.ts`                                     | complexity 21                                              | done       |
| 9   | `src/components/dashboard/JobCard.tsx`                      | 171 lines, complexity 19, no tests                         | done       |
| 10  | `src/app/api/admin/submissions/[id]/route.ts`               | complexity 16                                              | done       |
| 11  | `src/components/admin/AdminComponents/SubmissionsTable.tsx` | complexity 14                                              | done       |
| 12  | `src/lib/scoring.ts`                                        | complexity 14 (`passesSettingsGate`)                       | done       |
| 13  | `src/app/job/[id]/page.tsx`                                 | 201 lines, complexity 14                                   | done       |
| 14  | `src/components/dashboard/DashboardClient.tsx`              | 172 lines, complexity 14                                   | done       |
| 15  | `src/lib/gemini.ts`                                         | 3 functions over complexity 10                             | done       |
| 16  | `src/components/landing/LandingContent.tsx`                 | 203 lines                                                  | done       |
| 17  | `src/components/salary/SalaryPage.tsx`                      | superseded — see "Salary Page — Data Model Redesign" below | superseded |
| 18  | `src/app/api/dashboard/route.ts`                            | complexity 13                                              | done       |
| 19  | `src/app/api/salary/route.ts`                               | complexity 13 (x2)                                         | done       |
| 20  | `src/app/api/submit/route.ts`                               | complexity 13                                              | done       |
| 21  | `src/components/admin/AdminComponents/CompaniesTable.tsx`   | 154 lines, no tests                                        | done       |
| 22  | `src/app/api/tracker/[id]/route.ts`                         | complexity 11                                              | pending    |
| 23  | `src/scripts/verify-domain-counts-coverage.ts`              | complexity 20 (script, low priority)                       | pending    |
| 24  | `src/app/api/test/e2e-login/route.ts`                       | complexity 13 (test helper, low priority)                  | pending    |

## Salary Page — Data Model Redesign (new initiative, split from row #17)

Started as row #17 ("176 lines, no tests"). Turned into a real scope change
after a design discussion — the refactor was deferred because the underlying
data model has structural problems that would make tests of the current
behavior worthless. Resume this in a new chat by pointing Claude at this file

- the repo and saying "read the Salary Page section of docs/AUDIT_STATUS.md
  and continue."

### Motivation (why this page exists at all)

Job Radar's core loop is reducing time-to-employed. Salary blindness is a
direct lever on that: a candidate who doesn't know market rate either
lowballs themselves into a bad offer or holds out too long negotiating
against a number they invented. Decision: **keep the page**, it belongs in
the system. Do not build it out further than the fixes below until
submission volume justifies more — the privacy floor (2+ reports per bucket)
means most buckets stay empty until there's real usage.

Public (non-authenticated) access to this page is a separate future decision,
explicitly deferred — not in scope for this initiative. Note for whoever
picks that up later: going public makes the privacy-floor argument _stronger_,
not weaker — do not lower it to compensate for a public audience.

### Findings from the design discussion (all verified against actual code,

### not assumed)

1. **Currency/location mixing — was assumed to be a problem, verified NOT
   to be one.** `aggregateSalaries()` in `src/app/api/salary/route.ts`
   already keys buckets on `currency` AND `pipeline` (local/global). A local
   EGP senior and a remote-global USD senior already cannot land in the same
   bucket. No fix needed here.
2. **`SalaryCurrency` type is missing SAR** (`src/lib/types.ts:263`) despite
   SAR being a common payout currency for Egypt-based remote workers. Real
   gap.
3. **`role_title` is free text used as the exact-match grouping key**
   (`src/app/api/salary/route.ts`, `aggregateSalaries`). "Senior Frontend
   Engineer" and "Sr. Frontend Engineer" never merge into the same bucket,
   which — combined with the privacy floor — means most buckets may never
   clear 2 reports. Fix does NOT require a schema change: `role_title` is
   already a plain text column, this is a frontend change (swap the free-text
   `<input>` in `SalaryPage.tsx`'s `Field` component for a `<select>` off a
   fixed role list). The fixed role list itself still needs to be defined —
   not done yet.
4. **`GET /api/salary` ignores `reported_at` entirely** — pulls the most
   recent 1000 rows total with no date filter, so a low-volume bucket can
   silently include a stale report from years ago sitting next to a fresh
   one, especially misleading given EGP's inflation. Fix: add a date filter
   (e.g. last 12 months) to the query in `src/app/api/salary/route.ts` and
   surface the date range on the chart.
5. **Currency conversion was considered and rejected.** Converting EGP to
   USD (or any cross-currency normalization) was the original instinct but
   is wrong given continuous EGP devaluation — a historical EGP amount
   converted at today's rate fabricates a number that never existed; converted
   at report-time rate it's stale the moment the rate moves again. Decision:
   **do not convert currency.** Keep buckets currency-segmented as they
   already are, just label sections clearly.
6. **Schema smell: `salary_egp` + `salary_usd` + `currency` is redundant.**
   `currency` already discriminates which currency a row is in; having
   separate amount columns per currency means every new currency (SAR, and
   whatever comes after) requires a new migration forever. Fix: collapse to
   a single `amount` column, keep `currency` as the sole discriminator.
   This is the one genuine schema migration in this initiative — see SQL
   status below.
7. **EUR/GBP client bug, now folded into the schema fix rather than
   patched separately**: `SalaryPage.tsx`'s `handleSubmit` only ever sets
   `salary_usd` when `currency === "USD"`, so EUR/GBP submissions silently
   lose the amount today (both `salary_egp` and `salary_usd` end up null).
   Fixed as a side effect of migrating to a single `amount` column instead
   of being patched in the old two-column shape.
8. **`sendSalaryReminderEmail()` in `src/lib/email.ts` is fully built
   (template + send function) but is called by nothing** — not
   `cron/route.ts`, not `runner.ts`, anywhere. The `salary_reminder_enabled`
   setting is persisted end-to-end in Settings but nothing ever reads it to
   decide whether to send. `reminder_sent_at` on `salary_reports` is written
   nowhere. **Decision: wire this up for real** (not leave dormant, not
   delete) — implementation not started yet.
9. **Privacy floor (`count < 2` suppression in `aggregateSalaries`) stays
   exactly as-is.** Considered and rejected lowering it — with n=1 you're
   not showing a market rate, you're showing one identifiable person's exact
   salary. Not changing this.

### SQL status

**Phase 1 (safe, additive) — ready to run, does not require schema info,
does not touch anything the app currently reads:**

```sql
ALTER TABLE salary_reports
  ADD COLUMN IF NOT EXISTS amount integer;

UPDATE salary_reports
SET amount = COALESCE(salary_egp, salary_usd)
WHERE amount IS NULL;
```

**Phase 2 (destructive — drop `salary_egp`/`salary_usd`, extend the
`currency` constraint to include SAR) — blocked on schema info.** Before
writing this, need the output of:

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'salary_reports';

SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'salary_reports'::regclass;

SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'salary_reports';
```

Reason: `currency` may be a Postgres `ENUM` type, a `CHECK` constraint, or
unconstrained — the ALTER statement differs for each, and there may be an
RLS policy referencing `salary_egp`/`salary_usd` by name that would break
silently if dropped blind.

### Remaining implementation steps, in checkpoint order

Each is its own checkpoint — build and confirm one before starting the next,
per the standing rule below.

1. Run Phase 1 SQL (user) + paste schema info back (user) → unblocks Phase 2 SQL (Claude)
2. Design + implement the reminder cron wiring: monthly cadence (matches
   existing email copy), gated on `salary_reminder_enabled`, tracks
   `reminder_sent_at` to avoid duplicate sends, hooked into existing
   `cron/route.ts` without disturbing the job-scraping pipeline. Needs tests.
3. Add the recency filter to `GET /api/salary`.
4. Define the fixed role list, replace the free-text `role_title` input with
   a `<select>` in `SalaryPage.tsx`.
5. Migrate `POST`/`GET` routes and `aggregateSalaries` from
   `salary_egp`/`salary_usd` to the unified `amount` column; add SAR
   end-to-end (type, form dropdown, API validation).
6. Run Phase 2 SQL (drop old columns) once `amount` is confirmed working.
7. Original row #17 work: split `SalaryPage.tsx` into a hook
   (`hooks/useSalaryReports.ts`), pure logic (`lib/salary-form.ts`), and
   subcomponents, matching the pattern already used for
   `SettingsForm`/`DefaultsForm`/`DashboardClient`. Add tests at the lib
   layer per the existing `vitest.config.ts` `include` scope.
8. Update `CHANGELOG.md` once any of the above ships.

## Standing rule for every item above

For each file: audit → fix → add/update tests → update docs if referenced in
`docs/ARCHITECTURE.md` → show Checked/Fixed/Open → confirm before moving to the next row.
Update this table's Status column when a row is done, and commit the update
alongside the code fix so the file and the repo state stay in sync.
