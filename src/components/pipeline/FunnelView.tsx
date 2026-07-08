"use client";
// src/components/pipeline/FunnelView.tsx

import type { PipelineLog } from "@/lib/types";

interface Props {
  log: PipelineLog | null;
  loading?: boolean;
}

interface Stage {
  key: keyof Omit<PipelineLog, "cached_at">;
  label: string;
  filterLabel: string;
  color: string;
}

const STAGES: Stage[] = [
  {
    key: "total_fetched",
    label: "Fetched",
    filterLabel: "All raw jobs from ATS sources this cron run",
    color: "#6366f1",
  },
  {
    key: "after_date_filter",
    label: "Date filter",
    filterLabel: "Removed jobs older than your configured age limit",
    color: "#818cf8",
  },
  {
    key: "after_settings_filter",
    label: "Settings filter",
    filterLabel: "Removed jobs that failed seniority gate or disabled pipelines",
    color: "#a78bfa",
  },
  {
    key: "after_gemini_filter",
    label: "Your Gemini filter",
    filterLabel: "Jobs passing your personal AI filter prompt",
    color: "#c4b5fd",
  },
  {
    key: "after_scoring",
    label: "Scoring",
    filterLabel: "Final matches after scoring (jobs scoring 0 are dropped)",
    color: "#e9d5ff",
  },
];

export default function FunnelView({ log, loading }: Props) {
  if (loading) {
    return <div className="p-12 text-center text-slate-500">Loading pipeline data...</div>;
  }

  if (!log) {
    return (
      <div className="rounded-xl border border-dashed border-[#1e1e30] bg-[#0d0d1a] p-12 text-center">
        <div className="mb-3 text-3xl">🔭</div>
        <p className="m-0 text-[15px] text-slate-500">No pipeline data yet</p>
        <p className="mt-2 text-[13px] text-slate-600">
          Open your dashboard to trigger a cache build
        </p>
      </div>
    );
  }

  const total = log.total_fetched || 1;

  return (
    <div className="p-8">
      <h1 className="m-0 mb-2 text-[22px] font-bold text-slate-200">Pipeline View</h1>
      <p className="m-0 mb-8 text-sm text-slate-500">
        Last built: {new Date(log.cached_at).toLocaleString()}
      </p>

      {/* Funnel nodes */}
      <div className="flex items-center gap-0 overflow-x-auto pb-4">
        {STAGES.map((stage, i) => {
          const count = log[stage.key];
          const widthPct = Math.max(12, (count / total) * 100);
          const dropped = i > 0 ? log[STAGES[i - 1].key] - count : 0;
          const circleSize = `${Math.min(100, Math.max(56, widthPct * 0.8))}px`;

          return (
            <div key={stage.key} className="flex shrink-0 items-center">
              {/* Arrow between nodes */}
              {i > 0 && (
                <div className="flex flex-col items-center px-2">
                  <div className="text-xl text-slate-600">→</div>
                  {dropped > 0 && (
                    <div className="max-w-[60px] text-center text-[10px] leading-tight text-red-500">
                      −{dropped}
                    </div>
                  )}
                </div>
              )}

              {/* Node */}
              <div
                title={stage.filterLabel}
                className="flex min-w-[100px] flex-col items-center rounded-xl border bg-[#0d0d1a] px-3 py-5 cursor-help"
                style={{ borderColor: `${stage.color}40` }}
              >
                {/* Circle with count */}
                <div
                  className="flex items-center justify-center rounded-full border-2 transition-all duration-300 ease-in-out"
                  style={{
                    width: circleSize,
                    height: circleSize,
                    background: `${stage.color}15`,
                    borderColor: stage.color,
                  }}
                >
                  <span className="text-lg font-bold" style={{ color: stage.color }}>
                    {count.toLocaleString()}
                  </span>
                </div>

                <div className="mt-2.5 text-center text-xs font-medium text-slate-400">
                  {stage.label}
                </div>

                <div className="mt-0.5 text-[10px] text-slate-600">
                  {Math.round((count / total) * 100)}% of total
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Explanatory table */}
      <div className="mt-8 overflow-hidden rounded-xl border border-[#1e1e30] bg-[#0d0d1a]">
        <div className="border-b border-[#1e1e30] px-5 py-3.5 text-[13px] font-semibold text-slate-500">
          What was filtered at each stage
        </div>
        {STAGES.slice(1).map((stage, i) => {
          const before = log[STAGES[i].key];
          const after = log[stage.key];
          const diff = before - after;

          return (
            <div
              key={stage.key}
              className="flex items-center border-b border-[#0d0d1a] px-5 py-3 text-[13px]"
            >
              <span className="flex-1 text-slate-400">{stage.label}</span>
              <span className={`font-semibold ${diff > 0 ? "text-red-500" : "text-slate-500"}`}>
                {diff > 0 ? `−${diff}` : "none"} removed
              </span>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-slate-600">
        Hover any circle for a description of what was filtered. To see more jobs, try widening your
        age limit, enabling more pipelines, or softening your Gemini prompt in Settings.
      </p>
    </div>
  );
}
