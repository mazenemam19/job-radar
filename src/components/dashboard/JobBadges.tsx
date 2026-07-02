"use client";
// src/components/dashboard/JobBadges.tsx
// Tag row for a job card: mode, visa sponsorship, seniority, AI-review
// status, and matched/bonus skill chips.

import { getDisplaySeniorityBadge } from "@/lib/scoring";
import { MODE_LABELS } from "@/lib/constants";
import type { ScoredJob, ResolvedSettings } from "@/lib/types";

interface Props {
  job: ScoredJob;
  modeColor: string;
  settings?: ResolvedSettings;
}

function AiReviewBadge({ job }: { job: ScoredJob }) {
  if (job.gemini_quota_exhausted) {
    return (
      <span
        title="Gemini's quota was exhausted, so this job is shown by default rather than filtered out."
        className="rounded-full px-2 py-0.5 text-[11px] text-[#f59e0b]"
        style={{ background: "rgba(245,158,11,0.12)" }}
      >
        ⚠ Gemini quota exhausted
      </span>
    );
  }
  if (job.gemini_reviewed) return null;
  return (
    <span
      title="Gemini didn't return a decision for this job, so it's shown by default rather than filtered out."
      className="rounded-full px-2 py-0.5 text-[11px] text-[#f59e0b]"
      style={{ background: "rgba(245,158,11,0.12)" }}
    >
      ⚠ Not AI-reviewed
    </span>
  );
}

export default function JobBadges({ job, modeColor, settings }: Props) {
  const seniorityBadge = settings ? getDisplaySeniorityBadge(job, settings) : null;

  return (
    <div className="mt-2.5 flex flex-wrap gap-1.5">
      <span
        className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
        style={{ background: `${modeColor}20`, color: modeColor }}
      >
        {MODE_LABELS[job.mode]}
      </span>

      {job.visa_sponsorship && (
        <span className="rounded-full bg-[#0f172a] px-2 py-0.5 text-[11px] text-[#818cf8]">
          Visa sponsorship
        </span>
      )}

      {seniorityBadge && (
        <span className="rounded-full bg-[#0f172a] px-2 py-0.5 text-[11px] text-[#22d3ee]">
          {seniorityBadge}
        </span>
      )}

      <AiReviewBadge job={job} />

      {job.matched_skills.slice(0, 5).map((s) => (
        <span key={s} className="rounded-full bg-[#0f172a] px-2 py-0.5 text-[11px] text-[#64748b]">
          {s}
        </span>
      ))}
      {job.matched_skills.length > 5 && (
        <span className="px-2 py-0.5 text-[11px] text-[#475569]">
          +{job.matched_skills.length - 5}
        </span>
      )}

      {job.bonus_skills.slice(0, 4).map((s) => (
        <span
          key={s}
          title="Bonus skill — not part of your scoring, just nice to know it's there"
          className="rounded-full px-2 py-0.5 text-[11px] text-[#f59e0b]"
          style={{ background: "rgba(245,158,11,0.12)" }}
        >
          +{s}
        </span>
      ))}
    </div>
  );
}
