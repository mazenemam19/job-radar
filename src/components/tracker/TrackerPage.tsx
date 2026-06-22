"use client";
// src/components/tracker/TrackerPage.tsx

import { useState, useEffect } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import type { TrackerEntry, TrackerStatus } from "@/lib/types";

const STATUS_META: Record<TrackerStatus, { label: string; color: string }> = {
  saved: { label: "Saved", color: "#64748b" },
  applied: { label: "Applied", color: "#6366f1" },
  interviewing: { label: "Interviewing", color: "#f59e0b" },
  offer: { label: "Offer", color: "#22c55e" },
  rejected: { label: "Rejected", color: "#ef4444" },
  ghosted: { label: "Ghosted", color: "#475569" },
};

export default function TrackerPage() {
  const [entries, setEntries] = useState<TrackerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/tracker");
      const data = await res.json();
      if (data.ok) setEntries(data.data);
      else setError(data.error);
    } catch {
      setError("Failed to load tracker");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function updateStatus(id: string, status: TrackerStatus) {
    await fetch(`/api/tracker/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setEntries((prev) =>
      prev.map((e) =>
        e.id === id ? { ...e, status, last_status_change: new Date().toISOString() } : e,
      ),
    );
  }

  async function deleteEntry(id: string) {
    if (!confirm("Remove from tracker?")) return;
    await fetch(`/api/tracker/${id}`, { method: "DELETE" });
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  // Build pie chart data
  const statusCounts = entries.reduce(
    (acc, e) => ({ ...acc, [e.status]: (acc[e.status] ?? 0) + 1 }),
    {} as Record<string, number>,
  );
  const pieData = Object.entries(statusCounts).map(([k, v]) => ({
    name: STATUS_META[k as TrackerStatus]?.label ?? k,
    value: v,
    color: STATUS_META[k as TrackerStatus]?.color ?? "#64748b",
  }));

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  return (
    <div style={{ padding: 32 }}>
      <h1 style={{ margin: "0 0 8px", fontSize: 22, color: "#e2e8f0", fontWeight: 700 }}>
        Application Tracker
      </h1>
      <p style={{ margin: "0 0 28px", color: "#64748b", fontSize: 14 }}>
        {entries.length} job{entries.length !== 1 ? "s" : ""} tracked
      </p>

      {entries.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* Pie chart */}
          {entries.length >= 2 && (
            <div
              style={{
                background: "#0d0d1a",
                border: "1px solid #1e1e30",
                borderRadius: 12,
                padding: 20,
                marginBottom: 28,
              }}
            >
              <h2 style={{ margin: "0 0 16px", fontSize: 14, color: "#94a3b8", fontWeight: 600 }}>
                Status breakdown
              </h2>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "#0d0d1a",
                      border: "1px solid #1e1e30",
                      borderRadius: 8,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Entries list */}
          <div style={{ display: "grid", gap: 10 }}>
            {entries.map((entry) => (
              <TrackerCard
                key={entry.id}
                entry={entry}
                onStatusChange={(s) => updateStatus(entry.id, s)}
                onDelete={() => deleteEntry(entry.id)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function TrackerCard({
  entry,
  onStatusChange,
  onDelete,
}: {
  entry: TrackerEntry;
  onStatusChange: (s: TrackerStatus) => void;
  onDelete: () => void;
}) {
  const meta = STATUS_META[entry.status];
  const snap = entry.job_snapshot;

  return (
    <div
      style={{
        background: "#0d0d1a",
        border: "1px solid #1e1e30",
        borderRadius: 10,
        padding: "14px 18px",
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: 12,
        alignItems: "start",
      }}
    >
      <div>
        <a
          href={snap.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#e2e8f0", fontWeight: 600, fontSize: 14, textDecoration: "none" }}
        >
          {snap.title}
        </a>
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>
          {snap.company} · {snap.country_flag} {snap.location} · Score: {snap.total_score}%
        </div>
        {entry.notes && (
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 6, fontStyle: "italic" }}>
            {entry.notes}
          </div>
        )}
        {entry.applied_at && (
          <div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>
            Applied {new Date(entry.applied_at).toLocaleDateString()}
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
        {/* Status dropdown */}
        <select
          value={entry.status}
          onChange={(e) => onStatusChange(e.target.value as TrackerStatus)}
          style={{
            padding: "4px 10px",
            borderRadius: 20,
            fontSize: 12,
            border: `1px solid ${meta.color}`,
            background: `${meta.color}15`,
            color: meta.color,
            cursor: "pointer",
          }}
        >
          {Object.entries(STATUS_META).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>

        <button
          onClick={onDelete}
          style={{
            background: "none",
            border: "none",
            color: "#475569",
            fontSize: 12,
            cursor: "pointer",
            padding: 0,
          }}
        >
          Remove
        </button>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div style={{ padding: 32, color: "#64748b", textAlign: "center" }}>Loading tracker...</div>
  );
}

function ErrorState({ message }: { message: string }) {
  return <div style={{ padding: 32, color: "#f87171", textAlign: "center" }}>Error: {message}</div>;
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
      <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
      <p style={{ color: "#64748b", fontSize: 15, margin: 0 }}>No tracked jobs yet</p>
      <p style={{ color: "#475569", fontSize: 13, marginTop: 8 }}>
        Hit &quot;Track&quot; on any job card to start tracking applications
      </p>
    </div>
  );
}
