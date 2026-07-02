"use client";
// src/components/dashboard/JobCardActions.tsx
// Action button row for a job card: details toggle, optional strategy/track
// buttons, and the apply link.

import type { ScoredJob } from "@/lib/types";

const BTN_CLASS = "cursor-pointer rounded-md border-0 px-3.5 py-1.5 text-[13px] font-medium";

interface Props {
  job: ScoredJob;
  expanded: boolean;
  onToggleExpanded: () => void;
  onTrack?: (job: ScoredJob) => void;
  onStrategy?: (job: ScoredJob) => void;
  isTracked?: boolean;
}

export default function JobCardActions({
  job,
  expanded,
  onToggleExpanded,
  onTrack,
  onStrategy,
  isTracked,
}: Props) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <button
        onClick={onToggleExpanded}
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
  );
}
