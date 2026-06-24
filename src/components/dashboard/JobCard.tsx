"use client";
// src/components/dashboard/JobCard.tsx
//
// FIX #3: recencyScore is ALWAYS computed live from job.posted_at using
//         computeRecencyScore(). Never reads job.recency_score from the
//         stored/frozen value. This means the score shown in the UI reflects
//         actual age at render time, not at insertion time.

import { useState } from "react";
import Link from "next/link";
import { computeRecencyScore } from "@/lib/scoring";
import { MODE_COLORS, MODE_LABELS } from "@/lib/constants";
import ScoreBar from "./ScoreBar";
import type { ScoredJob } from "@/lib/types";

interface Props {
  job: ScoredJob;
  onTrack?: (job: ScoredJob) => void;
  onStrategy?: (job: ScoredJob) => void;
  isTracked?: boolean;
}

const BTN_CLASS = "cursor-pointer rounded-md border-0 px-3.5 py-1.5 text-[13px] font-medium";

export default function JobCard({ job, onTrack, onStrategy, isTracked }: Props) {
  const [expanded, setExpanded] = useState(false);

  // FIX #3: compute recency live from the actual posted_at date
  const dateForRecency = job.date_unknown ? job.fetched_at : job.posted_at;
  const liveRecencyScore = computeRecencyScore(dateForRecency);

  // Recompute total score with live recency for display accuracy
  const { skill, recency, relocation } = job.scoring_weights ?? {
    skill: 0.6,
    recency: 0.3,
    relocation: 0.1,
  };
  const displayTotalScore = Math.round(
    job.skill_match_score * skill + liveRecencyScore * recency + job.relocation_bonus * relocation,
  );

  const modeColor = MODE_COLORS[job.mode] ?? "#6366f1";

  const postedLabel = job.date_unknown
    ? `~${Math.round((Date.now() - Date.parse(job.fetched_at)) / 86_400_000)}d ago (date unknown)`
    : formatRelativeDate(job.posted_at);

  return (
    <article
      className="mb-3 rounded-[10px] border border-[#1e1e30] bg-[#0d0d1a] px-5 py-4 transition-[border-color] duration-150 ease-in-out"
      style={{ borderLeft: `3px solid ${modeColor}` }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link
            href={`/job/${job.id}`}
            className="block text-[15px] font-semibold text-[#e2e8f0] no-underline"
          >
            {job.title}
          </Link>
          <div className="mt-1 text-[13px] text-[#94a3b8]">
            {job.company} · {job.country_flag} {job.location} · {postedLabel}
          </div>
        </div>

        {/* Score badge */}
        <div
          className="relative flex h-[52px] w-[52px] flex-shrink-0 items-center justify-center rounded-full"
          style={{
            background: `conic-gradient(${modeColor} ${displayTotalScore * 3.6}deg, #1e1e30 0deg)`,
          }}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0d0d1a] text-[13px] font-bold text-[#e2e8f0]">
            {displayTotalScore}
          </div>
        </div>
      </div>

      {/* Tags row */}
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

        {!job.gemini_reviewed && (
          <span
            title="Gemini didn't return a decision for this job, so it's shown by default rather than filtered out."
            className="rounded-full px-2 py-0.5 text-[11px] text-[#f59e0b]"
            style={{ background: "rgba(245,158,11,0.12)" }}
          >
            ⚠ Not AI-reviewed (showing anyway)
          </span>
        )}

        {job.matched_skills.slice(0, 5).map((s) => (
          <span
            key={s}
            className="rounded-full bg-[#0f172a] px-2 py-0.5 text-[11px] text-[#64748b]"
          >
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

      {/* Score breakdown (expanded) */}
      {expanded && (
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
      )}

      {/* Action buttons */}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => setExpanded((p) => !p)}
          className={BTN_CLASS}
          style={{ background: "#1e1e30", color: "#94a3b8" }}
        >
          {expanded ? "Less" : "Details"}
        </button>

        {onStrategy && (
          <button
            onClick={() => onStrategy(job)}
            className={BTN_CLASS}
            style={{ background: "#1e1e30", color: "#818cf8" }}
          >
            ✨ Strategy
          </button>
        )}

        {onTrack && (
          <button
            onClick={() => onTrack(job)}
            className={BTN_CLASS}
            style={{
              background: isTracked ? "#16213e" : "#1e1e30",
              color: isTracked ? "#6366f1" : "#94a3b8",
            }}
          >
            {isTracked ? "✓ Tracked" : "+ Track"}
          </button>
        )}

        <a
          href={job.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`${BTN_CLASS} no-underline`}
          style={{ background: "#6366f1", color: "#fff" }}
        >
          Apply →
        </a>
      </div>
    </article>
  );
}

function formatRelativeDate(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "Unknown";
  const days = Math.floor((Date.now() - ms) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}
