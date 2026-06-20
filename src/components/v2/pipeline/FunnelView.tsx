"use client";
// src/components/v2/pipeline/FunnelView.tsx

import type { PipelineLog } from "@/lib/v2/types";

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
    key: "after_gemini",
    label: "Your Gemini filter",
    filterLabel: "Final matches passing your personal AI filter prompt",
    color: "#c4b5fd",
  },
];

export default function FunnelView({ log, loading }: Props) {
  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: "center", color: "#64748b" }}>
        Loading pipeline data...
      </div>
    );
  }

  if (!log) {
    return (
      <div
        style={{
          padding: 48,
          textAlign: "center",
          background: "#0d0d1a",
          border: "1px dashed #1e1e30",
          borderRadius: 12,
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 12 }}>🔭</div>
        <p style={{ color: "#64748b", fontSize: 15, margin: 0 }}>No pipeline data yet</p>
        <p style={{ color: "#475569", fontSize: 13, marginTop: 8 }}>
          Open your dashboard to trigger a cache build
        </p>
      </div>
    );
  }

  const total = log.total_fetched || 1;

  return (
    <div style={{ padding: 32 }}>
      <h1 style={{ margin: "0 0 8px", fontSize: 22, color: "#e2e8f0", fontWeight: 700 }}>
        Pipeline View
      </h1>
      <p style={{ margin: "0 0 32px", color: "#64748b", fontSize: 14 }}>
        Last built: {new Date(log.cached_at).toLocaleString()}
      </p>

      {/* Funnel nodes */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          overflowX: "auto",
          gap: 0,
          paddingBottom: 16,
        }}
      >
        {STAGES.map((stage, i) => {
          const count = log[stage.key];
          const widthPct = Math.max(12, (count / total) * 100);
          const dropped = i > 0 ? log[STAGES[i - 1].key] - count : 0;

          return (
            <div key={stage.key} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
              {/* Arrow between nodes */}
              {i > 0 && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    padding: "0 8px",
                  }}
                >
                  <div style={{ color: "#475569", fontSize: 20 }}>→</div>
                  {dropped > 0 && (
                    <div
                      style={{
                        fontSize: 10,
                        color: "#ef4444",
                        textAlign: "center",
                        maxWidth: 60,
                        lineHeight: 1.3,
                      }}
                    >
                      −{dropped}
                    </div>
                  )}
                </div>
              )}

              {/* Node */}
              <div
                title={stage.filterLabel}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  padding: "20px 12px",
                  background: "#0d0d1a",
                  border: `1px solid ${stage.color}40`,
                  borderRadius: 12,
                  minWidth: 100,
                  cursor: "help",
                }}
              >
                {/* Circle with count */}
                <div
                  style={{
                    width: `${Math.min(100, Math.max(56, widthPct * 0.8))}px`,
                    height: `${Math.min(100, Math.max(56, widthPct * 0.8))}px`,
                    borderRadius: "50%",
                    background: `${stage.color}15`,
                    border: `2px solid ${stage.color}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.3s ease",
                  }}
                >
                  <span style={{ fontSize: 18, fontWeight: 700, color: stage.color }}>
                    {count.toLocaleString()}
                  </span>
                </div>

                <div
                  style={{
                    marginTop: 10,
                    fontSize: 12,
                    color: "#94a3b8",
                    textAlign: "center",
                    fontWeight: 500,
                  }}
                >
                  {stage.label}
                </div>

                <div style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>
                  {Math.round((count / total) * 100)}% of total
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Explanatory table */}
      <div
        style={{
          marginTop: 32,
          background: "#0d0d1a",
          border: "1px solid #1e1e30",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "14px 20px",
            borderBottom: "1px solid #1e1e30",
            fontSize: 13,
            color: "#64748b",
            fontWeight: 600,
          }}
        >
          What was filtered at each stage
        </div>
        {STAGES.slice(1).map((stage, i) => {
          const before = log[STAGES[i].key];
          const after = log[stage.key];
          const diff = before - after;

          return (
            <div
              key={stage.key}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "12px 20px",
                borderBottom: "1px solid #0d0d1a",
                fontSize: 13,
              }}
            >
              <span style={{ color: "#94a3b8", flex: 1 }}>{stage.label}</span>
              <span style={{ color: diff > 0 ? "#ef4444" : "#64748b", fontWeight: 600 }}>
                {diff > 0 ? `−${diff}` : "none"} removed
              </span>
            </div>
          );
        })}
      </div>

      <p style={{ marginTop: 16, fontSize: 12, color: "#475569" }}>
        Hover any circle for a description of what was filtered. To see more jobs, try widening your
        age limit, enabling more pipelines, or softening your Gemini prompt in Settings.
      </p>
    </div>
  );
}
