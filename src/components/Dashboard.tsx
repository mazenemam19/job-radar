// src/components/Dashboard.tsx
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import type { Job, JobStore } from "@/lib/types";
import JobCard from "./JobCard";

// ── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const s = Math.floor((Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Stat component ────────────────────────────────────────────────────────────
function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="stat">
      <span className="stat-val">{value}</span>
      <span className="stat-lbl">{label}</span>
    </div>
  );
}

// ── Skeleton ─────────────────────────────────────────────────────────────────
function SkeletonGrid() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="skeleton"
          style={{ animationDelay: `${i * 0.12}s`, height: `${260 + (i % 3) * 20}px` }}
        />
      ))}
    </>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [store, setStore]       = useState<JobStore | null>(null);
  const [loading, setLoading]   = useState(true);
  const [running, setRunning]   = useState(false);
  const [runStatus, setRunStatus] = useState<"idle" | "ok" | "err">("idle");

  // Filters
  const [search,        setSearch]        = useState("");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [minScore,      setMinScore]      = useState(0);
  const [sortBy,        setSortBy]        = useState<"score" | "recency" | "company">("score");

  // ── Fetch jobs from API ────────────────────────────────────────────────
  const loadJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/jobs");
      const data = await res.json() as JobStore;
      setStore(data);
    } catch (e) {
      console.error("Failed to load jobs", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  // ── Trigger a fresh scan ───────────────────────────────────────────────
  const runScan = async () => {
    if (running) return;
    setRunning(true);
    setRunStatus("idle");
    try {
      const res = await fetch("/api/cron", { method: "POST" });
      setRunStatus(res.ok ? "ok" : "err");
      if (res.ok) await loadJobs();
    } catch {
      setRunStatus("err");
    } finally {
      setRunning(false);
      // Reset status badge after 4s
      setTimeout(() => setRunStatus("idle"), 4000);
    }
  };

  const jobs = store?.jobs ?? [];

  // ── Derived filter options ─────────────────────────────────────────────
  const companies = useMemo(() => [...new Set(jobs.map(j => j.company))].sort(), [jobs]);
  const countries = useMemo(() => [...new Set(jobs.map(j => j.country))].sort(), [jobs]);
  const bestScore = useMemo(() => jobs.length ? Math.max(...jobs.map(j => j.totalScore)) : 0, [jobs]);

  // ── Filtered + sorted list ─────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return jobs
      .filter(j => companyFilter === "all" || j.company === companyFilter)
      .filter(j => countryFilter === "all" || j.country === countryFilter)
      .filter(j => j.totalScore >= minScore)
      .filter(j =>
        !q ||
        j.title.toLowerCase().includes(q) ||
        j.company.toLowerCase().includes(q) ||
        j.matchedSkills.some(s => s.toLowerCase().includes(q))
      )
      .sort((a, b) =>
        sortBy === "score"   ? b.totalScore  - a.totalScore :
        sortBy === "recency" ? Date.parse(b.postedAt) - Date.parse(a.postedAt) :
        a.company.localeCompare(b.company)
      );
  }, [jobs, companyFilter, countryFilter, minScore, sortBy, search]);

  // Unique company flags for the stats strip
  const flagMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const j of jobs) m[j.company] = j.countryFlag;
    return m;
  }, [jobs]);

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="app-shell">

      {/* ────────────────── HEADER ────────────────── */}
      <header className="app-header">
        <div className="header-inner">
          {/* Brand */}
          <div className="brand">
            <div className="radar-dot">
              <span className="radar-pulse" />
            </div>
            <div>
              <h1 className="brand-title">JOB RADAR</h1>
              <p className="brand-sub">
                Frontend roles · Direct from visa-sponsoring companies · No aggregators
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="header-actions">
            {store?.lastUpdated && (
              <span className="last-updated">
                Updated {relativeTime(store.lastUpdated)}
              </span>
            )}
            {runStatus === "ok"  && <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--green)" }}>✓ Done</span>}
            {runStatus === "err" && <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#f87171" }}>✗ Error</span>}
            <button
              className={`btn-run ${running ? "running" : ""}`}
              onClick={runScan}
              disabled={running}
              title="Trigger a fresh scan of all company career pages"
            >
              <span className="run-icon">⟳</span>
              {running ? "Scanning…" : "Run Scan"}
            </button>
          </div>
        </div>

        {/* Stats strip */}
        <div className="stats-strip">
          <Stat value={jobs.length}           label="jobs found" />
          <div className="stat-divider" />
          <Stat value={companies.length}      label="companies" />
          <div className="stat-divider" />
          <Stat value={Math.round(bestScore)} label="best score" />
          <div className="stat-divider" />
          <Stat value={filtered.length}       label="showing" />
          <div className="stat-divider" />
          <div className="flags-row" title="Monitored countries">
            {Object.entries(flagMap).map(([co, flag]) => (
              <span key={co} className="flag" title={co}>{flag}</span>
            ))}
          </div>
        </div>
      </header>

      {/* ────────────────── FILTERS ────────────────── */}
      <div className="filters-bar">
        <input
          type="text"
          className="filter-input"
          placeholder="Search title, company, skill…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        <select
          className="filter-select"
          value={companyFilter}
          onChange={e => setCompanyFilter(e.target.value)}
        >
          <option value="all">All Companies</option>
          {companies.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <select
          className="filter-select"
          value={countryFilter}
          onChange={e => setCountryFilter(e.target.value)}
        >
          <option value="all">All Countries</option>
          {countries.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <div className="filter-score-wrap">
          <label className="filter-score-label">Score ≥ {minScore}</label>
          <input
            type="range"
            className="filter-range"
            min={0} max={100}
            value={minScore}
            onChange={e => setMinScore(Number(e.target.value))}
          />
        </div>

        <select
          className="filter-select"
          value={sortBy}
          onChange={e => setSortBy(e.target.value as typeof sortBy)}
        >
          <option value="score">Best Match</option>
          <option value="recency">Newest First</option>
          <option value="company">By Company</option>
        </select>
      </div>

      {/* ────────────────── JOB GRID ────────────────── */}
      <main className="jobs-grid">
        {loading ? (
          <SkeletonGrid />
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">◌</span>
            <p>No jobs match your current filters.</p>
            <p className="empty-sub">
              Try lowering the minimum score, clearing search, or running a fresh scan.
            </p>
          </div>
        ) : (
          filtered.map((job, i) => (
            <JobCard key={job.id} job={job} index={i} />
          ))
        )}
      </main>
    </div>
  );
}
