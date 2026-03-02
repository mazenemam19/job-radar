// src/components/SourceHealthDashboard.tsx
"use client";

import { CronLog } from "@/lib/types";
import { useState, useMemo } from "react";

interface SourceSummary {
  name: string;
  totalRuns: number;
  successRate: number;
  lastCount: number;
  lastRawCount?: number;
  lastError?: string;
  avgDuration?: number;
  status: "ok" | "warning" | "error";
}

export default function SourceHealthDashboard({ logs }: { logs: CronLog[] }) {
  const [isOpen, setIsOpen] = useState(false);

  const summaries = useMemo(() => {
    if (!logs || logs.length === 0) return [];

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
      let lastRawCount: number | undefined;
      let lastError: string | undefined;
      let totalDuration = 0;
      let durationCount = 0;

      // Sort logs by runAt descending to get latest info first
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
            lastRawCount = detail.rawCount;
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
        lastRawCount,
        lastError,
        avgDuration: durationCount > 0 ? totalDuration / durationCount : undefined,
        status,
      };
    });

    return result.sort((a, b) => {
      // Sort errors first, then warnings, then ok
      const priority = { error: 0, warning: 1, ok: 2 };
      if (priority[a.status] !== priority[b.status]) return priority[a.status] - priority[b.status];
      return a.name.localeCompare(b.name);
    });
  }, [logs]);

  if (!logs || logs.length === 0) return null;

  return (
    <div className="health-dashboard mt-12 border-t border-white/5 pt-8 px-4 pb-12">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="group flex items-center gap-3 text-xs font-mono uppercase tracking-[0.2em] text-white/30 hover:text-indigo-400 transition-all mb-6"
      >
        <div
          className={`flex items-center justify-center w-5 h-5 rounded border border-white/10 group-hover:border-indigo-500/50 transition-colors ${isOpen ? "bg-indigo-500/10" : ""}`}
        >
          <span
            className={`transform transition-transform duration-200 text-[10px] ${isOpen ? "rotate-90 text-indigo-400" : ""}`}
          >
            ▶
          </span>
        </div>
        Source Health & Fetcher Metrics
        <span className="h-px flex-1 bg-white/5 group-hover:bg-indigo-500/20 transition-colors ml-2" />
      </button>

      {isOpen && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="overflow-x-auto rounded-xl border border-white/5 bg-gradient-to-b from-white/[0.03] to-transparent backdrop-blur-md shadow-2xl">
            <table className="w-full text-left text-[11px] font-mono leading-tight border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-white/20 uppercase tracking-tighter bg-white/[0.02]">
                  <th className="px-6 py-4 font-semibold">Source Name</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold">Stability</th>
                  <th className="px-6 py-4 font-semibold text-center">Raw / Matched</th>
                  <th className="px-6 py-4 font-semibold text-right">Latency</th>
                  <th className="px-6 py-4 font-semibold">Diagnostics</th>
                </tr>
              </thead>
              <tbody>
                {summaries.map((s) => (
                  <tr
                    key={s.name}
                    className="border-b border-white/5 last:border-0 hover:bg-white/[0.03] transition-colors group"
                  >
                    <td className="px-6 py-3 font-medium text-white/70 group-hover:text-white transition-colors">
                      {s.name}
                    </td>
                    <td className="px-6 py-3">
                      <div
                        className={`inline-flex items-center gap-2 px-2 py-1 rounded-md border ${
                          s.status === "ok"
                            ? "bg-emerald-500/5 border-emerald-500/10 text-emerald-400/90"
                            : s.status === "warning"
                              ? "bg-amber-500/5 border-amber-500/10 text-amber-400/90"
                              : "bg-rose-500/5 border-rose-500/10 text-rose-400"
                        }`}
                      >
                        <span
                          className={`h-1 w-1 rounded-full animate-pulse ${
                            s.status === "ok"
                              ? "bg-emerald-400"
                              : s.status === "warning"
                                ? "bg-amber-400"
                                : "bg-rose-500"
                          }`}
                        />
                        <span className="text-[10px] font-bold uppercase tracking-wider">
                          {s.status === "ok"
                            ? "Online"
                            : s.status === "warning"
                              ? "No Hits"
                              : "Failing"}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-1 w-16 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-1000 ${
                              s.successRate > 80
                                ? "bg-indigo-500"
                                : s.successRate > 50
                                  ? "bg-indigo-500/60"
                                  : "bg-rose-500/40"
                            }`}
                            style={{ width: `${s.successRate}%` }}
                          />
                        </div>
                        <span className="text-white/50">{Math.round(s.successRate)}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-center font-bold">
                      <span className="text-white/40">{s.lastRawCount ?? "-"}</span>
                      <span className="mx-2 text-white/10">→</span>
                      <span className={s.lastCount > 0 ? "text-indigo-400" : "text-white/20"}>
                        {s.lastCount}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right tabular-nums">
                      <span
                        className={
                          s.avgDuration && s.avgDuration > 5000
                            ? "text-amber-400/60"
                            : "text-white/40"
                        }
                      >
                        {s.avgDuration ? `${(s.avgDuration / 1000).toFixed(1)}s` : "-"}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <div
                        className="text-[10px] text-white/30 italic max-w-[240px] truncate group-hover:text-white/50 transition-colors"
                        title={s.lastError}
                      >
                        {s.lastError ||
                          (s.lastCount === 0 && (s.lastRawCount ?? 0) > 0
                            ? `${s.lastRawCount} dropped by filters`
                            : "Operating normally")}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 px-2 text-[10px] text-white/20 font-mono italic">
            * Raw counts show jobs found on the board. Matched counts show jobs passing strict
            React/Next.js and Seniority gates.
          </p>
        </div>
      )}
    </div>
  );
}
