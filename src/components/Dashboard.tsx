// src/components/Dashboard.tsx
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import type { JobStore, JobMode } from "@/lib/types";
import JobCard from "./JobCard";
import SourceHealthDashboard from "./SourceHealthDashboard";

function relativeTime(iso: string): string {
  const s = Math.floor((Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="stat">
      <span className="stat-val">{value}</span>
      <span className="stat-lbl">{label}</span>
    </div>
  );
}

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

export default function Dashboard({ cronSecret }: { cronSecret?: string }) {
  const [store, setStore] = useState<JobStore | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runStatus, setRunStatus] = useState<"idle" | "ok" | "err">("idle");

  const [mode, setMode] = useState<"all" | JobMode>("all");

  // Filters
  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [minScore, setMinScore] = useState(1);
  const [sortBy, setSortBy] = useState<"score" | "recency" | "company">("score");

  const loadJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/jobs");
      setStore((await res.json()) as JobStore);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const runScan = async () => {
    if (running) return;
    setRunning(true);
    setRunStatus("idle");
    try {
      const headers: Record<string, string> = {};
      if (cronSecret) headers["x-cron-secret"] = cronSecret;

      const res = await fetch("/api/cron", { method: "POST", headers });
      setRunStatus(res.ok ? "ok" : "err");
      if (res.ok) await loadJobs();
    } catch {
      setRunStatus("err");
    } finally {
      setRunning(false);
      setTimeout(() => setRunStatus("idle"), 4000);
    }
  };

  const allJobs = store?.jobs ?? [];

  // Jobs filtered by current mode
  const modeJobs = useMemo(
    () => (mode === "all" ? allJobs : allJobs.filter((j) => j.mode === mode)),
    [allJobs, mode],
  );

  const companies = useMemo(() => [...new Set(modeJobs.map((j) => j.company))].sort(), [modeJobs]);
  const countries = useMemo(() => [...new Set(modeJobs.map((j) => j.country))].sort(), [modeJobs]);
  const bestScore = useMemo(
    () => (modeJobs.length ? Math.max(...modeJobs.map((j) => j.totalScore)) : 0),
    [modeJobs],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return modeJobs
      .filter((j) => companyFilter === "all" || j.company === companyFilter)
      .filter((j) => countryFilter === "all" || j.country === countryFilter)
      .filter((j) => j.totalScore >= minScore)
      .filter(
        (j) =>
          !q ||
          j.title.toLowerCase().includes(q) ||
          j.company.toLowerCase().includes(q) ||
          j.matchedSkills.some((s) => s.toLowerCase().includes(q)),
      )
      .sort((a, b) =>
        sortBy === "score"
          ? b.totalScore - a.totalScore
          : sortBy === "recency"
            ? Date.parse(b.postedAt) - Date.parse(a.postedAt)
            : a.company.localeCompare(b.company),
      );
  }, [modeJobs, companyFilter, countryFilter, minScore, sortBy, search]);

  const visaCount = useMemo(() => allJobs.filter((j) => j.mode === "visa").length, [allJobs]);
  const localCount = useMemo(() => allJobs.filter((j) => j.mode === "local").length, [allJobs]);
  const globalCount = useMemo(() => allJobs.filter((j) => j.mode === "global").length, [allJobs]);

  // Reset filters on mode switch
  const switchMode = (m: "all" | JobMode) => {
    setMode(m);
    setSearch("");
    setCompanyFilter("all");
    setCountryFilter("all");
    setMinScore(0);
  };

  return (
    <div className="app-shell">
      {/* ── HEADER ─────────────────────────────────────────────── */}
      <header className="app-header">
        <div className="header-inner">
          <div className="brand">
            <div className="radar-dot">
              <span className="radar-pulse" />
            </div>
            <div>
              <h1 className="brand-title">JOB RADAR</h1>
              <p className="brand-sub">
                Frontend roles · Direct from company career pages · No aggregators
              </p>
            </div>
          </div>
          <div className="header-actions">
            {store?.lastUpdated && (
              <span className="last-updated">Updated {relativeTime(store.lastUpdated)}</span>
            )}
            {runStatus === "ok" && (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--green)" }}>
                ✓ Done
              </span>
            )}
            {runStatus === "err" && (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#f87171" }}>
                ✗ Error
              </span>
            )}
            <button
              className={`btn-run ${running ? "running" : ""}`}
              onClick={runScan}
              disabled={running}
            >
              <span className="run-icon">⟳</span>
              {running ? "Scanning…" : "Run Scan"}
            </button>
          </div>
        </div>

        {/* Mode dropdown */}
        <div className="mode-tabs">
          <select
            className="mode-dropdown"
            value={mode}
            onChange={(e) => switchMode(e.target.value as "all" | JobMode)}
          >
            <option value="all">🌐 All Jobs ({allJobs.length})</option>
            <option value="visa">✈️ Visa Sponsorship ({visaCount})</option>
            <option value="local">🇪🇬 Local Egypt ({localCount})</option>
            <option value="global">🌍 Global Remote ({globalCount})</option>
          </select>
        </div>

        {/* Stats strip */}
        <div className="stats-strip">
          <Stat value={modeJobs.length} label="total jobs" />
          <div className="stat-divider" />
          <Stat value={companies.length} label="companies" />
          <div className="stat-divider" />
          <Stat value={Math.round(bestScore)} label="best score" />
          <div className="stat-divider" />
          <Stat value={filtered.length} label="showing" />
        </div>
      </header>

      {/* ── FILTERS ────────────────────────────────────────────── */}
      <div className="filters-bar">
        <input
          type="text"
          className="filter-input"
          placeholder="Search title, company, skill…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="filter-select"
          value={companyFilter}
          onChange={(e) => setCompanyFilter(e.target.value)}
        >
          <option value="all">All Companies</option>
          {companies.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {(mode === "visa" || mode === "all") && (
          <select
            className="filter-select"
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
          >
            <option value="all">All Countries</option>
            {countries.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
        <div className="filter-score-wrap">
          <label className="filter-score-label">Score ≥ {minScore}</label>
          <input
            type="range"
            className="filter-range"
            min={0}
            max={100}
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
          />
        </div>
        <select
          className="filter-select"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
        >
          <option value="score">Best Match</option>
          <option value="recency">Newest First</option>
          <option value="company">By Company</option>
        </select>
      </div>

      {/* Mode description */}
      <div className="mode-desc">
        {mode === "all"
          ? "🔍 All jobs across all pipelines — visa sponsorship, local Egypt, and global remote. Use the dropdown to filter by pipeline."
          : mode === "visa"
            ? "🌍 Remote positions at European tech companies — all actively sponsor visas. Senior-only & off-discipline roles are automatically filtered out."
            : mode === "local"
              ? "🇪🇬 On-site / hybrid roles at Egyptian tech companies in Cairo & Alexandria. Same skill-match scoring — no visa assumption."
              : "🌐 Worldwide remote roles at companies known to hire globally — pre-filtered to reject US-timezone-only, EU-resident-only, and work-authorization restrictions incompatible with Egypt (GMT+2). No sponsorship needed."}
      </div>

      {/* ── GRID ───────────────────────────────────────────────── */}
      <main className="jobs-grid">
        {loading ? (
          <SkeletonGrid />
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">◌</span>
            <p>
              {modeJobs.length === 0
                ? mode === "local"
                  ? "No local jobs yet. Run a scan — we&apos;re probing Egyptian company career pages."
                  : "No jobs yet. Run a scan to fetch from company career pages."
                : "No jobs match your filters. Try lowering the score or clearing search."}
            </p>
            <p className="empty-sub">Click &quot;Run Scan&quot; to fetch latest openings.</p>
          </div>
        ) : (
          filtered.map((job, i) => <JobCard key={job.id} job={job} index={i} />)
        )}
      </main>

      {/* ── HEALTH DASHBOARD ────────────────────────────────────────── */}
      {store?.cronLogs && <SourceHealthDashboard logs={store.cronLogs} />}
    </div>
  );
}
