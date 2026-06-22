"use client";
// src/app/job/[id]/page.tsx
// Job detail page. Rebuilt for v2 — the old version read from a file-storage
// API route that no longer exists, used the pre-multi-tenant Job type, and
// styled itself with CSS classes from the old (non-existent) stylesheet.
// This version reads from the user's own cached scored jobs (same data their
// dashboard shows) and matches the rest of the v2 dark-theme inline-style system.

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import DOMPurify from "dompurify";
import { computeRecencyScore } from "@/lib/scoring";
import { MODE_COLORS, MODE_LABELS } from "@/lib/constants";
import ScoreBar from "@/components/dashboard/ScoreBar";
import type { ScoredJob } from "@/lib/types";

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

export default function JobDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<ScoredJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const id = params?.id;

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    fetch(`/api/jobs/${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.ok) {
          setJob(res.data);
        } else {
          setNotFound(true);
        }
        setLoading(false);
      })
      .catch(() => {
        setNotFound(true);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div style={pageShellStyle}>
        <div style={{ color: "#64748b", padding: 40 }}>Loading…</div>
      </div>
    );
  }

  if (notFound || !job) {
    return (
      <div style={pageShellStyle}>
        <button onClick={() => router.back()} style={backBtnStyle}>
          ← Back
        </button>
        <div style={{ color: "#64748b", padding: "40px 0" }}>
          Job not found — it may have aged out of your dashboard, or your settings changed since you
          last saw it.
        </div>
      </div>
    );
  }

  const dateForRecency = job.date_unknown ? job.fetched_at : job.posted_at;
  const liveRecencyScore = computeRecencyScore(dateForRecency);

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

  const cleanDescription = job.description
    ? DOMPurify.sanitize(job.description, {
        ALLOWED_TAGS: [
          "p",
          "br",
          "ul",
          "ol",
          "li",
          "strong",
          "em",
          "b",
          "i",
          "u",
          "h1",
          "h2",
          "h3",
          "h4",
          "a",
          "blockquote",
          "span",
          "div",
        ],
        ALLOWED_ATTR: ["href", "target", "rel"],
      })
    : "";

  return (
    <div style={pageShellStyle}>
      <button onClick={() => router.back()} style={backBtnStyle}>
        ← Back
      </button>

      {/* Header card */}
      <div
        style={{
          background: "#0d0d1a",
          border: "1px solid #1e1e30",
          borderLeft: `3px solid ${modeColor}`,
          borderRadius: 10,
          padding: "24px 28px",
          marginBottom: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ margin: "0 0 6px", fontSize: 22, color: "#e2e8f0", fontWeight: 700 }}>
              {job.title}
            </h1>
            <div style={{ fontSize: 14, color: "#94a3b8" }}>
              {job.company} · {job.country_flag} {job.location} · {postedLabel}
            </div>
          </div>

          <div
            style={{
              flexShrink: 0,
              width: 60,
              height: 60,
              borderRadius: "50%",
              background: `conic-gradient(${modeColor} ${displayTotalScore * 3.6}deg, #1e1e30 0deg)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: "#0d0d1a",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 15,
                fontWeight: 700,
                color: "#e2e8f0",
              }}
            >
              {displayTotalScore}
            </div>
          </div>
        </div>

        {/* Tags row */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 14 }}>
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

          {job.matched_skills.map((s) => (
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

          {job.bonus_skills.map((s) => (
            <span
              key={s}
              title="Bonus skill — not part of your scoring, just nice to know it's there"
              style={{
                padding: "2px 8px",
                borderRadius: 20,
                background: "rgba(245,158,11,0.12)",
                color: "#f59e0b",
                fontSize: 11,
              }}
            >
              +{s}
            </span>
          ))}
        </div>

        {/* Score breakdown */}
        <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 8 }}>
          <div>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 3 }}>Skill match</div>
            <ScoreBar value={job.skill_match_score} color="#6366f1" />
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 3 }}>Recency (live)</div>
            <ScoreBar value={liveRecencyScore} color="#22c55e" />
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 3 }}>Relocation</div>
            <ScoreBar value={job.relocation_bonus} color="#f59e0b" />
          </div>
        </div>

        {job.gemini_reason && (
          <div
            style={{
              marginTop: 16,
              padding: "10px 14px",
              background: "#0a0a18",
              borderRadius: 8,
              fontSize: 13,
              color: "#94a3b8",
              fontStyle: "italic",
            }}
          >
            Gemini: {job.gemini_reason}
          </div>
        )}

        <a
          href={job.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-block",
            marginTop: 18,
            padding: "10px 20px",
            borderRadius: 8,
            background: "#6366f1",
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Apply →
        </a>
      </div>

      {/* Description */}
      {cleanDescription && (
        <div
          style={{
            background: "#0d0d1a",
            border: "1px solid #1e1e30",
            borderRadius: 10,
            padding: "24px 28px",
            color: "#cbd5e1",
            fontSize: 14,
            lineHeight: 1.7,
          }}
          dangerouslySetInnerHTML={{ __html: cleanDescription }}
        />
      )}
    </div>
  );
}

const pageShellStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#08080f",
  fontFamily: "Inter, system-ui, sans-serif",
  padding: "32px 24px",
  maxWidth: 760,
  margin: "0 auto",
};

const backBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid #1e1e30",
  borderRadius: 6,
  color: "#94a3b8",
  fontSize: 13,
  padding: "6px 14px",
  cursor: "pointer",
  marginBottom: 20,
};
