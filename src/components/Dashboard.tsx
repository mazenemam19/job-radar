"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Job, FilterState } from "@/types";
import { formatDistanceToNow } from "date-fns";
import clsx from "clsx";

// ─── Score Circle ─────────────────────────────────────────────────────────────

function ScoreCircle({ score, size = 52 }: { score: number; size?: number }) {
  const color = score >= 70 ? "var(--green)" : score >= 45 ? "var(--amber)" : "var(--text-muted)";
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth="3" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.5s ease" }}
        />
      </svg>
      <span
        className="mono absolute inset-0 flex items-center justify-center text-xs font-bold"
        style={{ color }}
      >
        {score}
      </span>
    </div>
  );
}

// ─── Skill Pill ───────────────────────────────────────────────────────────────

function SkillPill({ name, type }: { name: string; type: "matched" | "missing" }) {
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
      style={{
        background: type === "matched" ? "rgba(16,185,129,0.12)" : "rgba(107,127,163,0.1)",
        color: type === "matched" ? "var(--green)" : "var(--text-faint)",
        border: `1px solid ${type === "matched" ? "rgba(16,185,129,0.25)" : "var(--border)"}`,
      }}
    >
      {type === "matched" ? "✓" : "○"} {name}
    </span>
  );
}

// ─── Country Flag Helper ──────────────────────────────────────────────────────

const FLAGS: Record<string, string> = {
  GB: "🇬🇧", US: "🇺🇸", CA: "🇨🇦", AU: "🇦🇺",
  DE: "🇩🇪", NL: "🇳🇱", FR: "🇫🇷", SE: "🇸🇪",
  NO: "🇳🇴", AT: "🇦🇹", CH: "🇨🇭", BE: "🇧🇪",
};

// ─── Job Card ─────────────────────────────────────────────────────────────────

