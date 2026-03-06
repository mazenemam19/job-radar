"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { Job } from "@/types";

function daysAgo(iso: string): string {
  const d = Math.floor((Date.now() - Date.parse(iso)) / 864e5);
  if (isNaN(d) || d < 0) return "–";
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  return `${d}d ago`;
}

export default function JobDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);

  const id = params?.id;

  useEffect(() => {
    if (!id) {
      setLoading(false); // No id, so not loading anymore
      return; // Exit if no id
    }

    fetch(`/api/jobs/${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setJob(data);
        setLoading(false);
      });
  }, [id]);

  if (loading)
    return (
      <div className="detail-shell">
        <div className="detail-loading">Loading…</div>
      </div>
    );

  if (!job)
    return (
      <div className="detail-shell">
        <div className="detail-loading">Job not found.</div>
      </div>
    );

  const scoreColor =
    job.totalScore >= 80 ? "var(--green)" : job.totalScore >= 60 ? "var(--amber)" : "var(--slate)";

  return (
    <div className="detail-shell">
      {/* ── Back ── */}
      <button className="detail-back" onClick={() => router.back()}>
        ← Back
      </button>

      {/* ── Header ── */}
      <header className="detail-header">
        <div className="detail-company-row">
          <span className="detail-flag">{job!.countryFlag}</span>
          <div>
            <span className="detail-company">{job!.company}</span>
            <span className="detail-country">{job!.country}</span>
          </div>
          <div className="detail-score" style={{ color: scoreColor }}>
            {Math.round(job!.totalScore)}
          </div>
        </div>

        <h1 className="detail-title">{job!.title}</h1>

        <div className="detail-meta">
          <span>📍 {job!.location}</span>
          {job!.isRemote && <span className="remote-badge">🏠 Remote</span>}
          <span className="meta-date">🕐 {daysAgo(job!.postedAt)}</span>
          {job!.mode === "visa" ? (
            <span className="visa-badge">✈ Visa ✓</span>
          ) : job!.mode === "local" ? (
            <span className="local-badge">🇪🇬 Local</span>
          ) : (
            <span className="remote-badge">🌐 Global</span>
          )}
        </div>

        {/* ── Skill chips ── */}
        <div className="detail-skills">
          {job!.matchedSkills.map((s) => (
            <span key={s} className="skill-chip matched">
              {s}
            </span>
          ))}
          {job!.missingSkills.map((s) => (
            <span key={s} className="skill-chip missing">
              {s}
            </span>
          ))}
        </div>

        {/* ── Score bars ── */}
        <div className="detail-scores">
          <div className="detail-score-item">
            <span className="detail-score-label">Skills Match</span>
            <div className="sbar-track" style={{ flex: 1 }}>
              <div
                className="sbar-fill"
                style={{ width: `${job!.skillMatchScore}%`, background: scoreColor }}
              />
            </div>
            <span className="detail-score-val" style={{ color: scoreColor }}>
              {job!.skillMatchScore}
            </span>
          </div>
          <div className="detail-score-item">
            <span className="detail-score-label">Recency</span>
            <div className="sbar-track" style={{ flex: 1 }}>
              <div
                className="sbar-fill"
                style={{
                  width: `${job!.recencyScore}%`,
                  background:
                    job!.recencyScore >= 80
                      ? "var(--green)"
                      : job!.recencyScore >= 60
                        ? "var(--amber)"
                        : "var(--slate)",
                }}
              />
            </div>
            <span className="detail-score-val">{job!.recencyScore}</span>
          </div>
        </div>

        <a href={job!.url} target="_blank" rel="noopener noreferrer" className="detail-apply-btn">
          Apply Now ↗
        </a>
      </header>

      {/* ── Description ── */}
      {job!.description && (
        <section className="detail-body" dangerouslySetInnerHTML={{ __html: job!.description }} />
      )}

      {/* ── Bottom CTA ── */}
      <div className="detail-footer">
        <a href={job!.url} target="_blank" rel="noopener noreferrer" className="detail-apply-btn">
          Apply Now ↗
        </a>
        <button className="btn-details" onClick={() => router.back()}>
          ← Back to results
        </button>
      </div>
    </div>
  );
}
