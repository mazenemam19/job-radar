"use client";
// src/components/v2/tracker/TrackerModal.tsx

import { useState } from "react";
import type { ScoredJob, TrackerStatus, TrackerJobSnapshot } from "@/lib/v2/types";

interface Props {
  job: ScoredJob | null;
  onClose: () => void;
  onSaved: () => void;
}

const STATUSES: { value: TrackerStatus; label: string; color: string }[] = [
  { value: "saved", label: "Saved", color: "#64748b" },
  { value: "applied", label: "Applied", color: "#6366f1" },
  { value: "interviewing", label: "Interviewing", color: "#f59e0b" },
  { value: "offer", label: "Offer", color: "#22c55e" },
  { value: "rejected", label: "Rejected", color: "#ef4444" },
  { value: "ghosted", label: "Ghosted", color: "#475569" },
];

export default function TrackerModal({ job, onClose, onSaved }: Props) {
  const [status, setStatus] = useState<TrackerStatus>("applied");
  const [notes, setNotes] = useState("");
  const [appliedAt, setAppliedAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!job) return null;

  async function handleSave() {
    if (!job) return;
    setLoading(true);
    setError(null);

    const snapshot: TrackerJobSnapshot = {
      title: job.title,
      company: job.company,
      url: job.url,
      location: job.location,
      country: job.country,
      country_flag: job.country_flag,
      mode: job.mode,
      total_score: job.total_score,
      matched_skills: job.matched_skills,
      posted_at: job.posted_at,
    };

    try {
      const res = await fetch("/api/tracker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: job.id,
          job_snapshot: snapshot,
          status,
          notes: notes.trim() || undefined,
          applied_at: appliedAt || undefined,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        onSaved();
        onClose();
      } else {
        setError(data.error);
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#0d0d1a",
          border: "1px solid #1e1e30",
          borderRadius: 12,
          padding: 28,
          maxWidth: 480,
          width: "100%",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, color: "#e2e8f0" }}>Track this job</h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}>
              {job.title} · {job.company}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#64748b",
              fontSize: 20,
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>

        {/* Status */}
        <label style={labelStyle}>Status</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          {STATUSES.map((s) => (
            <button
              key={s.value}
              onClick={() => setStatus(s.value)}
              style={{
                padding: "6px 14px",
                borderRadius: 20,
                fontSize: 13,
                border: `1px solid ${status === s.value ? s.color : "#1e1e30"}`,
                background: status === s.value ? `${s.color}20` : "transparent",
                color: status === s.value ? s.color : "#64748b",
                cursor: "pointer",
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Applied date (optional) */}
        {(status === "applied" || status === "interviewing" || status === "offer") && (
          <>
            <label style={labelStyle}>Applied date (optional)</label>
            <input
              type="date"
              value={appliedAt}
              onChange={(e) => setAppliedAt(e.target.value)}
              style={inputStyle}
            />
          </>
        )}

        {/* Notes */}
        <label style={labelStyle}>Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Recruiter name, interview steps, salary discussed..."
          rows={3}
          style={{ ...inputStyle, resize: "vertical" }}
        />

        {error && <div style={{ color: "#f87171", fontSize: 13, marginBottom: 12 }}>{error}</div>}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={btnStyle("#1e1e30", "#94a3b8")}>
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            style={{ ...btnStyle("#6366f1", "#fff"), flex: 1, opacity: loading ? 0.6 : 1 }}
          >
            {loading ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  color: "#64748b",
  marginBottom: 6,
  fontWeight: 500,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  background: "#0a0a18",
  border: "1px solid #1e1e30",
  borderRadius: 8,
  color: "#e2e8f0",
  fontSize: 14,
  marginBottom: 16,
  boxSizing: "border-box",
};

function btnStyle(bg: string, color: string): React.CSSProperties {
  return {
    padding: "10px 20px",
    borderRadius: 8,
    border: "none",
    background: bg,
    color,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  };
}
