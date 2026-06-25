# Resolution: Split email-alerts toggle into two; add review badge to alert email

**Status: implemented.** Found during the JD-truncation fix review when the
salary-reminder cron toggle was checked. Two related fixes, bundled here
because both touch the same toggle/email surface.

## Bug found

`SettingsForm.tsx`'s single "Email Alerts" toggle (`email_alerts_enabled`)
is correctly gated for job-match alerts —
`dashboard/route.ts`: `if (hadPreviousCache && settings.email_alerts_enabled && user.email)`
before calling `sendJobAlertEmail`.

It is **not** gated for the monthly salary-reminder cron at all.
`scripts/send-salary-reminders.ts` queried `salary_reports` joined only to
`user_profiles(email, is_active)` — it never read `user_settings` or
`email_alerts_enabled`. Anyone whose report was stale and whose account was
active got the reminder, full stop.

The toggle's own UI copy claimed otherwise:
_"Also includes a monthly reminder to update your salary report."_
A user who disabled the toggle to stop job alerts was still getting the
monthly salary nag every 1st of the month — the UI promised behavior the
backend never implemented.

## Decision: two independent toggles, not one

Job alerts and salary reminders are different products: frequent/personalized
vs. monthly/community-contribution-nudge. Coupling them under one switch
means a user who wants one but not the other has no way to express that —
the realistic failure mode is someone gets annoyed by one and kills both,
including the one they'd have kept. The fix to wire _something_ into the
salary script was required regardless of which design was chosen; splitting
costs one extra boolean column and one extra UI toggle on top of that
baseline.

## Implementation

### Schema (manual migration — this repo doesn't track migrations in

`supabase/`; run directly against the project)

```sql
alter table public.user_settings
  add column if not exists salary_reminder_enabled boolean;

alter table public.default_settings
  add column if not exists salary_reminder_enabled boolean not null default true;

update public.default_settings set salary_reminder_enabled = true where id = 1;
```

`user_settings.salary_reminder_enabled` is nullable, matching every other
per-user override field's convention (null = inherit default).
`default_settings.salary_reminder_enabled` is `NOT NULL DEFAULT true` —
existing users keep getting reminders unless they explicitly opt out, same
as `email_alerts_enabled`'s rollout.

### `src/lib/types.ts`

Added `salary_reminder_enabled` to `DefaultSettings`, `UserSettingsRow`
(nullable), `ResolvedSettings`.

### `src/lib/settings.ts`

- `FALLBACK_DEFAULTS.salary_reminder_enabled = true`.
- Both the `uses_defaults` branch and `mergeWithDefaults` resolve it as
  `userRow.salary_reminder_enabled ?? defaults.salary_reminder_enabled` —
  same merge rule as `email_alerts_enabled`: respected even when the user
  is otherwise on platform defaults for skills/prompt/etc.
- Added to `saveUserSettings`'s `allowed` whitelist.

### `src/components/settings/SettingsForm.tsx`

Split the single Toggle into two, both still under the "Email Alerts"
section heading:

- "Email me when new matches are found" — copy trimmed to drop the
  salary-reminder claim.
- "Monthly salary update reminder" — new toggle, new state, included in the
  PATCH body.

### `scripts/send-salary-reminders.ts`

- Query now embeds `user_settings(salary_reminder_enabled)` alongside the
  existing `user_profiles!inner(email, is_active)` embed.
- Fetches `default_settings.salary_reminder_enabled` once up front as the
  fallback for users with no `user_settings` row (just signed up, never
  opened `/settings`) or a null value in it.
- Filter step resolves per-row: `settingsRow?.[0]?.salary_reminder_enabled ?? defaultSalaryReminderEnabled`.
  The `?.[0]` handles Supabase embedding a to-one relation as a one-element
  array — same shape correction already applied to
  `AdminUserListItem.user_settings` in Phase 2 of the original audit.
- Could not reuse `resolveUserSettings()` directly: it calls
  `createServerClient()`, which reads `next/headers`' `cookies()` and throws
  outside a request context. This script runs standalone via `tsx`, not as
  a route handler — same constraint `settings.test.ts` already works around
  by stubbing `next/headers` for _tests_, which isn't an option for a
  script that has to run for real in CI.

### `src/lib/email.ts` (separate but related finding)

The alert email shows `total_score` and calls jobs "matches" with no
indication of whether Gemini ever evaluated them. `gemini_reviewed` /
`gemini_quota_exhausted` already exist and already drive a badge on the
dashboard and detail page (see `2026-06-25-jd-truncation-resolution.md`) —
the email was the one surface that didn't get it. Added a `reviewBadge(job)`
helper mirroring the same two cases and copy, inline-styled for email-client
compatibility, rendered after the score bar and before matched skills on
each job card — same position as `JobCard.tsx`.

Score itself isn't "wrong" in these cases — `total_score` is a pure
skill/recency/relocation calculation, independent of Gemini review status —
but presenting it without the caveat overstates how vetted the match is.

## Validation

- `tsc --noEmit` clean
- `eslint` + `prettier` clean
- vitest: 77/77 (extended `settings.test.ts`'s existing cases rather than
  adding new ones — asserts the new field defaults correctly, resolves
  independently of `email_alerts_enabled` when overridden, and falls back
  to the hardcoded default when the DB is unreachable)
- `next build` successful, all 30 routes
- No test added for `send-salary-reminders.ts` or `email.ts` — neither had
  any prior coverage (consistent with how Bug 4 and Feature Request 2 in
  the original audit left equivalent pre-existing gaps untouched). Still
  tracked as the "Email path" test in the Roadmap's Tier 1 Playwright suite.

## Not done here

- The Tier 1 Playwright "Email path" smoke test (mock
  `nodemailer.createTransport`, assert `sendMail` shape) — this would have
  caught the original gating bug mechanically. Still pending, still
  sequenced where the Roadmap already put it.
- No backfill/notification to existing users that this toggle now actually
  works as described — anyone who already turned off "Email Alerts"
  expecting it to cover both will keep getting salary reminders until they
  visit `/settings` again and see the new second toggle (default `true`).
