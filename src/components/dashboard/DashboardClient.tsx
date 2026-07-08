"use client";
// src/components/dashboard/DashboardClient.tsx

import { useState } from "react";
import JobCard from "./JobCard";
import StrategyModal from "./StrategyModal";
import TrackerModal from "../tracker/TrackerModal";
import DashboardLoadingState from "./DashboardLoadingState";
import DashboardErrorState from "./DashboardErrorState";
import FilterTabs from "./FilterTabs";
import { useDashboardFeed } from "@/hooks/useDashboardFeed";
import { computeModeCounts, filterJobsByMode } from "@/lib/dashboard-client";
import type { ScoredJob, FilterMode } from "@/lib/types";

export default function DashboardClient() {
  const {
    jobs,
    settings,
    pipelineLog,
    loading,
    rebuilding,
    error,
    fromCache,
    trackedIds,
    load,
    rebuild,
    markTracked,
  } = useDashboardFeed();
  const [filter, setFilter] = useState<FilterMode>("all");
  const [strategyJob, setStrategyJob] = useState<ScoredJob | null>(null);
  const [trackerJob, setTrackerJob] = useState<ScoredJob | null>(null);

  if (loading) return <DashboardLoadingState rebuilding={rebuilding} />;
  if (error) return <DashboardErrorState error={error} onRetry={load} />;

  const filtered = filterJobsByMode(jobs, filter);
  const modeCounts = computeModeCounts(jobs);

  return (
    <div className="px-8 py-7">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="m-0 mb-1 text-[22px] font-bold text-slate-200">Your Job Feed</h1>
          <div className="text-[13px] text-slate-500">
            {jobs.length} match{jobs.length !== 1 ? "es" : ""} ·{" "}
            <span className={fromCache ? "text-green-500" : "text-indigo-400"}>
              {fromCache ? "⚡ from cache" : "✨ freshly filtered"}
            </span>
            {pipelineLog && (
              <span className="ml-2 text-slate-600">
                · {pipelineLog.total_fetched} fetched → {pipelineLog.after_gemini_filter} after your
                Gemini filter
              </span>
            )}
          </div>
        </div>

        <button
          onClick={rebuild}
          className="rounded-lg border border-[#1e1e30] bg-[#1e1e30] px-4 py-2 text-[13px] text-indigo-400 cursor-pointer"
        >
          ↺ Rebuild cache
        </button>
      </div>

      <FilterTabs
        filter={filter}
        counts={modeCounts}
        totalJobs={jobs.length}
        onChange={setFilter}
      />

      {/* Job list */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#1e1e30] bg-[#0d0d1a] p-12 text-center">
          <div className="mb-3 text-3xl">🔍</div>
          <p className="m-0 text-[15px] text-slate-500">
            {jobs.length === 0
              ? "No jobs matched your filter settings. Try widening your Gemini prompt or enabling more pipelines."
              : 'No jobs in this pipeline. Switch to "All" or enable this pipeline in Settings.'}
          </p>
        </div>
      ) : (
        <div>
          {filtered.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              isTracked={trackedIds.has(job.id)}
              onStrategy={(j) => setStrategyJob(j)}
              onTrack={(j) => setTrackerJob(j)}
              settings={settings ?? undefined}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <StrategyModal job={strategyJob} onClose={() => setStrategyJob(null)} />
      <TrackerModal
        job={trackerJob}
        onClose={() => setTrackerJob(null)}
        onSaved={() => {
          if (trackerJob) markTracked(trackerJob.id);
        }}
      />
    </div>
  );
}
