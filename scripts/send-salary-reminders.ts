#!/usr/bin/env tsx
// scripts/send-salary-reminders.ts
//
// Sends monthly salary update reminders to users whose last report
// is >28 days old. Run this as a separate cron job (e.g., monthly GitHub Action).
//
// Respects each user's `salary_reminder_enabled` setting (separate from
// `email_alerts_enabled`, which only gates job-match alerts — see
// docs/plans/2026-06-25-email-toggle-split-and-review-badge.md for why
// these were split into two toggles).
//
// Run with:
//   pnpm exec tsx scripts/send-salary-reminders.ts

import { createClient } from "@supabase/supabase-js";
import { sendSalaryReminderEmail } from "../src/lib/email";
import type { SalaryReport } from "../src/lib/types";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://job-radar-v2.vercel.app";
const REMIND_AFTER_DAYS = parseInt(process.env.REMIND_AFTER_DAYS ?? "28", 10);

async function run() {
  const cutoff = new Date(Date.now() - REMIND_AFTER_DAYS * 86_400_000).toISOString();

  // Default fallback for users with no user_settings row, or a null value
  // in it — mirrors lib/settings.ts's resolveUserSettings merge rule for
  // this field (user value wins when non-null, default otherwise). Can't
  // reuse resolveUserSettings directly: it calls createServerClient(),
  // which reads next/headers cookies() and throws outside a request
  // context — this script runs standalone via tsx, not as a route handler.
  const { data: defaultRow } = await supabase
    .from("default_settings")
    .select("salary_reminder_enabled")
    .eq("id", 1)
    .single();
  const defaultSalaryReminderEnabled = defaultRow?.salary_reminder_enabled ?? true;

  // Step 1: Fetch stale salary reports with user_profiles join.
  // Note: salary_reports has no FK to user_settings, so we can't join
  // user_settings here. We fetch settings separately in Step 2.
  const { data: reports, error } = await supabase
    .from("salary_reports")
    .select(
      `
      id, user_id, role_title, last_updated_at, reminder_sent_at,
      user_profiles!inner(email, is_active)
    `,
    )
    .lt("last_updated_at", cutoff)
    .or(`reminder_sent_at.is.null,reminder_sent_at.lt.${cutoff}`)
    .not("user_id", "is", null)
    .order("last_updated_at", { ascending: true });

  if (error) {
    console.error("Failed to fetch reports:", error.message);
    process.exit(1);
  }

  if (!reports?.length) {
    console.log("No reminders to send.");
    return;
  }

  // Step 2: Fetch user_settings for the affected users.
  // salary_reports and user_settings are both children of user_profiles,
  // so we query settings separately and merge in code.
  const userIds = [...new Set(reports.map((r) => r.user_id))];
  const { data: settingsRows } = await supabase
    .from("user_settings")
    .select("user_id, salary_reminder_enabled")
    .in("user_id", userIds);
  const settingsMap = new Map(
    (settingsRows ?? []).map((s) => [s.user_id, s.salary_reminder_enabled]),
  );

  // Step 3: Deduplicate and filter — one reminder per user (their most-recent report)
  const seenUsers = new Set<string>();
  const toRemind = reports.filter((r) => {
    const profile = (r as Record<string, unknown>).user_profiles as {
      email: string;
      is_active: boolean;
    } | null;
    if (!r.user_id || !profile?.email || !profile.is_active) return false;
    if (seenUsers.has(r.user_id)) return false;

    const salaryReminderEnabled = settingsMap.get(r.user_id) ?? defaultSalaryReminderEnabled;
    if (!salaryReminderEnabled) return false;

    seenUsers.add(r.user_id);
    return true;
  });

  console.log(`Sending ${toRemind.length} salary reminders...`);
  let sent = 0;

  for (const r of toRemind) {
    const profile = (r as Record<string, unknown>).user_profiles as { email: string };

    try {
      await sendSalaryReminderEmail(
        r as unknown as SalaryReport,
        profile.email,
        `${APP_URL}/salary`,
      );

      // Update reminder_sent_at
      await supabase
        .from("salary_reports")
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq("id", r.id);

      sent++;
      console.log(`  ✓ Reminded ${profile.email}`);
    } catch (err) {
      console.error(`  ✗ Failed for ${profile.email}:`, err);
    }
  }

  console.log(`\nDone. ${sent}/${toRemind.length} reminders sent.`);
}

run().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
