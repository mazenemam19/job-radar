#!/usr/bin/env tsx
// scripts/send-salary-reminders.ts
//
// Sends monthly salary reminders to all users who have salary_reminder_enabled.
// Eligibility is driven by the user preference — not by whether they already
// have a salary_reports entry.
//
// - Users WITH an existing (stale) report → specific "time to update" email.
// - Users with NO report yet              → generic "share your salary data" prompt.
//
// Respects each user's `salary_reminder_enabled` setting (separate from
// `email_alerts_enabled`, which only gates job-match alerts — see
// docs/plans/2026-06-25-email-toggle-split-and-review-badge.md).
//
// Run with:
//   pnpm exec tsx scripts/send-salary-reminders.ts

import { config } from "dotenv";
import path from "path";

config({ path: path.resolve(process.cwd(), ".env.local") });

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
  const salaryUrl = `${APP_URL}/salary`;

  // Step 1: Platform default for salary_reminder_enabled.
  // Can't reuse resolveUserSettings() — it calls createServerClient() which reads
  // next/headers cookies() and throws outside a request context.
  const { data: defaultRow } = await supabase
    .from("default_settings")
    .select("salary_reminder_enabled")
    .eq("id", 1)
    .single();
  const defaultSalaryReminderEnabled = defaultRow?.salary_reminder_enabled ?? true;

  // Step 2: All active, onboarded users with their notification preference.
  const { data: users, error: usersError } = await supabase
    .from("user_profiles")
    .select("id, email, user_settings(salary_reminder_enabled)")
    .eq("is_active", true)
    .eq("onboarding_complete", true);

  if (usersError) {
    console.error("Failed to fetch users:", usersError.message);
    process.exit(1);
  }

  if (!users?.length) {
    console.log("No active users found.");
    return;
  }

  // Step 3: Keep only users who want salary reminders.
  // Supabase types the joined user_settings as an array (FK from parent side),
  // so we cast through unknown and handle both shapes defensively.
  const eligible = users.filter((u) => {
    const raw = u.user_settings as unknown as
      | { salary_reminder_enabled: boolean | null }[]
      | { salary_reminder_enabled: boolean | null }
      | null;
    const settings = Array.isArray(raw) ? (raw[0] ?? null) : raw;
    return settings?.salary_reminder_enabled ?? defaultSalaryReminderEnabled;
  });

  if (!eligible.length) {
    console.log("No users with salary reminders enabled.");
    return;
  }

  // Step 4: Fetch the most-recent salary report for each eligible user (if any).
  const eligibleIds = eligible.map((u) => u.id);
  const { data: allReports } = await supabase
    .from("salary_reports")
    .select("id, user_id, role_title, last_updated_at, reminder_sent_at")
    .in("user_id", eligibleIds)
    .order("last_updated_at", { ascending: false });

  type ReportEntry = NonNullable<typeof allReports>[number];
  const reportByUser = new Map<string, ReportEntry>();
  for (const r of allReports ?? []) {
    if (r.user_id && !reportByUser.has(r.user_id)) {
      reportByUser.set(r.user_id, r);
    }
  }

  // Step 5: Send.
  console.log(`Processing ${eligible.length} eligible users...`);
  let sent = 0;

  for (const user of eligible) {
    if (!user.email) continue;

    const report = reportByUser.get(user.id) ?? null;

    if (report) {
      // Has a report: skip if still fresh or reminded recently.
      const reportStale = report.last_updated_at < cutoff;
      const reminderStale = !report.reminder_sent_at || report.reminder_sent_at < cutoff;
      if (!reportStale || !reminderStale) continue;
    }
    // No report: always send — monthly nudge until they submit their first entry.

    try {
      await sendSalaryReminderEmail(report as SalaryReport | null, user.email, salaryUrl);

      if (report) {
        await supabase
          .from("salary_reports")
          .update({ reminder_sent_at: new Date().toISOString() })
          .eq("id", report.id);
      }

      sent++;
      console.log(`  ✓ ${user.email}${report ? "" : " (first-time prompt)"}`);
    } catch (err) {
      console.error(`  ✗ Failed for ${user.email}:`, err);
    }
  }

  console.log(`\nDone. ${sent}/${eligible.length} reminders sent.`);
}

run().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
