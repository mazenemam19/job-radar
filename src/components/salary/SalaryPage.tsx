"use client";
// src/components/salary/SalaryPage.tsx

import { useState, useEffect, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { SalaryAggregate, Pipeline } from "@/lib/types";
import { SalarySubmissionForm } from "./SalarySubmissionForm";

const PIPELINES: Pipeline[] = ["local", "global"];

export default function SalaryPage() {
  const [aggregates, setAggregates] = useState<SalaryAggregate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterPipeline, setFilterPipeline] = useState<string>("");
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [skippedUnconvertedCount, setSkippedUnconvertedCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = filterPipeline ? `/api/salary?pipeline=${filterPipeline}` : "/api/salary";
      const res = await fetch(url);
      const data = await res.json();
      if (data.ok) {
        setAggregates(data.data);
        setSkippedUnconvertedCount(data.meta?.skipped_unconverted_count ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [filterPipeline]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="p-8">
      <div className="mb-7 flex items-start justify-between">
        <div>
          <h1 className="mb-2 text-[22px] font-bold text-[#e2e8f0]">Salary Reports</h1>
          <p className="m-0 text-sm text-[#64748b]">
            Anonymised community salary data, normalized to USD. Only shown when 2+ reports exist
            for a band.
          </p>
        </div>
        <button
          onClick={() => setShowForm((p) => !p)}
          className="cursor-pointer rounded-lg border-0 bg-[#6366f1] px-[18px] py-2.5 text-sm font-semibold text-white"
        >
          {showForm ? "Cancel" : "+ Submit yours"}
        </button>
      </div>

      {successMsg && (
        <div className="mb-5 rounded-lg border border-[#166534] bg-[#0d2a18] px-4 py-3 text-[13px] text-[#4ade80]">
          {successMsg}
        </div>
      )}

      {/* Submission form */}
      {showForm && (
        <SalarySubmissionForm
          onSubmitted={() => {
            setSuccessMsg("Report submitted — thank you!");
            setShowForm(false);
            load();
          }}
        />
      )}

      {/* Filter */}
      <div className="mb-5 flex gap-2">
        {["", ...PIPELINES].map((p) => (
          <button
            key={p}
            onClick={() => setFilterPipeline(p)}
            className="cursor-pointer rounded-full border px-4 py-1.5 text-[13px]"
            style={{
              borderColor: filterPipeline === p ? "#6366f1" : "#1e1e30",
              background: filterPipeline === p ? "#6366f1" : "transparent",
              color: filterPipeline === p ? "#fff" : "#94a3b8",
            }}
          >
            {p === "" ? "All" : p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      {/* Charts */}
      {loading ? (
        <div className="p-8 text-center text-[#64748b]">Loading salary data...</div>
      ) : aggregates.length === 0 ? (
        <EmptyState />
      ) : (
        <SalaryChart data={aggregates} />
      )}

      {skippedUnconvertedCount > 0 && (
        <p className="mt-4 text-xs text-[#64748b]">
          {skippedUnconvertedCount} legacy report{skippedUnconvertedCount === 1 ? "" : "s"} without
          a verifiable USD conversion {skippedUnconvertedCount === 1 ? "is" : "are"} excluded from
          the combined chart.
        </p>
      )}
    </div>
  );
}

function SalaryChart({ data }: { data: SalaryAggregate[] }) {
  const chartData = data.slice(0, 20).map((d) => ({
    name: `${d.role_title.slice(0, 20)} (${d.years_experience}yr+)`,
    min: d.min,
    median: d.median,
    max: d.max,
    count: d.count,
  }));

  return (
    <div className="rounded-xl border border-[#1e1e30] bg-[#0d0d1a] p-6">
      <h2 className="mb-5 text-[15px] text-[#94a3b8]">Monthly USD ranges by role & experience</h2>
      <ResponsiveContainer width="100%" height={340}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 20, bottom: 80 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e1e30" />
          <XAxis
            dataKey="name"
            tick={{ fill: "#64748b", fontSize: 11 }}
            angle={-35}
            textAnchor="end"
            interval={0}
          />
          <YAxis
            tick={{ fill: "#64748b", fontSize: 11 }}
            tickFormatter={(value) => `$${value.toLocaleString()}`}
          />
          <Tooltip
            contentStyle={{
              background: "#0d0d1a",
              border: "1px solid #1e1e30",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value, name) => [`$${(value as number).toLocaleString()}`, name]}
          />
          <Bar dataKey="min" name="Min" fill="#475569" radius={[2, 2, 0, 0]} />
          <Bar dataKey="median" name="Median" fill="#6366f1" radius={[2, 2, 0, 0]} />
          <Bar dataKey="max" name="Max" fill="#818cf8" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-4 flex flex-wrap gap-2.5">
        {data.slice(0, 20).map((d, i) => (
          <div key={i} className="text-[11px] text-[#64748b]">
            <strong className="text-[#94a3b8]">{d.role_title}</strong> ({d.years_experience}yr+):{" "}
            USD ${d.min.toLocaleString()}–${d.max.toLocaleString()}/mo · {d.count} report
            {d.count !== 1 ? "s" : ""}
            {" · "}
            {formatReportRange(d.earliest_reported_at, d.latest_reported_at)}
          </div>
        ))}
      </div>
    </div>
  );
}

function formatReportRange(earliest: string, latest: string): string {
  const format = (value: string) =>
    new Intl.DateTimeFormat("en", { month: "short", year: "numeric", timeZone: "UTC" }).format(
      new Date(value),
    );
  const first = format(earliest);
  const last = format(latest);
  return first === last ? `Reported ${last}` : `Reports ${first}–${last}`;
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-[#1e1e30] bg-[#0d0d1a] p-12 text-center">
      <div className="mb-3 text-[32px]">💼</div>
      <p className="m-0 text-[15px] text-[#64748b]">No salary data yet</p>
      <p className="mt-2 text-[13px] text-[#475569]">
        Be the first to contribute — it helps everyone get compensated fairly
      </p>
    </div>
  );
}
