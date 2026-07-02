// src/lib/cron/send-scan-notifications.ts
// Sends "scan complete" notification emails to all eligible users after a
// cron run. No job listings included — users open the dashboard to see
// their personalized (post-Gemini) results. This avoids the mismatch where
// email showed pre-Gemini jobs but the dashboard later filtered them.
// Extracted from runner.ts to keep runCronJob's own complexity down.

import type { createAdminClient } from "../supabase/admin";
import type { EmailSendResult } from "../types";

type AdminDb = ReturnType<typeof createAdminClient>;

export interface SendScanNotificationsResult {
  emailResults: EmailSendResult[];
  errors: string[];
}

/**
 * Sends the scan-complete email to every active, onboarded user who hasn't
 * opted out of email alerts. No-op if no companies were scanned this run.
 */
export async function sendScanNotifications(
  db: AdminDb,
  companiesScanned: number,
): Promise<SendScanNotificationsResult> {
  const emailResults: EmailSendResult[] = [];
  const errors: string[] = [];

  if (companiesScanned <= 0) return { emailResults, errors };

  const { data: eligibleUsers } = await db
    .from("user_profiles")
    .select("email, user_settings(email_alerts_enabled)")
    .eq("is_active", true)
    .eq("onboarding_complete", true); // exclude users who haven't finished setup

  if (!eligibleUsers?.length) {
    console.log("[cron email] 0 eligible users for scan notification");
    return { emailResults, errors };
  }

  const { sendNewScanNotificationEmail } = await import("@/lib/email");

  for (const raw of eligibleUsers) {
    const u = raw as Record<string, unknown>;
    const settings = u.user_settings as { email_alerts_enabled: boolean | null } | null;
    const emailAlertsEnabled = settings?.email_alerts_enabled ?? true;

    if (!emailAlertsEnabled || !u.email) {
      console.log(
        `[cron email] ⊘ skipped ${u.email ?? "(no email)"} (alerts disabled=${!emailAlertsEnabled})`,
      );
      continue;
    }

    try {
      console.log(`[cron email] → sending scan notification to ${u.email}`);
      await sendNewScanNotificationEmail(companiesScanned, u.email as string);
      console.log(`[cron email] ✓ sent to ${u.email}`);
      emailResults.push({ email: u.email as string, sent: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[cron email] ✗ failed for ${u.email}: ${msg}`);
      emailResults.push({ email: u.email as string, sent: false, error: msg });
      errors.push(`Email failed for ${u.email}: ${msg}`);
    }
  }

  console.log(
    `[cron email] summary: ${emailResults.filter((r) => r.sent).length} sent, ${emailResults.filter((r) => !r.sent).length} failed`,
  );

  return { emailResults, errors };
}
