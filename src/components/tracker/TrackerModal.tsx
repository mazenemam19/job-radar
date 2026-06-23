"use client";
// src/components/tracker/TrackerModal.tsx

import { useState } from "react";
import type { ScoredJob, TrackerStatus, TrackerJobSnapshot } from "@/lib/types";
import ModalShell from "@/components/ui/ModalShell";

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

const LABEL_CLASS = "mb-1.5 block text-xs font-medium text-[#64748b]";
const INPUT_CLASS =
  "mb-4 w-full rounded-lg border border-[#1e1e30] bg-[#0a0a18] px-3 py-2.5 text-sm text-[#e2e8f0]";
const BTN_CLASS = "cursor-pointer rounded-lg border-0 px-5 py-2.5 text-sm font-semibold";

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
    <ModalShell
      titleId="tracker-modal-title"
      title="Track this job"
      subtitle={`${job.title} · ${job.company}`}
      onClose={onClose}
    >
      {/* Status */}
      <fieldset className="mb-4 border-0 p-0">
        <legend className="mb-1.5 text-xs font-medium text-[#64748b]">Status</legend>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <button
              key={s.value}
              onClick={() => setStatus(s.value)}
              className="cursor-pointer rounded-full border px-3.5 py-1.5 text-[13px]"
              style={{
                borderColor: status === s.value ? s.color : "#1e1e30",
                background: status === s.value ? `${s.color}20` : "transparent",
                color: status === s.value ? s.color : "#64748b",
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Applied date (optional) */}
      {(status === "applied" || status === "interviewing" || status === "offer") && (
        <>
          <label htmlFor="tracker-applied-at" className={LABEL_CLASS}>
            Applied date (optional)
          </label>
          <input
            id="tracker-applied-at"
            type="date"
            value={appliedAt}
            onChange={(e) => setAppliedAt(e.target.value)}
            className={INPUT_CLASS}
          />
        </>
      )}

      {/* Notes */}
      <label htmlFor="tracker-notes" className={LABEL_CLASS}>
        Notes (optional)
      </label>
      <textarea
        id="tracker-notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Recruiter name, interview steps, salary discussed..."
        rows={3}
        className={`${INPUT_CLASS} resize-y`}
      />

      {error && <div className="mb-3 text-[13px] text-[#f87171]">{error}</div>}

      <div className="flex gap-2.5">
        <button
          onClick={onClose}
          className={BTN_CLASS}
          style={{ background: "#1e1e30", color: "#94a3b8" }}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={loading}
          className={`${BTN_CLASS} flex-1`}
          style={{ background: "#6366f1", color: "#fff", opacity: loading ? 0.6 : 1 }}
        >
          {loading ? "Saving..." : "Save"}
        </button>
      </div>
    </ModalShell>
  );
}
