// src/components/SourceHealthDashboard.tsx
"use client";

import { CronLog } from "@/lib/types";
import { useState, useMemo } from "react";

interface SourceSummary {
  name: string;
  totalRuns: number;
  successRate: number;
  lastCount: number;
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
      // Sort errors first, then warnings, then ok
      const priority = { error: 0, warning: 1, ok: 2 };
      if (priority[a.status] !== priority[b.status]) return priority[a.status] - priority[b.status];
      return a.name.localeCompare(b.name);
    });
  }, [logs]);

  if (!logs || logs.length === 0) return null;

  return (
    <div className="health-dashboard mt-12 border-t border-white/5 pt-8 px-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-white/40 hover:text-white transition-colors mb-4"
      >
        <span className={`transform transition-transform ${isOpen ? "rotate-90" : ""}`}>▶</span>
        Source Health Monitoring ({summaries.length} sources)
      </button>

      {isOpen && (
        <div className="overflow-x-auto rounded-lg border border-white/5 bg-black/20 backdrop-blur-sm">
          <table className="w-full text-left text-[11px] font-mono leading-tight">
            <thead>
              <tr className="border-b border-white/5 text-white/30 uppercase tracking-tighter">
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Success Rate</th>
                <th className="px-4 py-3 font-medium text-right">Last Match</th>
                <th className="px-4 py-3 font-medium text-right">Avg Time</th>
                <th className="px-4 py-3 font-medium">Last Note</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((s) => (
                <tr
                  key={s.name}
                  className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors"
                >
                  <td className="px-4 py-2 font-medium text-white/80">{s.name}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-flex items-center gap-1.5`}>
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          s.status === "ok"
                            ? "bg-emerald-400"
                            : s.status === "warning"
                              ? "bg-amber-400"
                              : "bg-rose-500"
                        }`}
                      />
                      <span
                        className={
                          s.status === "ok"
                            ? "text-emerald-400/80"
                            : s.status === "warning"
                              ? "text-amber-400/80"
                              : "text-rose-400"
                        }
                      >
                        {s.status === "ok"
                          ? "Online"
                          : s.status === "warning"
                            ? "Zero Matches"
                            : "Failing"}
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-2 text-white/60">
                    <div className="flex items-center gap-2">
                      <div className="h-1 w-12 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500/50"
                          style={{ width: `${s.successRate}%` }}
                        />
                      </div>
                      {Math.round(s.successRate)}%
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right text-white/60">{s.lastCount}</td>
                  <td className="px-4 py-2 text-right text-white/40">
                    {s.avgDuration ? `${(s.avgDuration / 1000).toFixed(1)}s` : "-"}
                  </td>
                  <td className="px-4 py-2 text-white/40 italic truncate max-w-[200px]">
                    {s.lastError || (s.lastCount === 0 ? "No React roles found" : "Active")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
