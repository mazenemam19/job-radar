"use client";
// src/components/salary/SalaryPage.tsx

import { useState, useEffect, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { SalaryAggregate, SalaryCurrency, Pipeline } from "@/lib/types";

const CURRENCIES: SalaryCurrency[] = ["EGP", "USD", "EUR", "GBP"];
const PIPELINES: Pipeline[] = ["local", "global", "visa"];

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
    <div style={{ padding: 32 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 28,
        }}
      >
        <div>
          <h1 style={{ margin: "0 0 8px", fontSize: 22, color: "#e2e8f0", fontWeight: 700 }}>
            Salary Reports
          </h1>
          <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>
            Anonymised community salary data. Only shown when 2+ reports exist for a band.
          </p>
        </div>
        <button
          onClick={() => setShowForm((p) => !p)}
          style={{
            padding: "10px 18px",
            background: "#6366f1",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {showForm ? "Cancel" : "+ Submit yours"}
        </button>
      </div>

      {successMsg && (
        <div
          style={{
            padding: "12px 16px",
            background: "#0d2a18",
            border: "1px solid #166534",
            borderRadius: 8,
            color: "#4ade80",
            fontSize: 13,
            marginBottom: 20,
          }}
        >
          {successMsg}
        </div>
      )}

      {/* Submission form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          style={{
            background: "#0d0d1a",
            border: "1px solid #1e1e30",
            borderRadius: 12,
            padding: 24,
            marginBottom: 28,
          }}
        >
          <h3 style={{ margin: "0 0 20px", fontSize: 15, color: "#e2e8f0" }}>
            Submit a salary report
          </h3>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
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

          {error && <div style={{ color: "#f87171", fontSize: 13, marginTop: 10 }}>{error}</div>}

          <button
            type="submit"
            disabled={submitting}
            style={{
              marginTop: 20,
              padding: "10px 24px",
              background: "#6366f1",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting ? "Submitting..." : "Submit anonymously"}
          </button>
        </form>
      )}

      {/* Filter */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {["", ...PIPELINES].map((p) => (
          <button
            key={p}
            onClick={() => setFilterPipeline(p)}
            style={{
              padding: "6px 16px",
              borderRadius: 20,
              fontSize: 13,
              border: `1px solid ${filterPipeline === p ? "#6366f1" : "#1e1e30"}`,
              background: filterPipeline === p ? "#6366f1" : "transparent",
              color: filterPipeline === p ? "#fff" : "#94a3b8",
              cursor: "pointer",
            }}
          >
            {p === "" ? "All" : p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      {/* Charts */}
      {loading ? (
        <div style={{ color: "#64748b", padding: 32, textAlign: "center" }}>
          Loading salary data...
        </div>
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
    <div
      style={{ background: "#0d0d1a", border: "1px solid #1e1e30", borderRadius: 12, padding: 24 }}
    >
      <h2 style={{ margin: "0 0 20px", fontSize: 15, color: "#94a3b8" }}>
        Salary ranges by role & experience
      </h2>
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

      <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 10 }}>
        {data.slice(0, 20).map((d, i) => (
          <div key={i} style={{ fontSize: 11, color: "#64748b" }}>
            <strong style={{ color: "#94a3b8" }}>{d.role_title}</strong> ({d.years_experience}yr+):{" "}
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
      <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 5 }}>
        {label}
      </label>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        style={{
          width: "100%",
          padding: "9px 12px",
          background: "#0a0a18",
          border: "1px solid #1e1e30",
          borderRadius: 8,
          color: "#e2e8f0",
          fontSize: 13,
          boxSizing: "border-box",
        }}
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
      <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 5 }}>
        {label}
      </label>
      <select
        name={name}
        style={{
          width: "100%",
          padding: "9px 12px",
          background: "#0a0a18",
          border: "1px solid #1e1e30",
          borderRadius: 8,
          color: "#e2e8f0",
          fontSize: 13,
          boxSizing: "border-box",
        }}
      >
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
    <div
      style={{
        padding: 48,
        textAlign: "center",
        background: "#0d0d1a",
        border: "1px dashed #1e1e30",
        borderRadius: 12,
      }}
    >
      <div style={{ fontSize: 32, marginBottom: 12 }}>💼</div>
      <p style={{ color: "#64748b", fontSize: 15, margin: 0 }}>No salary data yet</p>
      <p style={{ color: "#475569", fontSize: 13, marginTop: 8 }}>
        Be the first to contribute — it helps everyone get compensated fairly
      </p>
    </div>
  );
}
