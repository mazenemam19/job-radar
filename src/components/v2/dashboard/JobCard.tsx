"use client";
// src/components/v2/dashboard/JobCard.tsx
//
// FIX #3: recencyScore is ALWAYS computed live from job.posted_at using
//         computeRecencyScore(). Never reads job.recency_score from the
//         stored/frozen value. This means the score shown in the UI reflects
//         actual age at render time, not at insertion time.

import { useState } from "react";
import { computeRecencyScore } from "@/lib/v2/scoring";
import type { ScoredJob } from "@/lib/v2/types";

interface Props {
  job: ScoredJob;
  onTrack?: (job: ScoredJob) => void;
  onStrategy?: (job: ScoredJob) => void;
  isTracked?: boolean;
}

const MODE_COLORS: Record<string, string> = {
  visa: "#6366f1",
  local: "#22c55e",
  global: "#f59e0b",
};

const MODE_LABELS: Record<string, string> = {
  visa: "✈️ Visa",
  local: "🇪🇬 Local",
  global: "🌐 Remote",
};

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div
        style={{
          flex: 1,
          height: 4,
          background: "#1e1e30",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${value}%`,
            height: "100%",
            background: color,
            borderRadius: 2,
            transition: "width 0.3s ease",
          }}
        />
      </div>
      <span style={{ fontSize: 11, color: "#64748b", minWidth: 28, textAlign: "right" }}>
        {value}%
      </span>
    </div>
  );
}

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
      style={{
        background: "#0d0d1a",
        border: `1px solid #1e1e30`,
        borderLeft: `3px solid ${modeColor}`,
        borderRadius: 10,
        padding: "16px 20px",
        marginBottom: 12,
        transition: "border-color 0.15s ease",
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "#e2e8f0",
              fontWeight: 600,
              fontSize: 15,
              textDecoration: "none",
              display: "block",
            }}
          >
            {job.title}
          </a>
          <div style={{ marginTop: 4, fontSize: 13, color: "#94a3b8" }}>
            {job.company} · {job.country_flag} {job.location} · {postedLabel}
          </div>
        </div>

        {/* Score badge */}
        <div
          style={{
            flexShrink: 0,
            width: 52,
            height: 52,
            borderRadius: "50%",
            background: `conic-gradient(${modeColor} ${displayTotalScore * 3.6}deg, #1e1e30 0deg)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "#0d0d1a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              fontWeight: 700,
              color: "#e2e8f0",
            }}
          >
            {displayTotalScore}
          </div>
        </div>
      </div>

      {/* Tags row */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
        <span
          style={{
            padding: "2px 8px",
            borderRadius: 20,
            background: `${modeColor}20`,
            color: modeColor,
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          {MODE_LABELS[job.mode]}
        </span>

        {job.visa_sponsorship && (
          <span
            style={{
              padding: "2px 8px",
              borderRadius: 20,
              background: "#0f172a",
              color: "#818cf8",
              fontSize: 11,
            }}
          >
            Visa sponsorship
          </span>
        )}

        {job.matched_skills.slice(0, 5).map((s) => (
          <span
            key={s}
            style={{
              padding: "2px 8px",
              borderRadius: 20,
              background: "#0f172a",
              color: "#64748b",
              fontSize: 11,
            }}
          >
            {s}
          </span>
        ))}
        {job.matched_skills.length > 5 && (
          <span style={{ padding: "2px 8px", fontSize: 11, color: "#475569" }}>
            +{job.matched_skills.length - 5}
          </span>
        )}
      </div>

      {/* Score breakdown (expanded) */}
      {expanded && (
        <div style={{ marginTop: 12, padding: "12px", background: "#0a0a18", borderRadius: 8 }}>
          <div style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 3 }}>Skill match</div>
            <ScoreBar value={job.skill_match_score} color="#6366f1" />
          </div>
          <div style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 3 }}>Recency (live)</div>
            <ScoreBar value={liveRecencyScore} color="#22c55e" />
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 3 }}>Relocation</div>
            <ScoreBar value={job.relocation_bonus} color="#f59e0b" />
          </div>
          {job.gemini_reason && (
            <div style={{ marginTop: 10, fontSize: 12, color: "#475569", fontStyle: "italic" }}>
              Gemini: {job.gemini_reason}
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <button onClick={() => setExpanded((p) => !p)} style={btnStyle("#1e1e30", "#94a3b8")}>
          {expanded ? "Less" : "Details"}
        </button>

        {onStrategy && (
          <button onClick={() => onStrategy(job)} style={btnStyle("#1e1e30", "#818cf8")}>
            ✨ Strategy
          </button>
        )}

        {onTrack && (
          <button
            onClick={() => onTrack(job)}
            style={btnStyle(isTracked ? "#16213e" : "#1e1e30", isTracked ? "#6366f1" : "#94a3b8")}
          >
            {isTracked ? "✓ Tracked" : "+ Track"}
          </button>
        )}

        <a
          href={job.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ ...btnStyle("#6366f1", "#fff"), textDecoration: "none" }}
        >
          Apply →
        </a>
      </div>
    </article>
  );
}

function btnStyle(bg: string, color: string): React.CSSProperties {
  return {
    padding: "6px 14px",
    borderRadius: 6,
    border: "none",
    background: bg,
    color,
    fontSize: 13,
    cursor: "pointer",
    fontWeight: 500,
  };
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
