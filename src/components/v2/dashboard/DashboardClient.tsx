"use client";
// src/components/v2/dashboard/DashboardClient.tsx

import { useState, useEffect, useCallback } from "react";
import JobCard from "./JobCard";
import StrategyModal from "./StrategyModal";
import TrackerModal from "../tracker/TrackerModal";
import type { ScoredJob, PipelineLog, TrackerEntry } from "@/lib/v2/types";

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
      const res = await fetch("/api/v2/dashboard");
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
    const res = await fetch("/api/v2/tracker");
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
      <div style={{ padding: 48, textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 16 }}>🔄</div>
        <div style={{ color: "#818cf8", fontSize: 16, fontWeight: 600 }}>
          {rebuilding ? "Running your Gemini filter…" : "Loading your job feed…"}
        </div>
        <div style={{ color: "#475569", fontSize: 13, marginTop: 8 }}>
          {rebuilding
            ? "This takes 10–15 seconds on first load after a cron run. Subsequent opens are instant."
            : "Checking your cached results…"}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 48, textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
        <div style={{ color: "#f87171", fontSize: 15, marginBottom: 16 }}>{error}</div>
        <button
          onClick={load}
          style={{
            padding: "10px 24px",
            background: "#6366f1",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: "28px 32px" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 24,
        }}
      >
        <div>
          <h1 style={{ margin: "0 0 4px", fontSize: 22, color: "#e2e8f0", fontWeight: 700 }}>
            Your Job Feed
          </h1>
          <div style={{ fontSize: 13, color: "#64748b" }}>
            {jobs.length} match{jobs.length !== 1 ? "es" : ""} ·{" "}
            <span style={{ color: fromCache ? "#22c55e" : "#818cf8" }}>
              {fromCache ? "⚡ from cache" : "✨ freshly filtered"}
            </span>
            {pipelineLog && (
              <span style={{ marginLeft: 8, color: "#475569" }}>
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
          style={{
            padding: "8px 16px",
            background: "#1e1e30",
            color: "#818cf8",
            border: "1px solid #1e1e30",
            borderRadius: 8,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          ↺ Rebuild cache
        </button>
      </div>

      {/* Pipeline filter tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {(
          [
            ["all", `All (${jobs.length})`, ""],
            ["visa", `✈️ Visa (${modeCounts.visa ?? 0})`, "#6366f1"],
            ["local", `🇪🇬 Local (${modeCounts.local ?? 0})`, "#22c55e"],
            ["global", `🌐 Remote (${modeCounts.global ?? 0})`, "#f59e0b"],
          ] as [FilterMode, string, string][]
        ).map(([mode, label, color]) => (
          <button
            key={mode}
            onClick={() => setFilter(mode)}
            style={{
              padding: "7px 16px",
              borderRadius: 20,
              fontSize: 13,
              cursor: "pointer",
              border: `1px solid ${filter === mode && color ? color : "#1e1e30"}`,
              background: filter === mode && color ? `${color}20` : "transparent",
              color: filter === mode ? color || "#e2e8f0" : "#64748b",
              fontWeight: filter === mode ? 600 : 400,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Job list */}
      {filtered.length === 0 ? (
        <div
          style={{
            padding: 48,
            textAlign: "center",
            background: "#0d0d1a",
            border: "1px dashed #1e1e30",
            borderRadius: 12,
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
          <p style={{ color: "#64748b", fontSize: 15, margin: 0 }}>
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
