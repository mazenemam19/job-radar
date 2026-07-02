"use client";
// src/components/dashboard/FilterTabs.tsx

import type { FilterMode } from "@/lib/types";

const TABS: { mode: FilterMode; color: string }[] = [
  { mode: "all", color: "" },
  { mode: "local", color: "#22c55e" },
  { mode: "global", color: "#f59e0b" },
];

const LABELS: Record<FilterMode, (count: number) => string> = {
  all: (count) => `All (${count})`,
  local: (count) => `🇪🇬 Local (${count})`,
  global: (count) => `🌐 Remote (${count})`,
};

interface FilterTabsProps {
  filter: FilterMode;
  counts: Record<string, number>;
  totalJobs: number;
  onChange: (mode: FilterMode) => void;
}

export default function FilterTabs({ filter, counts, totalJobs, onChange }: FilterTabsProps) {
  return (
    <div className="mb-5 flex gap-2" role="tablist" aria-label="Filter jobs by pipeline">
      {TABS.map(({ mode, color }) => {
        const active = filter === mode;
        const count = mode === "all" ? totalJobs : (counts[mode] ?? 0);
        return (
          <button
            key={mode}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(mode)}
            className="rounded-full px-4 py-1.5 text-[13px] cursor-pointer"
            style={{
              border: `1px solid ${active && color ? color : "#1e1e30"}`,
              background: active && color ? `${color}20` : "transparent",
              color: active ? color || "#e2e8f0" : "#64748b",
              fontWeight: active ? 600 : 400,
            }}
          >
            {LABELS[mode](count)}
          </button>
        );
      })}
    </div>
  );
}
