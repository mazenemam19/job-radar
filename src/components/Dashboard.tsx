"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Job, JobStore } from "@/lib/types";
import JobCard from "./JobCard";

const PAGE_SIZE = 30;

export default function Dashboard() {
  const [store, setStore] = useState<JobStore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState("All");
  const [minScore, setMinScore] = useState(0);
  const [page, setPage] = useState(1);
  const [fetching, setFetching] = useState(false);

  const loadJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/jobs", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: JobStore = await res.json();
      setStore(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const jobs = store?.jobs ?? [];

  // Countries for dropdown
  const countries = useMemo(() => {
    const set = new Set(jobs.map((j) => j.country));
    return ["All", ...Array.from(set).sort()];
  }, [jobs]);

  // Filter & search
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return jobs.filter((j) => {
      if (country !== "All" && j.country !== country) return false;
      if (j.totalScore < minScore) return false;
      if (q && !`${j.title} ${j.company} ${j.location} ${j.matchedSkills.join(" ")}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [jobs, country, minScore, search]);

  // Stats
  const stats = useMemo(() => {
    const total = filtered.length;
    const avg = total ? Math.round(filtered.reduce((s, j) => s + j.totalScore, 0) / total) : 0;
    const top = total ? Math.max(...filtered.map((j) => j.totalScore)) : 0;
    const withReloc = filtered.filter((j) => j.relocationBonus > 0).length;
    return { total, avg, top, withReloc };
  }, [filtered]);

  // Pagination
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleFilterChange = useCallback(() => setPage(1), []);

  async function triggerFetch() {
    const secret = prompt("Enter CRON_SECRET to trigger a fetch:");
    if (!secret) return;
    setFetching(true);
    try {
      const res = await fetch("/api/cron", {
        method: "POST",
        headers: { "x-cron-secret": secret },
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Done! Added: ${data.added}, Skipped: ${data.skipped}`);
        await loadJobs();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (e) {
      alert(`Request failed: ${e}`);
    } finally {
      setFetching(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#090e1a" }}>
        <div className="text-center">
          <div className="text-4xl mb-4">🎯</div>
          <div className="text-slate-400 text-lg">Loading job radar...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#090e1a" }}>
        <div className="text-red-400 text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <div>{error}</div>
          <button onClick={loadJobs} className="mt-4 px-4 py-2 bg-blue-600 rounded text-white text-sm">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-8 max-w-6xl mx-auto" style={{ background: "#090e1a" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            🎯 Job Radar
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Frontend dev jobs · Visa sponsorship only · Sorted by match score
            {store?.lastUpdated && (
              <span> · Last updated {new Date(store.lastUpdated).toLocaleString()}</span>
            )}
          </p>
        </div>
        <button
          onClick={triggerFetch}
          disabled={fetching}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 disabled:cursor-not-allowed rounded-lg text-white text-sm font-semibold transition-colors"
        >
          {fetching ? "⏳ Fetching..." : "🔄 Fetch Now"}
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Matches", value: stats.total, icon: "📋", color: "text-blue-400" },
          { label: "Avg Score", value: stats.avg, icon: "📊", color: "text-purple-400" },
          { label: "Top Score", value: stats.top, icon: "🏆", color: "text-yellow-400" },
          { label: "With Relocation", value: stats.withReloc, icon: "✈️", color: "text-green-400" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl p-5" style={{ background: "#0d1525", border: "1px solid #1e3050" }}>
            <div className="text-2xl mb-1">{s.icon}</div>
            <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-slate-500 text-xs mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="rounded-xl p-5 mb-6 flex flex-col md:flex-row gap-4" style={{ background: "#0d1525", border: "1px solid #1e3050" }}>
        <div className="flex-1">
          <label className="text-slate-400 text-xs font-semibold mb-1 block uppercase tracking-wider">Search</label>
          <input
            type="text"
            placeholder="Title, company, skill..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); handleFilterChange(); }}
            className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none focus:ring-2 focus:ring-blue-500"
            style={{ background: "#111c30", border: "1px solid #1e3050" }}
          />
        </div>
        <div className="min-w-[180px]">
          <label className="text-slate-400 text-xs font-semibold mb-1 block uppercase tracking-wider">Country</label>
          <select
            value={country}
            onChange={(e) => { setCountry(e.target.value); handleFilterChange(); }}
            className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none focus:ring-2 focus:ring-blue-500"
            style={{ background: "#111c30", border: "1px solid #1e3050" }}
          >
            {countries.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="min-w-[200px]">
          <label className="text-slate-400 text-xs font-semibold mb-1 block uppercase tracking-wider">
            Min Score: <span className="text-blue-400 font-bold">{minScore}</span>
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={minScore}
            onChange={(e) => { setMinScore(Number(e.target.value)); handleFilterChange(); }}
            className="w-full mt-2"
          />
        </div>
        {(search || country !== "All" || minScore > 0) && (
          <button
            onClick={() => { setSearch(""); setCountry("All"); setMinScore(0); setPage(1); }}
            className="self-end px-3 py-2 text-slate-400 hover:text-white text-sm rounded-lg transition-colors"
            style={{ background: "#111c30" }}
          >
            Clear ✕
          </button>
        )}
      </div>

      {/* Results count */}
      <div className="text-slate-500 text-sm mb-4">
        Showing {paginated.length} of {filtered.length} jobs (sorted by match score)
      </div>

      {/* Job list */}
      {paginated.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">🔍</div>
          <div className="text-slate-400 text-lg">No jobs found</div>
          <div className="text-slate-600 text-sm mt-2">
            {jobs.length === 0 ? (
              <>No jobs stored yet. Click <strong>Fetch Now</strong> to run your first fetch.</>
            ) : (
              <>Try adjusting your filters.</>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {paginated.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
            style={{ background: "#0d1525" }}
          >
            ← Prev
          </button>
          <div className="flex gap-1">
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let p = i + 1;
              if (totalPages > 7) {
                if (page <= 4) p = i + 1;
                else if (page >= totalPages - 3) p = totalPages - 6 + i;
                else p = page - 3 + i;
              }
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                    p === page
                      ? "bg-blue-600 text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                  style={{ background: p === page ? undefined : "#0d1525" }}
                >
                  {p}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
            style={{ background: "#0d1525" }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
