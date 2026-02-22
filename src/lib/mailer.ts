import nodemailer from "nodemailer";
import { Job } from "@/types";
import { format } from "date-fns";

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

function scoreColor(score: number): string {
  if (score >= 70) return "#22c55e";
  if (score >= 45) return "#f59e0b";
  return "#ef4444";
}

function renderJobCard(job: Job): string {
  const salary =
    job.salary?.min || job.salary?.max
      ? `${job.salary.currency ?? ""} ${job.salary.min?.toLocaleString() ?? ""}${job.salary.max ? ` – ${job.salary.max.toLocaleString()}` : ""}`
      : "Not specified";

  const badges = [
    job.hasVisaSponsorship ? '🛂 <strong style="color:#6366f1">Visa Sponsorship</strong>' : "",
    job.hasRelocation ? '📦 <strong style="color:#0ea5e9">Relocation</strong>' : "",
  ]
    .filter(Boolean)
    .join(" &nbsp;|&nbsp; ");

  return `
    <div style="border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:16px;background:#fff">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <h3 style="margin:0 0 4px;font-size:16px;color:#111827">${job.title}</h3>
          <p style="margin:0;color:#6b7280;font-size:14px">${job.company} &bull; ${job.location}, ${job.country}</p>
        </div>
        <div style="text-align:center;background:${scoreColor(job.totalScore)};color:#fff;border-radius:50%;width:52px;height:52px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px;flex-shrink:0">
          ${job.totalScore}
        </div>
      </div>
      ${badges ? `<p style="margin:10px 0 0;font-size:13px">${badges}</p>` : ""}
      <p style="margin:8px 0 0;font-size:13px;color:#374151">💰 ${salary} &nbsp;&nbsp;📅 ${format(new Date(job.postedAt), "MMM d, yyyy")}</p>
      <p style="margin:8px 0 0;font-size:13px;color:#374151">✅ Matched: ${job.matchedSkills.slice(0, 8).join(", ")}</p>
      <a href="${job.url}" style="display:inline-block;margin-top:12px;padding:8px 16px;background:#6366f1;color:#fff;text-decoration:none;border-radius:8px;font-size:13px;font-weight:600">View Job →</a>
    </div>
  `;
}

export async function sendNewJobsNotification(newJobs: Job[]): Promise<void> {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn("⚠️  SMTP credentials not set — skipping email notification");
    return;
  }

  if (newJobs.length === 0) return;

  const transporter = getTransporter();

  // Top 10 new jobs sorted by totalScore
  const topJobs = [...newJobs].sort((a, b) => b.totalScore - a.totalScore).slice(0, 10);

  const visaCount = newJobs.filter((j) => j.hasVisaSponsorship).length;
  const relocationCount = newJobs.filter((j) => j.hasRelocation).length;
  const avgScore = Math.round(newJobs.reduce((s, j) => s + j.totalScore, 0) / newJobs.length);

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><title>Job Radar — New Matches</title></head>
    <body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
      <div style="max-width:640px;margin:0 auto;padding:32px 16px">
        <div style="background:linear-gradient(135deg,#6366f1,#4f46e5);border-radius:16px;padding:28px;color:#fff;margin-bottom:24px">
          <h1 style="margin:0 0 8px;font-size:24px">🎯 Job Radar</h1>
          <p style="margin:0;opacity:.85">${newJobs.length} new jobs matched your profile!</p>
        </div>

        <div style="display:flex;gap:12px;margin-bottom:24px">
          <div style="flex:1;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px;text-align:center">
            <div style="font-size:24px;font-weight:700;color:#6366f1">${newJobs.length}</div>
            <div style="font-size:12px;color:#6b7280;margin-top:4px">New Jobs</div>
          </div>
          <div style="flex:1;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px;text-align:center">
            <div style="font-size:24px;font-weight:700;color:#22c55e">${avgScore}</div>
            <div style="font-size:12px;color:#6b7280;margin-top:4px">Avg Match Score</div>
          </div>
          <div style="flex:1;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px;text-align:center">
            <div style="font-size:24px;font-weight:700;color:#6366f1">${visaCount}</div>
            <div style="font-size:12px;color:#6b7280;margin-top:4px">Visa Sponsors</div>
          </div>
          <div style="flex:1;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px;text-align:center">
            <div style="font-size:24px;font-weight:700;color:#0ea5e9">${relocationCount}</div>
            <div style="font-size:12px;color:#6b7280;margin-top:4px">Relocation</div>
          </div>
        </div>

        <h2 style="font-size:18px;color:#111827;margin:0 0 16px">Top ${topJobs.length} Matches</h2>
        ${topJobs.map(renderJobCard).join("")}

        <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:24px">
          Job Radar &bull; ${format(new Date(), "MMMM d, yyyy 'at' HH:mm")}
        </p>
      </div>
    </body>
    </html>
  `;

  await transporter.sendMail({
    from: `"Job Radar 🎯" <${process.env.SMTP_USER}>`,
    to: process.env.NOTIFY_TO ?? process.env.SMTP_USER,
    subject: `🎯 ${newJobs.length} new job matches — ${visaCount} with visa sponsorship`,
    html,
  });

  console.log(`📧 Email sent with ${newJobs.length} new jobs`);
}
