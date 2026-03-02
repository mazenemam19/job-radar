// src/lib/email.ts
import nodemailer from "nodemailer";
import type { Job } from "./types";

function scoreColor(s: number) {
  return s >= 80 ? "#4ade80" : s >= 60 ? "#fbbf24" : "#94a3b8";
}

function jobRow(job: Job): string {
  const color = scoreColor(job.totalScore);
  const score = Math.round(job.totalScore);
  const skills = job.matchedSkills
    .slice(0, 6)
    .map(
      (s) =>
        `<span style="display:inline-block;background:rgba(99,102,241,0.18);color:#a5b4fc;font-family:monospace;font-size:10px;padding:2px 7px;border-radius:4px;margin:2px 2px 2px 0;border:1px solid rgba(99,102,241,0.3);">${s}</span>`,
    )
    .join("");

  return `
  <tr>
    <td style="padding:20px 28px;border-bottom:1px solid #1a1a2e;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td>
            <div style="font-size:11px;color:#4a4a6a;font-family:monospace;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:5px;">
              ${job.countryFlag}&nbsp; ${job.company} &middot; ${job.country}
            </div>
            <div style="font-size:18px;font-weight:700;color:#ffffff;margin-bottom:8px;line-height:1.3;">
              ${job.title}
            </div>
            <div style="font-size:12px;color:#5a5a7a;margin-bottom:12px;">
              &#x1F4CD; ${job.location}
            </div>
            <div style="margin-bottom:14px;">${skills}</div>
            <a href="${job.url}"
               style="display:inline-block;padding:9px 20px;background:#6366f1;color:#ffffff;text-decoration:none;border-radius:8px;font-size:13px;font-weight:600;letter-spacing:0.02em;">
              Apply Now &#x2197;
            </a>
          </td>
          <td width="72" style="text-align:center;vertical-align:top;padding-left:16px;">
            <div style="width:56px;height:56px;border-radius:50%;background:${color}18;border:2px solid ${color};text-align:center;line-height:52px;font-family:monospace;font-size:17px;font-weight:700;color:${color};">
              ${score}
            </div>
            <div style="font-size:9px;color:#4a4a6a;font-family:monospace;margin-top:4px;letter-spacing:0.06em;text-transform:uppercase;">score</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

export async function sendJobAlert(newJobs: Job[]): Promise<void> {
  if (!newJobs.length) return;
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log("[email] SMTP not configured — skipping");
    return;
  }

  const top = [...newJobs].sort((a, b) => b.totalScore - a.totalScore).slice(0, 10);
  const dateStr = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#08080f;font-family:'DM Sans',system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="padding:40px 16px;">
    <tr><td align="center">
      <table width="620" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d1a;border:1px solid #1a1a2e;border-radius:14px;overflow:hidden;">

        <!-- Header -->
        <tr>
          <td style="padding:28px 28px 24px;border-bottom:1px solid #1a1a2e;background:linear-gradient(135deg,#0d0d1a 0%,#111128 100%);">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td>
                  <div style="font-size:10px;color:#4a4a6a;font-family:monospace;letter-spacing:0.14em;text-transform:uppercase;margin-bottom:8px;">&#x25CF; Job Radar</div>
                  <div style="font-size:26px;font-weight:800;color:#ffffff;line-height:1.2;margin-bottom:6px;">
                    ${top.length} New Frontend Job${top.length > 1 ? "s" : ""}
                  </div>
                  <div style="font-size:13px;color:#5a5a7a;">
                    Direct from visa-sponsoring companies &middot; ${dateStr}
                  </div>
                </td>
                <td width="52" style="text-align:right;vertical-align:top;">
                  <div style="width:42px;height:42px;border-radius:50%;background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.3);text-align:center;line-height:40px;font-size:14px;color:#4ade80;">
                    &#x25CF;
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Jobs -->
        ${top.map(jobRow).join("")}

        <!-- Footer -->
        <tr>
          <td style="padding:18px 28px;border-top:1px solid #1a1a2e;">
            <div style="font-size:11px;color:#2a2a4a;font-family:monospace;text-align:center;letter-spacing:0.04em;">
              Job Radar &middot; Alexandria &rarr; World &middot; Company-direct &middot; No aggregators
            </div>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  await transporter.sendMail({
    from: `"Job Radar" <${process.env.SMTP_USER}>`,
    to: process.env.NOTIFY_TO,
    subject: `🎯 ${top.length} new frontend job${top.length > 1 ? "s" : ""} — ${top[0].company}${top.length > 1 ? ` +${top.length - 1}` : ""}`,
    html,
  });

  console.log(`[email] Alert sent: ${top.length} jobs`);
}