function JobCard({ job, index }: { job: Job; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const flag = FLAGS[job.countryCode] ?? "🌍";

  const salaryStr =
    job.salary?.min || job.salary?.max
      ? `${job.salary.currency ?? ""} ${job.salary.min?.toLocaleString() ?? ""}${
          job.salary.max ? `–${job.salary.max.toLocaleString()}` : "+"
        }`
      : null;

  return (
    <div
      className="card-enter rounded-xl overflow-hidden"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        animationDelay: `${Math.min(index * 40, 400)}ms`,
        transition: "border-color 0.2s",
      }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-bright)")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)")}
    >
      {/* Main row */}
      <div className="flex items-start gap-4 p-4">
        <ScoreCircle score={job.totalScore} />

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-start gap-x-3 gap-y-1 mb-1">
            <h3 className="font-semibold text-sm leading-snug" style={{ color: "var(--text)" }}>
              {job.title}
            </h3>
            {job.hasVisaSponsorship && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                style={{ background: "rgba(139,92,246,0.12)", color: "var(--purple)", border: "1px solid rgba(139,92,246,0.25)" }}>
                🛂 Visa
              </span>
            )}
            {job.hasRelocation && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                style={{ background: "rgba(6,182,212,0.12)", color: "var(--accent2)", border: "1px solid rgba(6,182,212,0.25)" }}>
                📦 Relocation
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
            <span className="font-medium" style={{ color: "var(--text)" }}>{job.company}</span>
            <span>{flag} {job.location}</span>
            {salaryStr && <span>💰 {salaryStr}</span>}
            <span>🕐 {formatDistanceToNow(new Date(job.postedAt), { addSuffix: true })}</span>
            <span className="mono" style={{ color: "var(--text-faint)", fontSize: 10 }}>
              {job.source.toUpperCase()}
            </span>
          </div>

          {/* Skills preview */}
          <div className="flex flex-wrap gap-1 mt-2">
            {job.matchedSkills.slice(0, 6).map((s) => (
              <SkillPill key={s} name={s} type="matched" />
            ))}
            {job.matchedSkills.length > 6 && (
              <span className="text-xs" style={{ color: "var(--text-faint)" }}>
                +{job.matchedSkills.length - 6} more
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 items-end flex-shrink-0">
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200"
            style={{
              background: "var(--accent)",
              color: "#fff",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.opacity = "0.85")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.opacity = "1")}
          >
            Apply →
          </a>
          <button
            onClick={() => setExpanded((p) => !p)}
            className="text-xs transition-colors"
            style={{ color: "var(--text-faint)" }}
          >
            {expanded ? "▲ less" : "▼ details"}
          </button>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div
          className="px-4 pb-4 pt-0 border-t"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="grid grid-cols-3 gap-3 mt-3 mb-3">
            <div className="rounded-lg p-3 text-center" style={{ background: "var(--surface2)" }}>
              <div className="mono text-lg font-bold" style={{ color: "var(--green)" }}>{job.matchScore}</div>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>Skill Match</div>
            </div>
            <div className="rounded-lg p-3 text-center" style={{ background: "var(--surface2)" }}>
              <div className="mono text-lg font-bold" style={{ color: "var(--accent)" }}>{job.recencyScore}</div>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>Recency</div>
            </div>
            <div className="rounded-lg p-3 text-center" style={{ background: "var(--surface2)" }}>
              <div className="mono text-lg font-bold" style={{ color: "var(--text)" }}>{job.totalScore}</div>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>Total Score</div>
            </div>
          </div>

          {job.missingSkills.length > 0 && (
            <div className="mb-3">
              <p className="text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>Skills you have that aren&apos;t mentioned:</p>
              <div className="flex flex-wrap gap-1">
                {job.missingSkills.slice(0, 8).map((s) => (
                  <SkillPill key={s} name={s} type="missing" />
                ))}
              </div>
            </div>
          )}

          <div className="rounded-lg p-3" style={{ background: "var(--surface2)" }}>
            <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
              {job.description.slice(0, 500)}{job.description.length > 500 ? "…" : ""}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Filter Bar ───────────────────────────────────────────────────────────────

const COUNTRIES = [
  { code: "", label: "All Countries" },
  { code: "GB", label: "🇬🇧 UK" },
  { code: "US", label: "🇺🇸 US" },
  { code: "CA", label: "🇨🇦 Canada" },
  { code: "AU", label: "🇦🇺 Australia" },
  { code: "DE", label: "🇩🇪 Germany" },
  { code: "NL", label: "🇳🇱 Netherlands" },
  { code: "FR", label: "🇫🇷 France" },
  { code: "AT", label: "🇦🇹 Austria" },
];

function FilterBar({
  filters,
  onChange,
}: {
  filters: FilterState;
  onChange: (f: Partial<FilterState>) => void;
}) {
  const inputStyle: React.CSSProperties = {
    background: "var(--surface2)",
    border: "1px solid var(--border)",
    color: "var(--text)",
    borderRadius: 8,
    padding: "6px 12px",
    fontSize: 13,
    outline: "none",
  };

  return (
    <div className="flex flex-wrap gap-3 items-center">
      {/* Search */}
      <input
        type="text"
        placeholder="Search title, company, location…"
        value={filters.search}
        onChange={(e) => onChange({ search: e.target.value })}
        style={{ ...inputStyle, minWidth: 240 }}
      />

      {/* Country */}
      <select
        value={filters.country}
        onChange={(e) => onChange({ country: e.target.value })}
        style={inputStyle}
      >
        {COUNTRIES.map((c) => (
          <option key={c.code} value={c.code}>{c.label}</option>
        ))}
      </select>

      {/* Min score */}
      <div className="flex items-center gap-2">
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>Min score</span>
        <input
          type="range"
          min={0}
          max={90}
          step={10}
          value={filters.minScore}
          onChange={(e) => onChange({ minScore: parseInt(e.target.value) })}
          style={{ accentColor: "var(--accent)", width: 80 }}
        />
        <span className="mono text-xs" style={{ color: "var(--accent)", width: 24 }}>{filters.minScore}</span>
      </div>

      {/* Toggles */}
      <ToggleFilter
        label="🛂 Visa only"
        active={filters.visaOnly}
        onClick={() => onChange({ visaOnly: !filters.visaOnly })}
      />
      <ToggleFilter
        label="📦 Relocation"
        active={filters.relocationOnly}
        onClick={() => onChange({ relocationOnly: !filters.relocationOnly })}
      />
    </div>
  );
}

function ToggleFilter({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200"
      style={{
        background: active ? "var(--accent-glow)" : "var(--surface2)",
        border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
        color: active ? "var(--accent)" : "var(--text-muted)",
      }}
    >
      {label}
    </button>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="mono text-2xl font-bold" style={{ color: color ?? "var(--text)" }}>{value}</div>
      <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{label}</div>
      {sub && <div className="text-xs mt-0.5" style={{ color: "var(--text-faint)" }}>{sub}</div>}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

interface ApiResponse {
  jobs: Job[];
  total: number;
  page: number;
  totalPages: number;
  lastFetchedAt: string | null;
  totalFetched: number;
}

export default function Dashboard() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<FilterState>({
    country: "",
    minScore: 0,
    visaOnly: false,
    relocationOnly: false,
    search: "",
  });

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchJobs = useCallback(async (f: FilterState, p: number) => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(p),
      limit: "30",
      ...(f.country && { country: f.country }),
      ...(f.minScore > 0 && { minScore: String(f.minScore) }),
      ...(f.visaOnly && { visaOnly: "true" }),
      ...(f.relocationOnly && { relocationOnly: "true" }),
      ...(f.search && { search: f.search }),
    });

    try {
      const res = await fetch(`/api/jobs?${params}`);
      const json = await res.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setPage(1);
      fetchJobs(filters, 1);
    }, 300);
  }, [filters, fetchJobs]);

  useEffect(() => {
    fetchJobs(filters, page);
  }, [page]); // eslint-disable-line

  const handleFilterChange = (partial: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...partial }));
  };

  const triggerFetch = async () => {
    setFetching(true);
    try {
      const secret = prompt("Enter your CRON_SECRET (from .env.local):");
      if (!secret) return;
      await fetch("/api/cron", {
        method: "POST",
        headers: { "x-cron-secret": secret },
      });
      await fetchJobs(filters, 1);
    } finally {
      setFetching(false);
    }
  };

  const jobs = data?.jobs ?? [];
  const visaCount = jobs.filter((j) => j.hasVisaSponsorship).length;
  const relocationCount = jobs.filter((j) => j.hasRelocation).length;
  const avgScore = jobs.length
    ? Math.round(jobs.reduce((s, j) => s + j.totalScore, 0) / jobs.length)
    : 0;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <header
        className="sticky top-0 z-10 flex items-center justify-between px-6 py-4"
        style={{
          background: "rgba(9,14,26,0.85)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="flex items-center gap-3">
          {/* Radar icon */}
          <div className="relative w-8 h-8">
            <svg viewBox="0 0 32 32" className="w-8 h-8">
              <circle cx="16" cy="16" r="14" fill="none" stroke="var(--border-bright)" strokeWidth="1" />
              <circle cx="16" cy="16" r="9" fill="none" stroke="var(--border)" strokeWidth="1" />
              <circle cx="16" cy="16" r="4" fill="none" stroke="var(--border)" strokeWidth="1" />
              <circle cx="16" cy="16" r="1.5" fill="var(--accent)" />
              <line x1="16" y1="2" x2="16" y2="30" stroke="var(--border)" strokeWidth="0.5" />
              <line x1="2" y1="16" x2="30" y2="16" stroke="var(--border)" strokeWidth="0.5" />
              <path d="M16 16 L30 5" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" className="radar-sweep" />
            </svg>
          </div>
          <div>
            <h1 className="mono font-bold text-sm tracking-wide" style={{ color: "var(--text)" }}>JOB_RADAR</h1>
            <p className="text-xs" style={{ color: "var(--text-faint)" }}>relocation &amp; visa sponsorship tracker</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {data?.lastFetchedAt && (
            <span className="text-xs hidden sm:block" style={{ color: "var(--text-faint)" }}>
              Last synced{" "}
              <span style={{ color: "var(--text-muted)" }}>
                {formatDistanceToNow(new Date(data.lastFetchedAt), { addSuffix: true })}
              </span>
            </span>
          )}
          <button
            onClick={triggerFetch}
            disabled={fetching}
            className="px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center gap-2"
            style={{
              background: fetching ? "var(--surface2)" : "var(--accent)",
              color: fetching ? "var(--text-muted)" : "#fff",
              border: "1px solid transparent",
            }}
          >
            {fetching ? (
              <>
                <span className="blink">●</span> Fetching…
              </>
            ) : (
              "⟳ Sync Now"
            )}
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard label="Total Matches" value={data?.total ?? "—"} color="var(--text)" />
          <StatCard label="Avg Score" value={avgScore || "—"} color="var(--accent)" />
          <StatCard label="Visa Sponsors" value={visaCount || "—"} color="var(--purple)" />
          <StatCard label="Relocation" value={relocationCount || "—"} color="var(--accent2)" />
        </div>

        {/* Filters */}
        <div
          className="rounded-xl p-4 mb-5"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <FilterBar filters={filters} onChange={handleFilterChange} />
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {data ? (
              <>
                Showing <span style={{ color: "var(--text)" }}>{jobs.length}</span> of{" "}
                <span style={{ color: "var(--text)" }}>{data.total}</span> jobs
              </>
            ) : "Loading…"}
          </p>
          <p className="mono text-xs" style={{ color: "var(--text-faint)" }}>
            sorted by score ↓
          </p>
        </div>

        {/* Job list */}
        {loading ? (
          <div className="flex flex-col gap-3">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="rounded-xl h-28 animate-pulse"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              />
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div
            className="rounded-xl p-16 text-center"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <div className="text-4xl mb-4">📡</div>
            <p className="font-semibold" style={{ color: "var(--text)" }}>No jobs found</p>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              {data?.totalFetched === 0
                ? 'Click "Sync Now" to fetch jobs for the first time'
                : "Try adjusting your filters"}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {jobs.map((job, i) => (
              <JobCard key={job.id} job={job} index={i} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-8">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 rounded-lg text-xs font-medium transition-all"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: page === 1 ? "var(--text-faint)" : "var(--text)",
              }}
            >
              ← Prev
            </button>
            <span className="mono text-xs" style={{ color: "var(--text-muted)" }}>
              {page} / {data.totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              disabled={page === data.totalPages}
              className="px-4 py-2 rounded-lg text-xs font-medium transition-all"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: page === data.totalPages ? "var(--text-faint)" : "var(--text)",
              }}
            >
              Next →
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
