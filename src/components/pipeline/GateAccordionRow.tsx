"use client";
// src/components/pipeline/GateAccordionRow.tsx
// One expandable row in the pipeline breakdown: a gate or an ingestion-level
// loss, its true drop count, and (on expand) a capped, most-recent-first
// table of which jobs were dropped there and why. Reused by every gate and
// both ingestion-loss sections in FunnelView — same visual treatment for
// both, per the confirmed design (no separate styling for ingestion losses).

import { useState } from "react";

export interface AccordionEntry {
  id: string;
  title: string;
  company: string;
  /** The one variable column: a gate's drop reason, a job's mode, or its fetched time. */
  detail: string;
}

interface Props {
  label: string;
  description: string;
  count: number;
  /** Capped sample of dropped jobs, most-recently-fetched first. */
  entries: AccordionEntry[];
  /** Column header for `entry.detail` — "Reason", "Mode", "Fetched", etc. */
  detailLabel: string;
  /** Optional section-level context shown above the table (e.g. the user's enabled pipelines). */
  note?: string;
}

export default function GateAccordionRow({
  label,
  description,
  count,
  entries,
  detailLabel,
  note,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const canExpand = count > 0;

  return (
    <div className="border-b border-[#1e1e30] last:border-b-0">
      <button
        type="button"
        onClick={() => canExpand && setExpanded((v) => !v)}
        aria-expanded={expanded}
        disabled={!canExpand}
        title={description}
        className="flex w-full items-center gap-3 px-5 py-3.5 text-left cursor-help disabled:cursor-default"
      >
        <span
          className={`text-xs transition-transform ${expanded ? "rotate-90" : ""} ${canExpand ? "text-slate-500" : "text-slate-700"}`}
        >
          ▶
        </span>
        <span className="flex-1 text-[13px] font-medium text-slate-300">{label}</span>
        <span
          className={`text-[13px] font-semibold ${canExpand ? "text-red-500" : "text-slate-600"}`}
        >
          {count === 0 ? "none dropped" : `−${count.toLocaleString()}`}
        </span>
      </button>

      {expanded && canExpand && (
        <div className="border-t border-[#1e1e30] bg-[#0a0a14] px-5 py-3">
          <p className="m-0 mb-3 text-xs text-slate-600">{description}</p>
          {note && <p className="m-0 mb-3 text-xs text-slate-500">{note}</p>}
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="text-left text-slate-600">
                <th className="pb-2 pr-3 font-medium">Title</th>
                <th className="pb-2 pr-3 font-medium">Company</th>
                <th className="pb-2 font-medium">{detailLabel}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-t border-[#1e1e30] text-slate-400">
                  <td className="py-2 pr-3">{entry.title}</td>
                  <td className="py-2 pr-3 text-slate-500">{entry.company}</td>
                  <td className="py-2 text-slate-500">{entry.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {count > entries.length && (
            <p className="m-0 mt-3 text-[11px] text-slate-600">
              Showing the {entries.length} most recent of {count.toLocaleString()}. Can&apos;t find
              a specific job here? Use the search below — it checks the full raw pool with no cap.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
