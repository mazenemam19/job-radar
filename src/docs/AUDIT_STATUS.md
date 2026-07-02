# Code Health Audit — Status

Last updated: 2026-07-02 (row #8 closed)
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

- 17/19 components in `src/components` have zero test files. `SettingsForm.tsx` and
  `DefaultsForm.tsx` are exceptions in substance, not in count: each was split into a
  thin render layer, a stateful hook (`hooks/useSettingsForm.ts` /
  `hooks/useDefaultsForm.ts`), and pure logic (`lib/settings-form.ts` /
  `lib/defaults-form.ts`) — only the lib layer has a test file, but it now holds all
  the CSV-parsing/hydration/payload-building logic that used to be inline and
  untested. Neither component nor either hook has a direct test file;
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
    `admin/users`, `admin/users/[id]`, `admin/submissions`, `admin/submissions/[id]`,
    `admin/test-ats`, `admin/defaults`, `cron`, `tracker/[id]`, `settings`,
    `strategy`, `dashboard`.
- `src/pages/_document.js` — Pages Router leftover in an App Router project.
  Status: unverified whether it's dead code or load-bearing. Check before deleting.
- Two test files themselves exceed the new size rules (`scoring.test.ts` 468 lines,
  one 163-line function in `settings.test.ts`). Lower priority than untested files.

## Fix queue — priority order (by complexity/size severity)

Status column: `pending` / `in progress` / `done`

| #   | File                                                        | Issue                                           | Status  |
| --- | ----------------------------------------------------------- | ----------------------------------------------- | ------- |
| 1   | `src/app/api/admin/defaults/route.ts`                       | complexity 47                                   | done    |
| 2   | `src/lib/sources/ats-utils.ts`                              | 815 lines, complexity 16                        | done    |
| 3   | `src/components/settings/SettingsForm.tsx`                  | 605 lines, complexity 21, 29 useState, no tests | done    |
| 4   | `src/app/api/admin/companies/[id]/route.ts`                 | complexity 26                                   | done    |
| 5   | `src/lib/runner.ts`                                         | complexity 24, 160-line function                | done    |
| 6   | `src/lib/settings.ts`                                       | complexity 23 (`mergeWithDefaults`)             | done    |
| 7   | `src/components/admin/AdminComponents/DefaultsForm.tsx`     | 320 lines, complexity 21, no tests              | done    |
| 8   | `src/lib/ats-bridge.ts`                                     | complexity 21                                   | done    |
| 9   | `src/components/dashboard/JobCard.tsx`                      | 171 lines, complexity 19, no tests              | pending |
| 10  | `src/app/api/admin/submissions/[id]/route.ts`               | complexity 16                                   | pending |
| 11  | `src/components/admin/AdminComponents/SubmissionsTable.tsx` | complexity 14                                   | pending |
| 12  | `src/lib/scoring.ts`                                        | complexity 14 (`passesSettingsGate`)            | pending |
| 13  | `src/app/job/[id]/page.tsx`                                 | 201 lines, complexity 14                        | pending |
| 14  | `src/components/dashboard/DashboardClient.tsx`              | 172 lines, complexity 14                        | pending |
| 15  | `src/lib/gemini.ts`                                         | 3 functions over complexity 10                  | pending |
| 16  | `src/components/landing/LandingContent.tsx`                 | 203 lines                                       | pending |
| 17  | `src/components/salary/SalaryPage.tsx`                      | 176 lines, no tests                             | pending |
| 18  | `src/app/api/dashboard/route.ts`                            | complexity 13                                   | pending |
| 19  | `src/app/api/salary/route.ts`                               | complexity 13 (x2)                              | pending |
| 20  | `src/app/api/submit/route.ts`                               | complexity 13                                   | pending |
| 21  | `src/components/admin/AdminComponents/CompaniesTable.tsx`   | 154 lines, no tests                             | pending |
| 22  | `src/app/api/tracker/[id]/route.ts`                         | complexity 11                                   | pending |
| 23  | `src/scripts/verify-domain-counts-coverage.ts`              | complexity 20 (script, low priority)            | pending |
| 24  | `src/app/api/test/e2e-login/route.ts`                       | complexity 13 (test helper, low priority)       | pending |

## Standing rule for every item above

For each file: audit → fix → add/update tests → update docs if referenced in
`ARCHITECTURE.md` → show Checked/Fixed/Open → confirm before moving to the next row.
Update this table's Status column when a row is done, and commit the update
alongside the code fix so the file and the repo state stay in sync.
