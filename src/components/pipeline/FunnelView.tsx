"use client";
// src/components/pipeline/FunnelView.tsx

import type { PipelineLog, GateBreakdowns } from "@/lib/types";
import GateAccordionRow, { type AccordionEntry } from "./GateAccordionRow";

interface Props {
  log: PipelineLog | null;
  loading?: boolean;
}

interface FunnelTile {
  label: string;
  description: string;
  value: number;
  color: string;
}

type GateKey = keyof GateBreakdowns;

const GATE_META: Record<GateKey, { label: string; description: string }> = {
  date: {
    label: "Date filter",
    description: "Removed jobs older than your configured age limit.",
  },
  seniority: {
    label: "Seniority filter",
    description: "Removed jobs whose seniority level isn't one you selected.",
  },
  excluded_keywords: {
    label: "Excluded keywords",
    description: "Removed jobs whose title matched a keyword you excluded.",
  },
  required_keywords: {
    label: "Required keywords",
    description: "Removed jobs that didn't match any of your required (or expert) skills.",
  },
  blacklisted_locations: {
    label: "Blacklisted locations",
    description: "Removed jobs matching a location or term you blacklisted.",
  },
  skill_match: {
    label: "Skill match",
    description: "Removed jobs whose description didn't meaningfully match your skills.",
  },
  global_mode: {
    label: "Global-mode region filter",
    description: "Removed remote jobs outside your allowed regions (global pipeline only).",
  },
  gemini: {
    label: "Your Gemini filter",
    description: "Removed jobs your personal AI filter prompt rejected.",
  },
  scoring: {
    label: "Scoring",
    description: "Removed jobs that scored 0 after skill, recency, and relocation weighting.",
  },
};

const GATE_ORDER: GateKey[] = [
  "date",
  "seniority",
  "excluded_keywords",
  "required_keywords",
  "blacklisted_locations",
  "skill_match",
  "global_mode",
  "gemini",
  "scoring",
];

function toEntries(
  sample: Array<{ id: string; title: string; company: string; reason: string | null }>,
): AccordionEntry[] {
  return sample.map((s) => ({
    id: s.id,
    title: s.title,
    company: s.company,
    detail: s.reason ?? "—",
  }));
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

  const tiles: FunnelTile[] = [
    {
      label: "Scraped this run",
      description: "Every job in the raw pool, any pipeline mode.",
      value: log.total_scraped,
      color: "#6366f1",
    },
    {
      label: "Matched your pipelines",
      description: "Jobs whose mode is one of your enabled pipelines.",
      value: log.matched_pipelines,
      color: "#a78bfa",
    },
    {
      label: "In candidate window",
      description: "The pool your gates actually ran against (capped at 2,000).",
      value: log.candidate_window,
      color: "#c4b5fd",
    },
  ];
  const maxTile = Math.max(1, ...tiles.map((t) => t.value));

  return (
    <div className="p-8">
      <h1 className="m-0 mb-2 text-[22px] font-bold text-slate-200">Pipeline View</h1>
      <p className="m-0 mb-8 text-sm text-slate-500">
        Last built: {new Date(log.cached_at).toLocaleString()}
      </p>

      {/* Top funnel: scraped → matched pipelines → candidate window */}
      <div className="flex items-stretch gap-0 overflow-x-auto pb-2">
        {tiles.map((tile, i) => {
          const dropped = i > 0 ? tiles[i - 1].value - tile.value : 0;
          const heightPct = Math.max(15, (tile.value / maxTile) * 100);

          return (
            <div key={tile.label} className="flex shrink-0 items-center">
              {i > 0 && (
                <div className="flex flex-col items-center px-3">
                  <div className="text-xl text-slate-600">→</div>
                  {dropped > 0 && (
                    <div className="max-w-[90px] text-center text-[10px] leading-tight text-red-500">
                      −{dropped.toLocaleString()}
                    </div>
                  )}
                </div>
              )}
              <div
                title={tile.description}
                className="flex min-w-[140px] flex-col items-center justify-end gap-2 rounded-xl border bg-[#0d0d1a] px-4 py-5 cursor-help"
                style={{ borderColor: `${tile.color}40` }}
              >
                <div
                  className="w-full rounded-md"
                  style={{ height: `${heightPct}px`, background: `${tile.color}30` }}
                />
                <span className="text-lg font-bold" style={{ color: tile.color }}>
                  {tile.value.toLocaleString()}
                </span>
                <span className="text-center text-xs font-medium text-slate-400">{tile.label}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Ingestion-level losses — same accordion styling as the gate rows below */}
      <div className="mt-8 overflow-hidden rounded-xl border border-[#1e1e30] bg-[#0d0d1a]">
        <div className="border-b border-[#1e1e30] px-5 py-3.5 text-[13px] font-semibold text-slate-500">
          Before any gate runs
        </div>
        <GateAccordionRow
          label="Wrong pipeline mode"
          description="Jobs from companies whose pipeline isn't one you've enabled."
          count={log.wrong_pipeline_mode.count}
          detailLabel="Mode"
          note={`Your enabled pipelines: ${log.wrong_pipeline_mode.enabled_pipelines.join(", ") || "none"}`}
          entries={log.wrong_pipeline_mode.sample.map((s) => ({
            id: s.id,
            title: s.title,
            company: s.company,
            detail: s.mode,
          }))}
        />
        <GateAccordionRow
          label="Outside candidate window"
          description="Jobs that matched your pipelines but were cut by the 2,000-job cap."
          count={log.outside_candidate_window.count}
          detailLabel="Fetched"
          entries={log.outside_candidate_window.sample.map((s) => ({
            id: s.id,
            title: s.title,
            company: s.company,
            detail: new Date(s.fetched_at).toLocaleString(),
          }))}
        />
      </div>

      {/* Per-gate breakdown, in production order */}
      <div className="mt-4 overflow-hidden rounded-xl border border-[#1e1e30] bg-[#0d0d1a]">
        <div className="border-b border-[#1e1e30] px-5 py-3.5 text-[13px] font-semibold text-slate-500">
          Gate by gate
        </div>
        {GATE_ORDER.map((key) => {
          const gate = log.gates[key];
          const meta = GATE_META[key];
          return (
            <GateAccordionRow
              key={key}
              label={meta.label}
              description={meta.description}
              count={gate.count}
              detailLabel="Reason"
              entries={toEntries(gate.sample)}
            />
          );
        })}
      </div>

      {/* Final summary */}
      <div className="mt-4 flex items-center gap-3 rounded-xl border border-[#1e1e30] bg-[#0d0d1a] px-5 py-4">
        <span className="text-lg font-bold text-emerald-400">
          {log.on_dashboard.toLocaleString()}
        </span>
        <span className="text-[13px] text-slate-400">jobs on your dashboard</span>
      </div>

      <p className="mt-4 text-xs text-slate-600">
        Hover any tile or row for what it checks. Expand a row to see which jobs it dropped and why.
        To see more jobs, try widening your age limit, enabling more pipelines, or softening your
        Gemini prompt in Settings.
      </p>
    </div>
  );
}
