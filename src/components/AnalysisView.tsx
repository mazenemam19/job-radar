// src/components/AnalysisView.tsx
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import type { JobStore } from "@/lib/types";
import AppHeader from "./AppHeader";

interface SourceSummary {
  name: string;
  totalRuns: number;
  successRate: number;
  lastCount: number;
  lastError?: string;
  avgDuration?: number;
  status: "ok" | "warning" | "error";
}

export default function AnalysisView({ cronSecret }: { cronSecret?: string }) {
  const [store, setStore] = useState<JobStore | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/jobs");
      setStore((await res.json()) as JobStore);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const summaries = useMemo(() => {
    if (!store?.cronLogs || store.cronLogs.length === 0) return [];

    const logs = store.cronLogs;
    const sourceNames = new Set<string>();
    logs.forEach((log) => {
      if (log.sourceDetails) {
        Object.keys(log.sourceDetails).forEach((name) => sourceNames.add(name));
      }
    });

    const result: SourceSummary[] = Array.from(sourceNames).map((name) => {
      let successes = 0;
      let totalRuns = 0;
      let lastCount = 0;
      let lastError: string | undefined;
      let totalDuration = 0;
      let durationCount = 0;

      const sortedLogs = [...logs].sort(
        (a, b) => new Date(b.runAt).getTime() - new Date(a.runAt).getTime(),
      );

      sortedLogs.forEach((log, index) => {
        const detail = log.sourceDetails?.[name];
        if (detail) {
          totalRuns++;
          if (!detail.error) successes++;
          if (index === 0) {
            lastCount = detail.count;
            lastError = detail.error;
          }
          if (detail.durationMs) {
            totalDuration += detail.durationMs;
            durationCount++;
          }
        }
      });

      const successRate = totalRuns > 0 ? (successes / totalRuns) * 100 : 0;
      let status: "ok" | "warning" | "error" = "ok";

      if (lastError) status = "error";
      else if (lastCount === 0) status = "warning";

      return {
        name,
        totalRuns,
        successRate,
        lastCount,
        lastError,
        avgDuration: durationCount > 0 ? totalDuration / durationCount : undefined,
        status,
      };
    });

    return result.sort((a, b) => {
      const priority = { error: 0, warning: 1, ok: 2 };
      if (priority[a.status] !== priority[b.status]) return priority[a.status] - priority[b.status];
      return a.name.localeCompare(b.name);
    });
  }, [store]);

  return (
    <div className="app-shell">
      <AppHeader lastUpdated={store?.lastUpdated} onRefresh={loadData} cronSecret={cronSecret} />

      <main className="analysis-page">
        <div className="page-header-simple">
          <h2 className="page-title">Signal Analysis</h2>
          <p className="page-subtitle">
            Monitoring source health and API performance across the last 20 runs.
          </p>
        </div>

        {loading ? (
          <div className="loading-state">Loading analysis data...</div>
        ) : summaries.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">📊</span>
            <p>No analysis data available. Run a scan to generate logs.</p>
          </div>
        ) : (
          <div className="analysis-grid">
            <div className="overflow-x-auto rounded-lg border border-white/5 bg-black/20 backdrop-blur-sm">
              <table className="w-full text-left text-[12px] font-mono leading-tight">
                <thead>
                  <tr className="border-b border-white/5 text-white/30 uppercase tracking-tighter bg-white/5">
                    <th className="px-6 py-4 font-medium">Source</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium">Reliability</th>
                    <th className="px-6 py-4 font-medium text-right">Latest Yield</th>
                    <th className="px-6 py-4 font-medium text-right">Latency</th>
                    <th className="px-6 py-4 font-medium">Last Incident / Note</th>
                  </tr>
                </thead>
                <tbody>
                  {summaries.map((s) => (
                    <tr
                      key={s.name}
                      className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors"
                    >
                      <td className="px-6 py-4 font-semibold text-white/90">{s.name}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-2`}>
                          <span
                            className={`h-2 w-2 rounded-full ${
                              s.status === "ok"
                                ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"
                                : s.status === "warning"
                                  ? "bg-amber-400"
                                  : "bg-rose-500"
                            }`}
                          />
                          <span
                            className={
                              s.status === "ok"
                                ? "text-emerald-400"
                                : s.status === "warning"
                                  ? "text-amber-400"
                                  : "text-rose-400"
                            }
                          >
                            {s.status === "ok"
                              ? "HEALTHY"
                              : s.status === "warning"
                                ? "EMPTY"
                                : "FAILING"}
                          </span>
                        </span>
                      </td>
                      <td className="px-6 py-4 text-white/60">
                        <div className="flex items-center gap-3">
                          <div className="h-1.5 w-16 bg-white/5 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${s.successRate > 80 ? "bg-accent" : "bg-amber-500"}`}
                              style={{ width: `${s.successRate}%` }}
                            />
                          </div>
                          <span className="text-white/80">{Math.round(s.successRate)}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span
                          className={`font-bold ${s.lastCount > 0 ? "text-white" : "text-white/20"}`}
                        >
                          {s.lastCount}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-white/40 italic">
                        {s.avgDuration ? `${(s.avgDuration / 1000).toFixed(2)}s` : "-"}
                      </td>
                      <td className="px-6 py-4 text-white/40 italic max-w-[300px] truncate">
                        {s.lastError ||
                          (s.lastCount === 0 ? "Filtered out all roles" : "Operational")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="analysis-summary mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="summary-card">
                <span className="summary-val text-emerald-400">
                  {summaries.filter((s) => s.status === "ok").length}
                </span>
                <span className="summary-label">Healthy Sources</span>
              </div>
              <div className="summary-card">
                <span className="summary-val text-amber-400">
                  {summaries.filter((s) => s.status === "warning").length}
                </span>
                <span className="summary-label">Zero Yield</span>
              </div>
              <div className="summary-card">
                <span className="summary-val text-rose-500">
                  {summaries.filter((s) => s.status === "error").length}
                </span>
                <span className="summary-label">Critical Errors</span>
              </div>
            </div>
          </div>
        )}
      </main>

      <style jsx>{`
        .page-header-simple {
          padding: 40px 0 32px;
        }
        .page-title {
          font-family: var(--font-display);
          font-size: 32px;
          font-weight: 800;
          color: #fff;
          letter-spacing: -0.02em;
        }
        .page-subtitle {
          color: var(--text-muted);
          font-size: 14px;
          margin-top: 8px;
        }
        .loading-state {
          padding: 100px 0;
          text-align: center;
          font-family: var(--font-mono);
          color: var(--text-muted);
        }
        .summary-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }
        .summary-val {
          font-family: var(--font-display);
          font-size: 36px;
          font-weight: 800;
        }
        .summary-label {
          font-family: var(--font-mono);
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--text-muted);
        }
      `}</style>
    </div>
  );
}
