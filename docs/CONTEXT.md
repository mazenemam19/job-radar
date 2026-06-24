# Job Radar — Agent & Contributor Context

Read this before touching any code. It is intentionally short — the full
domain detail lives in `ARCHITECTURE.md`. This file answers the "what is this,
what are the rules, where does everything live" questions that stop an agent
cold in the first five minutes.

---

## What this codebase is

A multi-tenant job-hunting SaaS. One shared cron job scrapes every job posted
by ATS-listed companies; each user then filters and scores that shared pool
against their own settings (skills, seniority, keyword rules, Gemini prompt).
The result is a personal ranked feed, not a global one. See `ARCHITECTURE.md`
for the full data model, request flows, and filtering pipeline.

---

## Domain glossary

| Term                    | Meaning                                                                                                                                                                                                    |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **raw pool**            | `raw_jobs` table — the shared scraped job store, written by the cron job, read (never written) by user dashboard rebuilds.                                                                                 |
| **user cache**          | `user_jobs_cache` — one row per user holding their fully scored, Gemini-filtered job list. Rebuilt lazily on dashboard load when stale.                                                                    |
| **Lazy C rebuild**      | The per-user cache rebuild in `/api/dashboard`: load settings → date gate → settings gate → Gemini gate → score → upsert cache.                                                                            |
| **service-role client** | `createAdminClient()` in `src/lib/supabase/admin.ts`. Bypasses RLS entirely. Use only for cron writes, admin routes, and global (non-user-owned) tables. Never expose to the browser.                      |
| **server client**       | `createServerClient()` in `src/lib/supabase/server.ts`. Anon key + RLS enforced. Use for all user-owned table reads/writes.                                                                                |
| **resolved settings**   | Output of `resolveUserSettings()` — `user_settings` merged over `default_settings`, field by field. The merged object is what the scoring pipeline consumes.                                               |
| **pipeline**            | One of `visa`, `local`, `global` — each job is tagged with the pipeline it belongs to; users can toggle each pipeline on/off in their settings.                                                            |
| **ATS**                 | Applicant Tracking System — Greenhouse, Lever, Ashby, Workable, Teamtailor, Breezy, SmartRecruiters, BambooHR, JazzHR. Each has a dedicated fetcher in `src/lib/sources/ats-utils.ts`.                     |
| **date_unknown**        | Flag on `raw_jobs` rows where the ATS returned no parseable posted date. These rows age from `fetched_at` instead of `posted_at` so they don't become immortal.                                            |
| **CRON_SECRET**         | Shared secret gating `/api/cron`. Machine-to-machine only (GitHub Actions / manual curl). Never referenced in any client-rendered code.                                                                    |
| **default_settings**    | Single admin-editable row (`id = 1`) used as the fallback for every user-settings field. Not user-owned; stays on the service-role client.                                                                 |
| **uses_defaults**       | Per-user flag: when `true`, the user's `expert_skills` and `gemini_filter_prompt` always come from `default_settings`, but their pipeline toggles, seniority, and keyword rules remain personal overrides. |

---

## Hard rules (from `.agents/AGENTS.md`, expanded here)

1. **No `any` or `as any`**, anywhere. Use `unknown` + type guards, or define
   proper interfaces. TypeScript strict mode is on; `tsc --noEmit` must pass
   clean before every commit.
2. **`createAdminClient()` is server-only** and must never appear in
   client-rendered code (`"use client"` files, browser-side hooks, or anything
   imported from the `app/` tree other than route handlers). It bypasses RLS —
   a client-side leak is a full data breach.
3. **`role` is write-protected** at the application layer: `/api/settings` PATCH
   strips any client-supplied `role` field, and `/auth/callback` never sets it.
   The only way to grant admin is direct DB access with the service-role key.
4. **Ingestion is role-agnostic.** Do not add title/role/skill filtering in
   `processJobs()` or the ATS fetchers. That gate was deliberately removed when
   the app went multi-tenant; all role filtering belongs in the per-user scoring
   pipeline (`scoring.ts`/`settings.ts`).
5. **Tailwind for styling, not inline `style={{}}`**, except for data-driven
   values (hex colors, percentages, conic gradients) and third-party component
   `style` props (e.g. Recharts `contentStyle`). Static values that could be a
   Tailwind class must be Tailwind classes.
6. **Form controls need real labels.** Every `<input>`, `<select>`, and
   `<textarea>` must have a matching `<label htmlFor>` / `id` pair. Icon-only
   controls need an `aria-label`. No unlabelled controls.
7. **Shared constants live in `src/lib/constants.ts`, shared types in
   `src/lib/types.ts`, shared auth logic in `src/lib/auth.ts`.** Do not
   redeclare `VALID_ATS`, `VALID_STATUSES`, `requireAdmin()`, or the shared
   domain interfaces in individual route files.

---

## Validation gates (run in this order before every commit)

```bash
npx tsc --noEmit          # must exit 0, zero errors
npx vitest run            # must exit 0, all tests passing
npx eslint --fix src/     # fix auto-fixable issues, zero remaining errors
npx next build            # must succeed, all routes compiled
```

The pre-commit hook runs `tsc --noEmit` and `lint-staged` (eslint --fix +
prettier on staged files). The pre-push hook runs `vitest run` against every
commit about to be pushed.

**After any str_replace or multi-step edit: `git diff` every touched file and
read each hunk before running validation.** `tsc` and `eslint` do not catch
deleted `return` statements in Next.js route handlers (no enforced return type).

---

## Key file map

| What you want               | Where it lives                                                   |
| --------------------------- | ---------------------------------------------------------------- |
| Add a shared type           | `src/lib/types.ts`                                               |
| Add a shared constant       | `src/lib/constants.ts`                                           |
| Add/change admin route auth | `src/lib/auth.ts` (`requireAdmin()`)                             |
| Add a DB error response     | `src/lib/api-errors.ts` (`dbErrorResponse()`)                    |
| Change scraping logic       | `src/lib/sources/ats-utils.ts`, `src/lib/ats-bridge.ts`          |
| Change scoring/filtering    | `src/lib/scoring.ts`                                             |
| Change settings resolution  | `src/lib/settings.ts`                                            |
| Change per-user route       | `src/app/api/<route>/route.ts` — use `createServerClient()`      |
| Change admin route          | `src/app/api/admin/<route>/route.ts` — use `createAdminClient()` |
| Change admin UI             | `src/components/admin/AdminComponents/`                          |
| Add/change a modal          | Use `ModalShell` + `useDialogA11y` from `src/components/ui/`     |

---

## What to read next

- `ARCHITECTURE.md` — full system design, data model, request flows, security
  model, environment variables.
- `docs/plans/` — per-phase decision logs (why each change was made, what was
  excluded and why).
- `docs/solutions/` — retroactive write-ups for non-obvious bugs (the kind
  where the fix is one line but finding the right line took an hour).
- `src/lib/__tests__/` — regression tests; comments above each test group
  describe the original bug and what the old behaviour was.
