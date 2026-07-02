"use client";
// src/hooks/useDashboardFeed.ts
//
// Owns the dashboard's data: loads the scored job feed, loads which jobs are
// already tracked, and exposes a rebuild action. All of this used to live
// inline in DashboardClient.tsx (audit row #14) — pulled out so the component
// file is just rendering.

import { useCallback, useEffect, useState } from "react";
import type { ScoredJob, PipelineLog, TrackerEntry, ResolvedSettings } from "@/lib/types";

export function useDashboardFeed() {
  const [jobs, setJobs] = useState<ScoredJob[]>([]);
  const [settings, setSettings] = useState<ResolvedSettings | null>(null);
  const [pipelineLog, setPipelineLog] = useState<PipelineLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [trackedIds, setTrackedIds] = useState<Set<string>>(new Set());

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
      if (data.data.settings) setSettings(data.data.settings);

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

  const rebuild = useCallback(() => {
    setRebuilding(true);
    load();
  }, [load]);

  const markTracked = useCallback((jobId: string) => {
    setTrackedIds((prev) => new Set([...prev, jobId]));
  }, []);

  return {
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
  };
}
