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
    <div className="p-8">
      <h1 className="m-0 mb-2 text-[22px] font-bold text-slate-200">Application Tracker</h1>
      <p className="m-0 mb-7 text-sm text-slate-500">
        {entries.length} job{entries.length !== 1 ? "s" : ""} tracked
      </p>

      {entries.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* Pie chart */}
          {entries.length >= 2 && (
            <div className="mb-7 rounded-xl border border-[#1e1e30] bg-[#0d0d1a] p-5">
              <h2 className="m-0 mb-4 text-sm font-semibold text-slate-400">Status breakdown</h2>
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
          <div className="grid gap-2.5">
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
    <div className="grid grid-cols-[1fr_auto] items-start gap-3 rounded-[10px] border border-[#1e1e30] bg-[#0d0d1a] px-4.5 py-3.5">
      <div>
        <a
          href={snap.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-semibold text-slate-200 no-underline"
        >
          {snap.title}
        </a>
        <div className="mt-0.5 text-xs text-slate-500">
          {snap.company} · {snap.country_flag} {snap.location} · Score: {snap.total_score}%
        </div>
        {entry.notes && <div className="mt-1.5 text-xs italic text-slate-400">{entry.notes}</div>}
        {entry.applied_at && (
          <div className="mt-1 text-[11px] text-slate-600">
            Applied {new Date(entry.applied_at).toLocaleDateString()}
          </div>
        )}
      </div>

      <div className="flex flex-col items-end gap-2">
        {/* Status dropdown */}
        <select
          value={entry.status}
          onChange={(e) => onStatusChange(e.target.value as TrackerStatus)}
          aria-label={`Update status for ${snap.title}`}
          className="rounded-full px-2.5 py-1 text-xs cursor-pointer"
          style={{
            border: `1px solid ${meta.color}`,
            background: `${meta.color}15`,
            color: meta.color,
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
          aria-label={`Remove ${snap.title} from tracker`}
          className="border-none bg-transparent p-0 text-xs text-slate-600 cursor-pointer"
        >
          Remove
        </button>
      </div>
    </div>
  );
}

function LoadingState() {
  return <div className="p-8 text-center text-slate-500">Loading tracker...</div>;
}

function ErrorState({ message }: { message: string }) {
  return <div className="p-8 text-center text-red-400">Error: {message}</div>;
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-[#1e1e30] bg-[#0d0d1a] p-12 text-center">
      <div className="mb-3 text-3xl">📋</div>
      <p className="m-0 text-[15px] text-slate-500">No tracked jobs yet</p>
      <p className="mt-2 text-[13px] text-slate-600">
        Hit &quot;Track&quot; on any job card to start tracking applications
      </p>
    </div>
  );
}
