"use client";
// src/components/pipeline/FunnelView.tsx

import type { PipelineLog } from "@/lib/types";

interface Props {
  log: PipelineLog | null;
  loading?: boolean;
}

type PipelineCounts = Omit<PipelineLog, "cached_at">;

interface Stage {
  key: keyof PipelineCounts;
  label: string;
  filterLabel: string;
  color: string;
}

const STAGES: Stage[] = [
  {
    key: "total_fetched",
    label: "Fetched",
    filterLabel: "Raw jobs from your enabled source pipelines before profile filtering",
    color: "#6366f1",
  },
  {
    key: "after_date_filter",
    label: "Date filter",
    filterLabel: "Removed jobs older than your configured age limit",
    color: "#818cf8",
  },
  {
    key: "after_workplace_filter",
    label: "Workplace",
    filterLabel:
      "Removed because the stated on-site, hybrid, or remote arrangement does not match your settings. Unknown arrangements stay visible for review.",
    color: "#a78bfa",
  },
  {
    key: "after_employment_filter",
    label: "Job type",
    filterLabel:
      "Removed because the stated full-time, part-time, Werkstudent, contract, or other job type does not match your settings. Missing types stay visible for review.",
    color: "#b794f4",
  },
  {
    key: "after_location_filter",
    label: "Location",
    filterLabel:
      "Removed because the stated country or city does not match your profile. Unknown locations stay visible for review.",
    color: "#d6bcfa",
  },
  {
    key: "after_settings_filter",
    label: "Skills & criteria",
    filterLabel:
      "Removed by the exact skills, required and excluded keywords, seniority, and global-mode checks.",
    color: "#c4b5fd",
  },
  {
    key: "after_gemini_filter",
    label: "Your Gemini filter",
    filterLabel: "Jobs passing your personal AI filter prompt",
    color: "#ddd6fe",
  },
  {
    key: "after_scoring",
    label: "Scoring",
    filterLabel: "Final matches after scoring (jobs scoring 0 are dropped)",
    color: "#ede9fe",
  },
];

function getCounts(log: PipelineLog): PipelineCounts {
  const cachedLog = log as Partial<PipelineLog>;
  const count = (key: keyof PipelineCounts, fallback: number): number => {
    const value = cachedLog[key];
    return typeof value === "number" && value >= 0 ? value : fallback;
  };

  const total = count("total_fetched", 0);
  const afterDate = count("after_date_filter", total);
  const afterWorkplace = count("after_workplace_filter", afterDate);
  const afterEmployment = count("after_employment_filter", afterWorkplace);
  const afterLocation = count("after_location_filter", afterEmployment);

  return {
    total_fetched: total,
    after_date_filter: afterDate,
    after_workplace_filter: afterWorkplace,
    after_employment_filter: afterEmployment,
    after_location_filter: afterLocation,
    after_settings_filter: count("after_settings_filter", afterLocation),
    after_gemini_filter: count("after_gemini_filter", afterLocation),
    after_scoring: count("after_scoring", afterLocation),
  };
}

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

  const counts = getCounts(log);
  const total = counts.total_fetched || 1;

  return (
    <div className="p-8">
      <h1 className="m-0 mb-2 text-[22px] font-bold text-slate-200">Pipeline View</h1>
      <p className="m-0 mb-8 text-sm text-slate-500">
        Last built: {new Date(log.cached_at).toLocaleString()}
      </p>

      {/* Funnel nodes */}
      <div className="flex items-center gap-0 overflow-x-auto pb-4">
        {STAGES.map((stage, i) => {
          const count = counts[stage.key];
          const widthPct = Math.max(12, (count / total) * 100);
          const dropped = i > 0 ? counts[STAGES[i - 1].key] - count : 0;
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
          const before = counts[STAGES[i].key];
          const after = counts[stage.key];
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
        Unknown workplace arrangement, employment type, or location is retained for review rather
        than counted as a hard mismatch. Hover any circle for a description, then adjust the setting
        named by the stage if you want to widen your feed.
      </p>
    </div>
  );
}
