// src/lib/email.ts
// FIX #4: Email alerts fire for ALL new jobs regardless of mode.
//         Old code only sent alerts for mode === "visa".
//
// Also handles monthly salary reminder emails.
// Uses the same SMTP env vars as the old email.ts.

import nodemailer from "nodemailer";
import type { SalaryReport } from "./types";

// ── Transporter (shared) ─────────────────────────────────────

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST!,
    port: parseInt(process.env.SMTP_PORT ?? "587", 10),
    secure: parseInt(process.env.SMTP_PORT ?? "587", 10) === 465,
    auth: {
      user: process.env.SMTP_USER!,
      pass: process.env.SMTP_PASS!,
    },
  });
}

/**
 * Sends a generic "scan complete" notification after a cron run.
 * No job listings are included — users open the dashboard to see
 * their personalized (post-Gemini) results. This avoids the mismatch
 * where email showed pre-Gemini jobs that the dashboard later filtered.
 *
 * @param companiesScanned  Number of companies scanned this run
 * @param recipient         Email address to send to
 */
export async function sendNewScanNotificationEmail(
  companiesScanned: number,
  recipient: string,
): Promise<void> {
  const transporter = createTransporter();
  const dashboardUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://job-radar-v2.vercel.app";

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#08080f;font-family:Inter,system-ui,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:32px 16px">
        <table width="600" cellpadding="0" cellspacing="0"
               style="background:#0d0d1a;border-radius:12px;overflow:hidden;border:1px solid #1e1e30">

          <!-- Header -->
          <tr>
            <td style="padding:24px 32px;background:#0f0f20;border-bottom:1px solid #1e1e30">
              <h1 style="margin:0;color:#e2e8f0;font-size:22px">🎯 Job Radar — New scan complete</h1>
              <p style="margin:6px 0 0;color:#64748b;font-size:13px">
                ${new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px">
              <p style="margin:0 0 16px;color:#94a3b8;font-size:14px;line-height:1.6">
                We just scanned <strong style="color:#818cf8">${companiesScanned} companies</strong>
                for new job postings. Your personalized feed has been updated.
              </p>
              <p style="margin:0 0 24px;color:#94a3b8;font-size:14px;line-height:1.6">
                Open your dashboard to see matches filtered by your skills,
                preferences, and Gemini prompt.
              </p>
              <a href="${dashboardUrl}/dashboard"
                 style="display:inline-block;padding:12px 28px;background:#6366f1;
                        color:#fff;text-decoration:none;border-radius:8px;
                        font-weight:600;font-size:14px">
                Open your dashboard →
              </a>
              <p style="margin:24px 0 0;color:#475569;font-size:12px">
                Your results are filtered by your own settings — what you see
                in the dashboard is what matches your profile.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px;background:#0f0f20;border-top:1px solid #1e1e30;text-align:center">
              <p style="margin:0;color:#475569;font-size:12px">
                Job Radar · Sent to ${recipient} ·
                <a href="${dashboardUrl}/settings" style="color:#64748b">Manage email preferences</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  await transporter.sendMail({
    from: `"Job Radar" <${process.env.SMTP_USER}>`,
    to: recipient,
    subject: "🎯 Job Radar — New jobs available, check your dashboard",
    html,
  });
}

// ── Salary reminder email ─────────────────────────────────────

// ── PATCH: replace the two existing salary-reminder functions in src/lib/email.ts ──
// Do NOT copy this whole file. Find `function buildSalaryReminderHtml` and
// `export async function sendSalaryReminderEmail` in your local email.ts and
// replace both with what's below.

function buildSalaryReminderHtml(report: SalaryReport | null, updateUrl: string): string {
  // No existing report — generic first-time prompt.
  if (!report) {
    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#08080f;font-family:Inter,system-ui,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:32px 16px">
        <table width="500" cellpadding="0" cellspacing="0"
               style="background:#0d0d1a;border-radius:12px;overflow:hidden;border:1px solid #1e1e30">
          <tr>
            <td style="padding:32px;text-align:center">
              <p style="margin:0 0 8px;font-size:32px">💼</p>
              <h2 style="margin:0 0 12px;color:#e2e8f0;font-size:20px">
                Share your salary data
              </h2>
              <p style="margin:0 0 24px;color:#94a3b8;font-size:14px;line-height:1.6">
                You haven't submitted a salary report yet.
                It takes less than a minute and helps every developer in the community
                get compensated fairly.
              </p>
              <a href="${updateUrl}"
                 style="display:inline-block;padding:12px 28px;background:#6366f1;
                        color:#fff;text-decoration:none;border-radius:8px;
                        font-weight:600;font-size:14px">
                Add my salary →
              </a>
              <p style="margin:24px 0 0;color:#475569;font-size:12px">
                All salary data is anonymous and helps calibrate the community benchmark.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  // Existing stale report — specific "time to update" prompt.
  const monthsAgo = Math.round(
    (Date.now() - Date.parse(report.last_updated_at)) / (1000 * 60 * 60 * 24 * 30),
  );

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#08080f;font-family:Inter,system-ui,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:32px 16px">
        <table width="500" cellpadding="0" cellspacing="0"
               style="background:#0d0d1a;border-radius:12px;overflow:hidden;border:1px solid #1e1e30">
          <tr>
            <td style="padding:32px;text-align:center">
              <p style="margin:0 0 8px;font-size:32px">💼</p>
              <h2 style="margin:0 0 12px;color:#e2e8f0;font-size:20px">
                Time to update your salary data
              </h2>
              <p style="margin:0 0 24px;color:#94a3b8;font-size:14px;line-height:1.6">
                Your last salary report for <strong style="color:#c7d2fe">${report.role_title}</strong>
                was submitted ${monthsAgo} month${monthsAgo !== 1 ? "s" : ""} ago.
                Keeping it current helps every developer in the community get compensated fairly.
              </p>
              <a href="${updateUrl}"
                 style="display:inline-block;padding:12px 28px;background:#6366f1;
                        color:#fff;text-decoration:none;border-radius:8px;
                        font-weight:600;font-size:14px">
                Update my salary →
              </a>
              <p style="margin:24px 0 0;color:#475569;font-size:12px">
                If your salary hasn't changed, your existing entry is already counted.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Sends a monthly salary reminder to a user.
 * - `report` is their most recent salary report, or null if they haven't submitted one yet.
 * - When null, the email is a generic first-time prompt; when present, it references
 *   the specific report and how long ago it was submitted.
 */
export async function sendSalaryReminderEmail(
  report: SalaryReport | null,
  email: string,
  updateUrl: string,
): Promise<void> {
  const transporter = createTransporter();
  const subject = report
    ? "💼 Update your salary data — help others get paid fairly"
    : "💼 Add your salary data — help others get paid fairly";

  await transporter.sendMail({
    from: `"Job Radar" <${process.env.SMTP_USER}>`,
    to: email,
    subject,
    html: buildSalaryReminderHtml(report, updateUrl),
  });
}
