// src/components/SourceHealthDashboard.tsx
"use client";

import { CronLog, SourceSummary } from "@/lib/types";
import { useState, useMemo } from "react";

export default function SourceHealthDashboard({
  logs,
  alwaysOpen = false,
}: {
  logs: CronLog[];
  alwaysOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(alwaysOpen);

  const summaries = useMemo(() => {
    if (!logs || logs.length === 0) return [];

    // Only consider sources present in the LATEST log to prune removed/stale sources
    const latestLog = [...logs].sort(
      (a, b) => new Date(b.runAt).getTime() - new Date(a.runAt).getTime(),
    )[0];

    const sourceNames = latestLog.sourceDetails ? Object.keys(latestLog.sourceDetails) : [];

    const result: SourceSummary[] = sourceNames.map((name) => {
      let successes = 0;
      let totalRuns = 0;
      let totalDuration = 0;
      let durationCount = 0;

      const sortedLogs = [...logs].sort(
        (a, b) => new Date(b.runAt).getTime() - new Date(a.runAt).getTime(),
      );

      const lastLogWithSource = sortedLogs.find((log) => log.sourceDetails?.[name]);
      const lastDetail = lastLogWithSource?.sourceDetails?.[name];
      const lastCount = lastDetail?.count ?? 0;
      const lastRawCount = lastDetail?.rawCount;
      const lastError = lastDetail?.error;
      const lastStatus = lastDetail?.status;

      sortedLogs.forEach((log) => {
        const detail = log.sourceDetails?.[name];
        if (detail) {
          totalRuns++;
          if (!detail.error) successes++;
          if (detail.durationMs) {
            totalDuration += detail.durationMs;
            durationCount++;
          }
        }
      });

      const successRate = totalRuns > 0 ? (successes / totalRuns) * 100 : 0;

      let status: "healthy" | "nomatch" | "warning" | "error" | "skipped" = "healthy";

      if (lastStatus === "skipped") {
        status = "skipped";
      } else if (lastError) {
        status = "error";
      } else if (lastCount > 0) {
        status = "healthy";
      } else if ((lastRawCount ?? 0) === 0) {
        status = "warning";
      } else {
        status = "nomatch";
      }

      return {
        name,
        totalRuns,
        successRate,
        lastCount,
        lastRawCount,
        lastError,
        avgDuration: durationCount > 0 ? totalDuration / durationCount : undefined,
        status,
      };
    });

    return result.sort((a, b) => {
      const priority = { error: 0, healthy: 1, warning: 2, nomatch: 3, skipped: 4 };
      if (priority[a.status] !== priority[b.status]) return priority[a.status] - priority[b.status];
      return a.name.localeCompare(b.name);
    });
  }, [logs]);

  const stats = useMemo(() => {
    return {
      failed: summaries.filter((s) => s.status === "error").length,
      active: summaries.filter((s) => s.status === "healthy").length,
      empty: summaries.filter((s) => s.status === "warning").length,
      filtered: summaries.filter((s) => s.status === "nomatch").length,
      skipped: summaries.filter((s) => s.status === "skipped").length,
    };
  }, [summaries]);

  if (!logs || logs.length === 0) return null;

  return (
    <div className={`${alwaysOpen ? "" : "mt-20 mb-24"} px-4 max-w-7xl mx-auto font-body`}>
      <style jsx>{`
        .health-table-wrap {
          background: #0f0f1c;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4);
        }
        .health-table {
          width: 100%;
          border-collapse: collapse;
          font-family: var(--font-mono);
          font-size: 12px;
        }
        .health-table th {
          background: rgba(255, 255, 255, 0.03);
          padding: 16px 24px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          font-size: 10px;
          color: rgba(255, 255, 255, 0.25);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          font-weight: 700;
        }
        .health-table td {
          padding: 12px 24px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }

        .row-error {
          background: rgba(244, 63, 94, 0.06);
          color: #fb7185;
        }
        .row-healthy {
          background: rgba(74, 222, 128, 0.03);
          color: #4ade80;
        }
        .row-warning {
          background: rgba(251, 191, 36, 0.04);
          color: #fbbf24;
        }
        .row-nomatch {
          background: transparent;
          color: #fff;
        }
        .row-skipped {
          background: rgba(59, 130, 246, 0.05);
          color: #93c5fd;
        }

        .status-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 4px;
          font-size: 9px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border: 1px solid transparent;
        }
        .status-pill.error {
          background: rgba(244, 63, 94, 0.15);
          border-color: rgba(244, 63, 94, 0.3);
          color: #fb7185;
        }
        .status-pill.healthy {
          background: rgba(74, 222, 128, 0.1);
          border-color: rgba(74, 222, 128, 0.2);
          color: #4ade80;
        }
        .status-pill.warning {
          background: rgba(251, 191, 36, 0.1);
          border-color: rgba(251, 191, 36, 0.2);
          color: #fbbf24;
        }
        .status-pill.nomatch {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(255, 255, 255, 0.1);
          color: #fff;
        }
        .status-pill.skipped {
          background: rgba(59, 130, 246, 0.1);
          border-color: rgba(59, 130, 246, 0.2);
          color: #93c5fd;
        }

        .dot {
          width: 4px;
          height: 4px;
          border-radius: 50%;
        }
        .dot.error {
          background: #fb7185;
          animation: pulse 1.5s infinite;
          box-shadow: 0 0 8px #f43f5e;
        }
        .dot.healthy {
          background: #4ade80;
          box-shadow: 0 0 6px #4ade80;
        }
        .dot.warning {
          background: #fbbf24;
        }
        .dot.nomatch {
          background: #fff;
        }
        .dot.skipped {
          background: #93c5fd;
        }

        @keyframes pulse {
          0% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.5);
            opacity: 0.5;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        .val-mute {
          opacity: 0.3;
        }
        .val-bright {
          font-weight: 800;
        }

        .legend-item {
          display: flex;
          align-items: baseline;
          gap: 8px;
          padding: 8px 16px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
        }
        .legend-count {
          font-family: var(--font-mono);
          font-size: 16px;
          font-weight: 700;
        }
        .legend-label {
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          opacity: 0.4;
        }
      `}</style>

      <header className="flex items-center justify-between mb-8 border-b border-white/5 pb-6">
        <div>
          <h2 className="text-xl font-display font-bold text-white tracking-tight">
            {alwaysOpen ? "Source Health v3.3" : "Engine Diagnostics"}
          </h2>
          <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-white/20 mt-1">
            {alwaysOpen
              ? "Real-time monitoring of engine source health and pipeline volume"
              : "Fetcher Lifecycle Diagnostics"}
          </p>
        </div>
        {!alwaysOpen && (
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="bg-white/5 hover:bg-white/10 border border-white/10 px-6 py-2 rounded-lg text-[11px] font-mono uppercase tracking-widest text-white/60 transition-all shadow-xl hover:text-white"
          >
            {isOpen ? "[ System Offline ]" : "[ Run Diagnostics ]"}
          </button>
        )}
      </header>

      {isOpen && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-500">
          {/* LEGEND SUMMARY */}
          <div className="flex flex-wrap gap-4 mb-8">
            <div className="legend-item border-rose-500/20 bg-rose-500/5">
              <span className="legend-count text-rose-400">{stats.failed}</span>
              <span className="legend-label">Failed Fetch</span>
            </div>
            <div className="legend-item border-emerald-500/20 bg-emerald-500/5">
              <span className="legend-count text-emerald-400">{stats.active}</span>
              <span className="legend-label">Active Matches</span>
            </div>
            <div className="legend-item border-amber-500/20 bg-amber-500/5">
              <span className="legend-count text-amber-400">{stats.empty}</span>
              <span className="legend-label">Empty (Source)</span>
            </div>
            <div className="legend-item border-white/10 bg-white/5">
              <span className="legend-count text-white">{stats.filtered}</span>
              <span className="legend-label">Filtered Out</span>
            </div>
            <div className="legend-item border-blue-400/20 bg-blue-400/5">
              <span className="legend-count text-blue-300">{stats.skipped}</span>
              <span className="legend-label">Skipped</span>
            </div>
          </div>

          <div className="health-table-wrap">
            <table className="health-table">
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Engine Source</th>
                  <th style={{ textAlign: "center" }}>Operation State</th>
                  <th style={{ textAlign: "center" }}>Reliability</th>
                  <th style={{ textAlign: "center" }}>Raw Signal</th>
                  <th style={{ textAlign: "center" }}>Matched Signal</th>
                  <th style={{ textAlign: "right" }}>Latency</th>
                  <th style={{ textAlign: "left" }}>System Logs</th>
                </tr>
              </thead>
              <tbody>
                {summaries.map((s) => {
                  return (
                    <tr key={s.name} className={`row-${s.status}`}>
                      <td style={{ fontWeight: 700 }}>{s.name}</td>
                      <td style={{ textAlign: "center" }}>
                        <div className={`status-pill ${s.status}`}>
                          <div className={`dot ${s.status}`} />
                          {s.status === "error"
                            ? "Failed"
                            : s.status === "healthy"
                              ? "Active"
                              : s.status === "warning"
                                ? "Empty"
                                : s.status === "skipped"
                                  ? "Skipped"
                                  : "Filtered"}
                        </div>
                      </td>
                      <td style={{ textAlign: "center" }} className="val-mute">
                        {Math.round(s.successRate)}%
                      </td>
                      <td
                        style={{ textAlign: "center" }}
                        className={s.status === "warning" ? "" : "val-mute"}
                      >
                        {s.lastRawCount ?? 0}
                      </td>
                      <td
                        style={{ textAlign: "center" }}
                        className={s.status === "healthy" ? "val-bright" : "val-mute"}
                      >
                        {s.lastCount}
                      </td>
                      <td style={{ textAlign: "right" }} className="val-mute">
                        {s.avgDuration ? `${(s.avgDuration / 1000).toFixed(2)}s` : "--"}
                      </td>
                      <td style={{ fontSize: "10px", opacity: 0.6, fontStyle: "italic" }}>
                        {s.lastError ||
                          (s.status === "warning"
                            ? "No data found on board"
                            : s.status === "nomatch"
                              ? `${s.lastRawCount} entries dropped by tech-gate`
                              : s.status === "skipped"
                                ? "Skipped in current batch rotation"
                                : "Optimal matching confirmed")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
