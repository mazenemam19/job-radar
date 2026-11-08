"use client";
// src/components/dashboard/JobCard.tsx
// Displays a single job card with live-computed recency score.

import { useState } from "react";
import Link from "next/link";
import { computeLiveDisplayScore } from "@/lib/scoring";
import { formatPostedLabel } from "@/lib/job-display";
import { MODE_COLORS } from "@/lib/constants";
import JobBadges from "./JobBadges";
import JobScoreBreakdown from "./JobScoreBreakdown";
import JobCardActions from "./JobCardActions";
import SearchProfileMatch from "./SearchProfileMatch";
import JobEligibilityEvidence from "./JobEligibilityEvidence";
import type { ScoredJob, ResolvedSettings } from "@/lib/types";

interface Props {
  job: ScoredJob;
  onTrack?: (job: ScoredJob) => void;
  onStrategy?: (job: ScoredJob) => void;
  isTracked?: boolean;
  settings?: ResolvedSettings;
}

export default function JobCard({ job, onTrack, onStrategy, isTracked, settings }: Props) {
  const [expanded, setExpanded] = useState(false);

  // Recency and total score are recomputed live (never trust the stored
  // snapshot) so the badge stays accurate as the job ages between loads.
  const { recencyScore: liveRecencyScore, totalScore: displayTotalScore } =
    computeLiveDisplayScore(job);

  const modeColor = MODE_COLORS[job.mode] ?? "#6366f1";
  const postedLabel = formatPostedLabel(job);
  const locationUncertain = job.location_match_status === "uncertain";

  return (
    <article
      data-testid="job-card"
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

        {locationUncertain ? (
          <div className="max-w-28 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-center text-[11px] font-medium text-amber-300">
            Location unverified<br />not ranked
          </div>
        ) : (
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
        )}
      </div>

      <JobBadges job={job} modeColor={modeColor} settings={settings} />
      <SearchProfileMatch job={job} />
      <JobEligibilityEvidence job={job} />

      {expanded && <JobScoreBreakdown job={job} liveRecencyScore={liveRecencyScore} />}

      <JobCardActions
        job={job}
        expanded={expanded}
        onToggleExpanded={() => setExpanded((p) => !p)}
        onTrack={onTrack}
        onStrategy={onStrategy}
        isTracked={isTracked}
      />
    </article>
  );
}
