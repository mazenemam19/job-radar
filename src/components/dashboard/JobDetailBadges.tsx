"use client";
// src/components/dashboard/JobDetailBadges.tsx
// Tag row for the job detail page: mode, visa sponsorship, AI-review status,
// and the full matched/bonus skill lists (unlike JobBadges, nothing here is
// truncated — the detail page has the width to show all of it).

import { MODE_LABELS } from "@/lib/constants";
import type { ScoredJob } from "@/lib/types";

interface Props {
  job: ScoredJob;
  modeColor: string;
}

function AiReviewBadge({ job }: { job: ScoredJob }) {
  if (job.gemini_quota_exhausted) {
    return (
      <span
        title="Gemini's quota was exhausted, so this job is shown by default rather than filtered out."
        className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-500"
      >
        ⚠ Gemini quota exhausted
      </span>
    );
  }
  if (job.gemini_reviewed) return null;
  return (
    <span
      title="Gemini didn't return a decision for this job, so it's shown by default rather than filtered out."
      className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-500"
    >
      ⚠ Not AI-reviewed
    </span>
  );
}

export default function JobDetailBadges({ job, modeColor }: Props) {
  return (
    <div className="mt-3.5 flex flex-wrap gap-1.5">
      <span
        className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
        style={{ background: `${modeColor}20`, color: modeColor }}
      >
        {MODE_LABELS[job.mode]}
      </span>

      {job.visa_sponsorship && (
        <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[11px] text-indigo-400">
          Visa sponsorship
        </span>
      )}

      <AiReviewBadge job={job} />

      {job.matched_skills.map((s) => (
        <span key={s} className="rounded-full bg-slate-900 px-2 py-0.5 text-[11px] text-slate-500">
          {s}
        </span>
      ))}

      {job.bonus_skills.map((s) => (
        <span
          key={s}
          title="Bonus skill — not part of your scoring, just nice to know it's there"
          className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-500"
        >
          +{s}
        </span>
      ))}
    </div>
  );
}
