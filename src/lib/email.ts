// src/lib/email.ts
// FIX #4: Email alerts fire for ALL new jobs regardless of mode.
//         Old code only sent alerts for mode === "visa".
//
// Also handles monthly salary reminder emails.
// Uses the same SMTP env vars as the old email.ts.

import nodemailer from "nodemailer";
import type { ScoredJob, SalaryReport } from "./types";

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

// ── Helpers ──────────────────────────────────────────────────

function scoreBar(score: number): string {
  const filled = Math.round(score / 10);
  return "█".repeat(filled) + "░".repeat(10 - filled);
}

function modeLabel(mode: "visa" | "local" | "global"): string {
  return { visa: "✈️ Visa", local: "🇪🇬 Local", global: "🌐 Remote" }[mode];
}

const PIPELINE_COLOR: Record<string, string> = {
  visa: "#6366f1",
  local: "#22c55e",
  global: "#f59e0b",
};

// ── Job alert email ───────────────────────────────────────────

function reviewBadge(job: ScoredJob): string {
  // Mirrors JobCard.tsx / job/[id]/page.tsx's badge logic — same two cases,
  // same copy, inline-styled for email client compatibility. Without this,
  // a recipient sees a score and a "match" with no indication that Gemini
  // never actually evaluated the job (no key, or every model hit a quota
  // error) — the score itself is still real (skill+recency, computed
  // independently of Gemini), but it hasn't had the semantic sanity check
  // Gemini provides on top of the keyword/regex gates.
  if (job.gemini_quota_exhausted) {
    return `<br><span style="display:inline-block;margin-top:4px;padding:2px 8px;border-radius:999px;background:rgba(245,158,11,0.12);color:#f59e0b;font-size:11px">⚠ Gemini quota exhausted</span>`;
  }
  if (!job.gemini_reviewed) {
    return `<br><span style="display:inline-block;margin-top:4px;padding:2px 8px;border-radius:999px;background:rgba(245,158,11,0.12);color:#f59e0b;font-size:11px">⚠ Not AI-reviewed</span>`;
  }
  return "";
}

function buildJobAlertHtml(jobs: ScoredJob[], recipientEmail: string): string {
  // Group by mode for presentation
  const byMode: Record<string, ScoredJob[]> = {};
  for (const job of jobs) {
    if (!byMode[job.mode]) byMode[job.mode] = [];
    byMode[job.mode].push(job);
  }

  const sections = Object.entries(byMode)
    .map(([mode, modeJobs]) => {
      const cards = modeJobs
        .slice(0, 10) // max 10 per pipeline in email
        .map(
          (job) => `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #1e1e30">
            <a href="${job.url}"
               style="color:#818cf8;font-size:15px;font-weight:600;text-decoration:none">
              ${job.title}
            </a><br>
            <span style="color:#9ca3af;font-size:13px">
              ${job.company} · ${job.country_flag} ${job.location}
            </span><br>
            <span style="font-family:monospace;color:#4ade80;font-size:12px;letter-spacing:1px">
              ${scoreBar(job.total_score)} ${job.total_score}%
            </span>
            ${reviewBadge(job)}
            ${
              job.matched_skills.length
                ? `<br><span style="color:#94a3b8;font-size:12px">${job.matched_skills.slice(0, 6).join(" · ")}</span>`
                : ""
            }
          </td>
        </tr>`,
        )
        .join("");

      return `
      <tr>
        <td style="padding-top:24px">
          <h2 style="color:${PIPELINE_COLOR[mode] ?? "#6366f1"};margin:0 0 8px;font-size:16px">
            ${modeLabel(mode as "visa" | "local" | "global")} — ${modeJobs.length} new
          </h2>
          <table width="100%" cellpadding="0" cellspacing="0">${cards}</table>
        </td>
      </tr>`;
    })
    .join("");

  return `
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
              <h1 style="margin:0;color:#e2e8f0;font-size:22px">
                🎯 Job Radar — ${jobs.length} new match${jobs.length !== 1 ? "es" : ""}
              </h1>
              <p style="margin:6px 0 0;color:#64748b;font-size:13px">
                ${new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
              </p>
            </td>
          </tr>

          <!-- Job sections -->
          <tr>
            <td style="padding:0 32px 24px">
              <table width="100%" cellpadding="0" cellspacing="0">${sections}</table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px;background:#0f0f20;border-top:1px solid #1e1e30;text-align:center">
              <p style="margin:0;color:#475569;font-size:12px">
                Job Radar · Sent to ${recipientEmail}
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
 * Sends a job alert email for ALL new jobs across ALL pipelines.
 * FIX #4: Old code only fired for mode === "visa" jobs.
 *
 * @param jobs      Newly added scored jobs (all modes included)
 * @param recipient Email address to send to
 */
export async function sendJobAlertEmail(jobs: ScoredJob[], recipient: string): Promise<void> {
  if (!jobs.length) return;

  const transporter = createTransporter();
  const modeCount = jobs.reduce(
    (acc, j) => ({ ...acc, [j.mode]: (acc[j.mode] ?? 0) + 1 }),
    {} as Record<string, number>,
  );
  const summary = Object.entries(modeCount)
    .map(([m, n]) => `${n} ${modeLabel(m as "visa" | "local" | "global")}`)
    .join(", ");

  await transporter.sendMail({
    from: `"Job Radar" <${process.env.SMTP_USER}>`,
    to: recipient,
    subject: `🎯 ${jobs.length} new job${jobs.length !== 1 ? "s" : ""} — ${summary}`,
    html: buildJobAlertHtml(jobs, recipient),
  });
}

// ── Salary reminder email ─────────────────────────────────────

function buildSalaryReminderHtml(report: SalaryReport, updateUrl: string): string {
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
 * Sends a monthly salary update reminder to a user.
 *
 * @param report     Their most recent salary report
 * @param email      User's email address
 * @param updateUrl  Link to the salary update page
 */
export async function sendSalaryReminderEmail(
  report: SalaryReport,
  email: string,
  updateUrl: string,
): Promise<void> {
  const transporter = createTransporter();

  await transporter.sendMail({
    from: `"Job Radar" <${process.env.SMTP_USER}>`,
    to: email,
    subject: "💼 Update your salary data — help others get paid fairly",
    html: buildSalaryReminderHtml(report, updateUrl),
  });
}
