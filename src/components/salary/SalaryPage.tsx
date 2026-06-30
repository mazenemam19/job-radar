"use client";
// src/components/salary/SalaryPage.tsx

import { useState, useEffect, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { SalaryAggregate, SalaryCurrency, Pipeline } from "@/lib/types";

const CURRENCIES: SalaryCurrency[] = ["EGP", "USD", "EUR", "GBP"];
const PIPELINES: Pipeline[] = ["local", "global"];

const FIELD_LABEL_CLASS = "mb-1.5 block text-xs text-[#64748b]";
const FIELD_INPUT_CLASS =
  "w-full rounded-lg border border-[#1e1e30] bg-[#0a0a18] px-3 py-2.5 text-[13px] text-[#e2e8f0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366f1]";

export default function SalaryPage() {
  const [aggregates, setAggregates] = useState<SalaryAggregate[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [filterPipeline, setFilterPipeline] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = filterPipeline ? `/api/salary?pipeline=${filterPipeline}` : "/api/salary";
      const res = await fetch(url);
      const data = await res.json();
      if (data.ok) setAggregates(data.data);
    } finally {
      setLoading(false);
    }
  }, [filterPipeline]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const body = {
      role_title: fd.get("role_title"),
      years_experience: parseInt(fd.get("years_experience") as string, 10),
      salary_egp: fd.get("currency") === "EGP" ? parseInt(fd.get("amount") as string, 10) : null,
      salary_usd: fd.get("currency") === "USD" ? parseInt(fd.get("amount") as string, 10) : null,
      currency: fd.get("currency"),
      employment_type: fd.get("employment_type"),
      work_arrangement: fd.get("work_arrangement"),
      pipeline: fd.get("pipeline"),
    };

    try {
      const res = await fetch("/api/salary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.ok) {
        setSuccessMsg("Report submitted — thank you!");
        setShowForm(false);
        load();
      } else {
        setError(data.error);
      }
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-8">
      <div className="mb-7 flex items-start justify-between">
        <div>
          <h1 className="mb-2 text-[22px] font-bold text-[#e2e8f0]">Salary Reports</h1>
          <p className="m-0 text-sm text-[#64748b]">
            Anonymised community salary data. Only shown when 2+ reports exist for a band.
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
        <form
          onSubmit={handleSubmit}
          className="mb-7 rounded-xl border border-[#1e1e30] bg-[#0d0d1a] p-6"
        >
          <h3 className="mb-5 text-[15px] text-[#e2e8f0]">Submit a salary report</h3>

          <div className="grid grid-cols-2 gap-3.5">
            <Field
              label="Role title"
              name="role_title"
              type="text"
              placeholder="Senior Frontend Engineer"
              required
            />
            <Field
              label="Years of experience"
              name="years_experience"
              type="number"
              placeholder="5"
              required
            />
            <Field
              label="Monthly salary (gross)"
              name="amount"
              type="number"
              placeholder="15000"
              required
            />
            <SelectField
              label="Currency"
              name="currency"
              options={CURRENCIES.map((c) => ({ v: c, l: c }))}
            />
            <SelectField
              label="Employment type"
              name="employment_type"
              options={[
                { v: "full-time", l: "Full-time" },
                { v: "part-time", l: "Part-time" },
                { v: "contract", l: "Contract" },
                { v: "freelance", l: "Freelance" },
              ]}
            />
            <SelectField
              label="Work arrangement"
              name="work_arrangement"
              options={[
                { v: "onsite", l: "On-site" },
                { v: "remote", l: "Remote" },
                { v: "hybrid", l: "Hybrid" },
              ]}
            />
            <SelectField
              label="Pipeline"
              name="pipeline"
              options={PIPELINES.map((p) => ({ v: p, l: p.charAt(0).toUpperCase() + p.slice(1) }))}
            />
          </div>

          {error && <div className="mt-2.5 text-[13px] text-[#f87171]">{error}</div>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-5 cursor-pointer rounded-lg border-0 bg-[#6366f1] px-6 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed"
            style={{ opacity: submitting ? 0.6 : 1 }}
          >
            {submitting ? "Submitting..." : "Submit anonymously"}
          </button>
        </form>
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
    currency: d.currency,
  }));

  return (
    <div className="rounded-xl border border-[#1e1e30] bg-[#0d0d1a] p-6">
      <h2 className="mb-5 text-[15px] text-[#94a3b8]">Salary ranges by role & experience</h2>
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
          <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
          <Tooltip
            contentStyle={{
              background: "#0d0d1a",
              border: "1px solid #1e1e30",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value, name) => [`${(value as number).toLocaleString()}`, name]}
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
            {d.currency} {d.min.toLocaleString()}–{d.max.toLocaleString()}/mo · {d.count} report
            {d.count !== 1 ? "s" : ""}
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  type,
  placeholder,
  required,
}: {
  label: string;
  name: string;
  type: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={`salary-${name}`} className={FIELD_LABEL_CLASS}>
        {label}
      </label>
      <input
        id={`salary-${name}`}
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        className={FIELD_INPUT_CLASS}
      />
    </div>
  );
}

function SelectField({
  label,
  name,
  options,
}: {
  label: string;
  name: string;
  options: { v: string; l: string }[];
}) {
  return (
    <div>
      <label htmlFor={`salary-${name}`} className={FIELD_LABEL_CLASS}>
        {label}
      </label>
      <select id={`salary-${name}`} name={name} className={FIELD_INPUT_CLASS}>
        {options.map((o) => (
          <option key={o.v} value={o.v}>
            {o.l}
          </option>
        ))}
      </select>
    </div>
  );
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
