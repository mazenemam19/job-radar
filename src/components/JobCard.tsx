// src/components/JobCard.tsx
"use client";

import { useState, useEffect } from "react";
import type { Job } from "@/lib/types";

function ScoreRing({ score }: { score: number }) {
  const [animated, setAnimated] = useState(0);
  useEffect(() => { const t = setTimeout(() => setAnimated(Math.round(score)), 120); return () => clearTimeout(t); }, [score]);
  const r = 23, C = 2 * Math.PI * r, arc = (animated / 100) * C;
  const color = score >= 80 ? "var(--green)" : score >= 60 ? "var(--amber)" : "var(--slate)";
  return (
    <div className="score-ring-wrap">
      <svg width="58" height="58" viewBox="0 0 58 58" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="29" cy="29" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="3.5" />
        <circle cx="29" cy="29" r={r} fill="none" stroke={color} strokeWidth="3.5" strokeLinecap="round"
          strokeDasharray={`${arc} ${C}`}
          style={{ transition: "stroke-dasharray 0.9s cubic-bezier(0.34,1.3,0.64,1)" }}
        />
      </svg>
      <span className="score-num" style={{ color }}>{Math.round(score)}</span>
    </div>
  );
}

function daysAgo(iso: string): string {
  const d = Math.floor((Date.now() - Date.parse(iso)) / 864e5);
  if (isNaN(d) || d < 0) return "–";
  if (d === 0) return "Today"; if (d === 1) return "Yesterday";
  return `${d}d ago`;
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const [w, setW] = useState(0);
  useEffect(() => { const t = setTimeout(() => setW(Math.min(100, value)), 200); return () => clearTimeout(t); }, [value]);
  const color = value >= 80 ? "var(--green)" : value >= 60 ? "var(--amber)" : "var(--slate)";
  return (
    <div className="sbar-row">
      <span className="sbar-lbl">{label}</span>
      <div className="sbar-track"><div className="sbar-fill" style={{ width: `${w}%`, background: color }} /></div>
      <span className="sbar-val" style={{ color }}>{Math.round(value)}</span>
    </div>
  );
}

export default function JobCard({ job, index }: { job: Job; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const qual = job.totalScore >= 80 ? "excellent" : job.totalScore >= 60 ? "good" : "";
  const localCls = job.mode === "local" ? "local-mode" : "";

  return (
    <article
      className={`job-card ${qual} ${localCls}`}
      style={{ animationDelay: `${Math.min(index * 0.045, 0.4)}s` }}
    >
      <div className="card-top">
        <div className="card-company">
          <span className="company-flag">{job.countryFlag}</span>
          <div style={{ minWidth: 0 }}>
            <span className="company-name">{job.company}</span>
            <span className="company-country">{job.country}</span>
          </div>
        </div>
        <ScoreRing score={job.totalScore} />
      </div>

      <h2 className="card-title">{job.title}</h2>

      <div className="card-meta">
        <span>📍 {job.location}</span>
        {job.isRemote && <span className="remote-badge">🌐 Remote</span>}
        {job.salary && <span>💰 {job.salary}</span>}
        <span className="meta-date">{daysAgo(job.postedAt)}</span>
        {job.mode === "visa"
          ? <span className="visa-badge">✈ Visa ✓</span>
          : <span className="local-badge">🇪🇬 Local</span>
        }
      </div>

      <div className="card-skills">
        {job.matchedSkills.map(s => <span key={s} className="skill-chip matched">{s}</span>)}
        {job.missingSkills.slice(0, 4).map(s => <span key={s} className="skill-chip missing">{s}</span>)}
      </div>

      <div className="score-bars">
        <ScoreBar label="Skills" value={job.skillMatchScore} />
        <ScoreBar label="Recency" value={job.recencyScore} />
        {job.relocationBonus > 0 && <div className="reloc-badge">+{job.relocationBonus} relocation bonus</div>}
      </div>

      {expanded && job.description && (
        <div className="card-desc">
          {job.description.length > 900 ? job.description.slice(0, 900) + "…" : job.description}
        </div>
      )}

      <div className="card-actions">
        <a href={job.url} target="_blank" rel="noopener noreferrer" className="btn-apply">Apply Now ↗</a>
        {job.description && (
          <button className="btn-details" onClick={() => setExpanded(v => !v)}>
            {expanded ? "↑ Less" : "↓ Details"}
          </button>
        )}
      </div>
    </article>
  );
}