"use client";
// src/components/dashboard/JobScoreBreakdown.tsx
// Expanded detail panel for a job card: per-component score bars plus the
// Gemini reasoning string, when present.

import ScoreBar from "./ScoreBar";
import type { ScoredJob } from "@/lib/types";

interface Props {
  job: ScoredJob;
  liveRecencyScore: number;
}

export default function JobScoreBreakdown({ job, liveRecencyScore }: Props) {
  return (
    <div className="mt-3 rounded-lg bg-[#0a0a18] p-3">
      <div className="mb-1.5">
        <div className="mb-[3px] text-[11px] text-[#64748b]">Skill match</div>
        <ScoreBar value={job.skill_match_score} color="#6366f1" />
      </div>
      <div className="mb-1.5">
        <div className="mb-[3px] text-[11px] text-[#64748b]">Recency (live)</div>
        <ScoreBar value={liveRecencyScore} color="#22c55e" />
      </div>
      <div>
        <div className="mb-[3px] text-[11px] text-[#64748b]">Relocation</div>
        <ScoreBar value={job.relocation_bonus} color="#f59e0b" />
      </div>
      {job.gemini_reason && (
        <div className="mt-2.5 text-xs italic text-[#475569]">Gemini: {job.gemini_reason}</div>
      )}
    </div>
  );
}
