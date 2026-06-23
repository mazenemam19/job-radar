"use client";
// src/components/dashboard/DashboardClient.tsx

import { useState, useEffect, useCallback } from "react";
import JobCard from "./JobCard";
import StrategyModal from "./StrategyModal";
import TrackerModal from "../tracker/TrackerModal";
import type { ScoredJob, PipelineLog, TrackerEntry } from "@/lib/types";

type FilterMode = "all" | "visa" | "local" | "global";

export default function DashboardClient() {
  const [jobs, setJobs] = useState<ScoredJob[]>([]);
  const [pipelineLog, setPipelineLog] = useState<PipelineLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [filter, setFilter] = useState<FilterMode>("all");
  const [trackedIds, setTrackedIds] = useState<Set<string>>(new Set());
  const [strategyJob, setStrategyJob] = useState<ScoredJob | null>(null);
  const [trackerJob, setTrackerJob] = useState<ScoredJob | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard");
      const data = await res.json();

      if (!data.ok) {
        setError(data.error);
        return;
      }

      setJobs(data.data.jobs);
      setPipelineLog(data.data.pipeline_log);
      setFromCache(data.data.from_cache);

      if (!data.data.from_cache) setRebuilding(false);
    } catch {
      setError("Failed to load jobs. Check your network connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Load tracker entry IDs to show "tracked" state on cards
  const loadTrackedIds = useCallback(async () => {
    const res = await fetch("/api/tracker");
    const data = await res.json();
    if (data.ok) {
      setTrackedIds(new Set((data.data as TrackerEntry[]).map((e) => e.job_id)));
    }
  }, []);

  useEffect(() => {
    load();
    loadTrackedIds();
  }, [load, loadTrackedIds]);

  const filtered = filter === "all" ? jobs : jobs.filter((j) => j.mode === filter);

  const modeCounts = jobs.reduce(
    (acc, j) => ({ ...acc, [j.mode]: (acc[j.mode] ?? 0) + 1 }),
    {} as Record<string, number>,
  );

  if (loading) {
    return (
      <div className="p-12 text-center">
        <div className="mb-4 text-3xl">🔄</div>
        <div className="text-base font-semibold text-indigo-400">
          {rebuilding ? "Running your Gemini filter…" : "Loading your job feed…"}
        </div>
        <div className="mt-2 text-[13px] text-slate-600">
          {rebuilding
            ? "This takes 10–15 seconds on first load after a cron run. Subsequent opens are instant."
            : "Checking your cached results…"}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-12 text-center">
        <div className="mb-3 text-3xl">⚠️</div>
        <div className="mb-4 text-[15px] text-red-400">{error}</div>
        <button
          onClick={load}
          className="rounded-lg border-none bg-indigo-500 px-6 py-2.5 text-sm text-white cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

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
                · {pipelineLog.total_fetched} fetched → {pipelineLog.after_gemini} after your Gemini
                filter
              </span>
            )}
          </div>
        </div>

        <button
          onClick={() => {
            setRebuilding(true);
            load();
          }}
          className="rounded-lg border border-[#1e1e30] bg-[#1e1e30] px-4 py-2 text-[13px] text-indigo-400 cursor-pointer"
        >
          ↺ Rebuild cache
        </button>
      </div>

      {/* Pipeline filter tabs */}
      <div className="mb-5 flex gap-2" role="tablist" aria-label="Filter jobs by pipeline">
        {(
          [
            ["all", `All (${jobs.length})`, ""],
            ["visa", `✈️ Visa (${modeCounts.visa ?? 0})`, "#6366f1"],
            ["local", `🇪🇬 Local (${modeCounts.local ?? 0})`, "#22c55e"],
            ["global", `🌐 Remote (${modeCounts.global ?? 0})`, "#f59e0b"],
          ] as [FilterMode, string, string][]
        ).map(([mode, label, color]) => {
          const active = filter === mode;
          return (
            <button
              key={mode}
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(mode)}
              className="rounded-full px-4 py-1.5 text-[13px] cursor-pointer"
              style={{
                border: `1px solid ${active && color ? color : "#1e1e30"}`,
                background: active && color ? `${color}20` : "transparent",
                color: active ? color || "#e2e8f0" : "#64748b",
                fontWeight: active ? 600 : 400,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

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
          if (trackerJob) setTrackedIds((p) => new Set([...p, trackerJob.id]));
        }}
      />
    </div>
  );
}
