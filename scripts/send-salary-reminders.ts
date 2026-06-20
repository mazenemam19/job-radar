#!/usr/bin/env tsx
// scripts/send-salary-reminders.ts
//
// Sends monthly salary update reminders to users whose last report
// is >28 days old. Run this as a separate cron job (e.g., monthly GitHub Action).
//
// Run with:
//   pnpm exec tsx scripts/send-salary-reminders.ts

import { createClient } from "@supabase/supabase-js";
import { sendSalaryReminderEmail } from "../src/lib/v2/email";
import type { SalaryReport } from "../src/lib/v2/types";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://job-radar-v2.vercel.app";
const REMIND_AFTER_DAYS = 28;

async function run() {
  const cutoff = new Date(Date.now() - REMIND_AFTER_DAYS * 86_400_000).toISOString();

  // Find most-recent salary report per user where last_updated_at is old
  // and they haven't been reminded in the last 28 days
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

  // Deduplicate: one reminder per user (their most-recent report)
  const seenUsers = new Set<string>();
  const toRemind = reports.filter((r) => {
    const profile = (r as Record<string, unknown>).user_profiles as {
      email: string;
      is_active: boolean;
    } | null;
    if (!r.user_id || !profile?.email || !profile.is_active) return false;
    if (seenUsers.has(r.user_id)) return false;
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
        `${APP_URL}/v2/salary`,
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
