// src/components/JobCard.tsx
"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { Job } from "@/types";

function ScoreRing({ score }: { score: number }) {
  const [animated, setAnimated] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setAnimated(Math.round(score)), 120);
    return () => clearTimeout(t);
  }, [score]);
  const r = 23,
    C = 2 * Math.PI * r,
    arc = (animated / 100) * C;
  const color = score >= 80 ? "var(--green)" : score >= 60 ? "var(--amber)" : "var(--slate)";
  return (
    <div className="score-ring-wrap">
      <svg width="58" height="58" viewBox="0 0 58 58" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="29" cy="29" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="3.5" />
        <circle
          cx="29"
          cy="29"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={`${arc} ${C}`}
          style={{ transition: "stroke-dasharray 0.9s cubic-bezier(0.34,1.3,0.64,1)" }}
        />
      </svg>
      <span className="score-num" style={{ color }}>
        {Math.round(score)}
      </span>
    </div>
  );
}

function daysAgo(iso: string): string {
  const d = Math.floor((Date.now() - Date.parse(iso)) / 864e5);
  if (isNaN(d) || d < 0) return "–";
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  return `${d}d ago`;
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setW(Math.min(100, value)), 200);
    return () => clearTimeout(t);
  }, [value]);
  const color = value >= 80 ? "var(--green)" : value >= 60 ? "var(--amber)" : "var(--slate)";
  return (
    <div className="sbar-row">
      <span className="sbar-lbl">{label}</span>
      <div className="sbar-track">
        <div className="sbar-fill" style={{ width: `${w}%`, background: color }} />
      </div>
      <span className="sbar-val" style={{ color }}>
        {Math.round(value)}
      </span>
    </div>
  );
}

export default function JobCard({ job, index }: { job: Job; index: number }) {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [strategy, setStrategy] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const qual = job.totalScore >= 80 ? "excellent" : job.totalScore >= 60 ? "good" : "";
  const localCls = job.mode === "local" ? "local-mode" : "";

  async function generateStrategy() {
    if (isGenerating) return;

    let secretToUse = "";
    if (process.env.NODE_ENV === "production") {
      const enteredSecret = window.prompt("Enter CRON_SECRET to generate strategy:");
      if (!enteredSecret) return;
      secretToUse = enteredSecret;
    }

    setIsGenerating(true);
    try {
      const headers: Record<string, string> = {};
      if (secretToUse) headers["x-cron-secret"] = secretToUse;

      const res = await fetch(`/api/jobs/${encodeURIComponent(job.id)}/strategy`, {
        headers,
      });
      const data = await res.json();
      if (data.strategy) {
        setStrategy(data.strategy);
      } else if (data.error === "Unauthorized") {
        alert("Invalid secret.");
      }
    } catch (e) {
      console.error("Strategy generation failed", e);
    } finally {
      setIsGenerating(false);
    }
  }

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

      {job.redFlags && job.redFlags.length > 0 && (
        <div className="red-flags">
          {job.redFlags.map((flag) => (
            <span key={flag} className="red-flag-badge" title="Toxic culture signal detected">
              🚩 {flag}
            </span>
          ))}
        </div>
      )}

      <div className="card-meta">
        <span>📍 {job.location}</span>
        {job.isRemote && <span className="remote-badge">🏠 Remote</span>}
        {job.salary && <span>💰 {job.salary}</span>}
        <span className="meta-date">{daysAgo(job.postedAt)}</span>
        {job.mode === "visa" ? (
          <span className="visa-badge">✈ Visa ✓</span>
        ) : job.mode === "local" ? (
          <span className="local-badge">🇪🇬 Local</span>
        ) : (
          <span className="remote-badge">🌐 Global</span>
        )}
      </div>

      <div className="card-skills">
        {job.matchedSkills.map((s) => (
          <span key={s} className="skill-chip matched">
            {s}
          </span>
        ))}
        {job.missingSkills.slice(0, 4).map((s) => (
          <span key={s} className="skill-chip missing">
            {s}
          </span>
        ))}
        {job.bonusSkills.map((s) => (
          <span key={s} className="skill-chip bonus">
            {s}
          </span>
        ))}
      </div>

      <div className="score-bars">
        <ScoreBar label="Skills" value={job.skillMatchScore} />
        <ScoreBar label="Recency" value={job.recencyScore} />
        {job.relocationBonus > 0 && (
          <div className="reloc-badge">+{job.relocationBonus} relocation bonus</div>
        )}
      </div>

      <div className="card-actions">
        <a href={job.url} target="_blank" rel="noopener noreferrer" className="btn-apply">
          Apply Now ↗
        </a>
        <button className="btn-strategy" onClick={generateStrategy} disabled={isGenerating}>
          {isGenerating ? "🤖 Thinking..." : strategy ? "✅ Strategy Ready" : "🎯 Get Strategy"}
        </button>
        {job.description && (
          <button
            className="btn-details"
            onClick={() => router.push(`/job/${encodeURIComponent(job.id)}`)}
          >
            Details →
          </button>
        )}
      </div>

      {strategy &&
        mounted &&
        createPortal(
          <div className="strategy-overlay" onClick={() => setStrategy(null)}>
            <div className="strategy-modal" onClick={(e) => e.stopPropagation()}>
              <div className="strategy-header">
                <h3>🤖 AI Application Strategy</h3>
                <button className="close-btn" onClick={() => setStrategy(null)}>
                  ×
                </button>
              </div>
              <div className="strategy-body">
                <div className="strategy-content">
                  {strategy.split("\n").map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                </div>
              </div>
              <div className="strategy-footer">
                <button className="btn-close" onClick={() => setStrategy(null)}>
                  Got it
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </article>
  );
}
