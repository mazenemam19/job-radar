import nodemailer from "nodemailer";
import { Job } from "./types";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

function scoreColor(score: number): string {
  if (score >= 70) return "#22c55e";
  if (score >= 45) return "#f59e0b";
  return "#6b7280";
}

function buildEmailHtml(newJobs: Job[]): string {
  const top10 = newJobs.slice(0, 10);

  const jobCards = top10
    .map((job) => {
      const color = scoreColor(job.totalScore);
      const skillPills = job.matchedSkills
        .slice(0, 6)
        .map((s) => `<span style="display:inline-block;background:#14532d;color:#86efac;padding:2px 8px;border-radius:12px;font-size:11px;margin:2px;">${s}</span>`)
        .join("");

      return `
<div style="background:#0d1525;border:1px solid #1e3050;border-radius:8px;padding:16px;margin-bottom:12px;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td style="vertical-align:top;">
        <div style="font-size:16px;font-weight:bold;color:#e2e8f0;">${job.title}</div>
        <div style="color:#94a3b8;font-size:13px;margin-top:2px;">${job.company} &middot; ${job.countryFlag} ${job.location}</div>
        ${job.salary ? `<div style="color:#60a5fa;font-size:12px;margin-top:4px;">${job.salary}</div>` : ""}
        <div style="color:#64748b;font-size:12px;margin-top:4px;">${timeAgo(job.postedAt)} &middot; ${job.source}</div>
        <div style="margin-top:8px;">${skillPills}</div>
        <div style="margin-top:10px;">
          <a href="${job.url}" style="display:inline-block;background:#2563eb;color:#ffffff;padding:8px 16px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600;">Apply Now</a>
        </div>
      </td>
      <td style="vertical-align:top;text-align:right;padding-left:16px;width:64px;">
        <div style="width:56px;height:56px;border-radius:50%;background:${color};display:inline-block;font-size:16px;font-weight:bold;color:#fff;text-align:center;line-height:56px;">${job.totalScore}</div>
      </td>
    </tr>
  </table>
</div>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="background:#090e1a;color:#e2e8f0;font-family:Arial,sans-serif;padding:24px;margin:0;">
  <h1 style="color:#60a5fa;margin-bottom:4px;">🎯 Job Radar — ${newJobs.length} New Match${newJobs.length !== 1 ? "es" : ""}</h1>
  <p style="color:#64748b;margin-top:0;margin-bottom:24px;">Top ${top10.length} jobs sorted by match score. All have confirmed visa sponsorship.</p>
  ${jobCards}
  <p style="color:#475569;font-size:12px;margin-top:24px;">View all matches at <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}" style="color:#60a5fa;">${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}</a></p>
</body>
</html>`;
}

export async function sendNewJobsEmail(newJobs: Job[]): Promise<void> {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS || !process.env.NOTIFY_TO) {
    console.warn("[Email] Missing SMTP config — skipping notification");
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || "587"),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const html = buildEmailHtml(newJobs);

  try {
    await transporter.sendMail({
      from: `"Job Radar 🎯" <${process.env.SMTP_USER}>`,
      to: process.env.NOTIFY_TO,
      subject: `🎯 ${newJobs.length} New Visa-Sponsored Job${newJobs.length !== 1 ? "s" : ""} Found`,
      html,
    });
    console.log(`[Email] Sent notification for ${newJobs.length} jobs`);
  } catch (err) {
    console.error("[Email] Failed to send:", err);
  }
}
