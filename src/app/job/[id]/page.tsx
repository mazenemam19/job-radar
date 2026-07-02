"use client";
// src/app/job/[id]/page.tsx
// Job detail page. Rebuilt for v2 — the old version read from a file-storage
// API route that no longer exists, used the pre-multi-tenant Job type, and
// styled itself with CSS classes from the old (non-existent) stylesheet.
// This version reads from the user's own cached scored jobs (same data their
// dashboard shows) and matches the rest of the v2 dark-theme styling system.

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import DOMPurify from "dompurify";
import { computeLiveDisplayScore } from "@/lib/scoring";
import { formatPostedLabel } from "@/lib/job-display";
import { MODE_COLORS, MODE_LABELS } from "@/lib/constants";
import ScoreBar from "@/components/dashboard/ScoreBar";
import type { ScoredJob } from "@/lib/types";

const PAGE_SHELL_CLASS = "mx-auto min-h-screen max-w-[760px] bg-[#08080f] px-6 py-8 font-sans";
const BACK_BTN_CLASS =
  "mb-5 rounded-md border border-[#1e1e30] bg-transparent px-3.5 py-1.5 text-[13px] text-slate-400 cursor-pointer";

export default function JobDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<ScoredJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const id = params?.id;

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    fetch(`/api/jobs/${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.ok) {
          setJob(res.data);
        } else {
          setNotFound(true);
        }
        setLoading(false);
      })
      .catch(() => {
        setNotFound(true);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className={PAGE_SHELL_CLASS}>
        <div className="p-10 text-slate-500">Loading…</div>
      </div>
    );
  }

  if (notFound || !job) {
    return (
      <div className={PAGE_SHELL_CLASS}>
        <button onClick={() => router.back()} className={BACK_BTN_CLASS}>
          ← Back
        </button>
        <div className="py-10 text-slate-500">
          Job not found — it may have aged out of your dashboard, or your settings changed since you
          last saw it.
        </div>
      </div>
    );
  }

  const { recencyScore: liveRecencyScore, totalScore: displayTotalScore } =
    computeLiveDisplayScore(job);

  const modeColor = MODE_COLORS[job.mode] ?? "#6366f1";
  const postedLabel = formatPostedLabel(job);

  const cleanDescription = job.description
    ? DOMPurify.sanitize(job.description, {
        ALLOWED_TAGS: [
          "p",
          "br",
          "ul",
          "ol",
          "li",
          "strong",
          "em",
          "b",
          "i",
          "u",
          "h1",
          "h2",
          "h3",
          "h4",
          "a",
          "blockquote",
          "span",
          "div",
        ],
        ALLOWED_ATTR: ["href", "target", "rel"],
      })
    : "";

  return (
    <div className={PAGE_SHELL_CLASS}>
      <button onClick={() => router.back()} className={BACK_BTN_CLASS}>
        ← Back
      </button>

      {/* Header card */}
      <div
        className="mb-4 rounded-[10px] border border-[#1e1e30] bg-[#0d0d1a] px-7 py-6"
        style={{ borderLeft: `3px solid ${modeColor}` }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="m-0 mb-1.5 text-[22px] font-bold text-slate-200">{job.title}</h1>
            <div className="text-sm text-slate-400">
              {job.company} · {job.country_flag} {job.location} · {postedLabel}
            </div>
          </div>

          <div
            className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-full"
            style={{
              background: `conic-gradient(${modeColor} ${displayTotalScore * 3.6}deg, #1e1e30 0deg)`,
            }}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#0d0d1a] text-[15px] font-bold text-slate-200">
              {displayTotalScore}
            </div>
          </div>
        </div>

        {/* Tags row */}
        <div className="mt-3.5 flex flex-wrap gap-1.5">
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
            style={{ background: `${modeColor}20`, color: modeColor }}
          >
            {MODE_LABELS[job.mode]}
          </span>

          {job.visa_sponsorship && (
            <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[11px] text-indigo-400">
              Visa sponsorship
            </span>
          )}

          {job.gemini_quota_exhausted ? (
            <span
              title="Gemini's quota was exhausted, so this job is shown by default rather than filtered out."
              className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-500"
            >
              ⚠ Gemini quota exhausted
            </span>
          ) : (
            !job.gemini_reviewed && (
              <span
                title="Gemini didn't return a decision for this job, so it's shown by default rather than filtered out."
                className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-500"
              >
                ⚠ Not AI-reviewed
              </span>
            )
          )}

          {job.matched_skills.map((s) => (
            <span
              key={s}
              className="rounded-full bg-slate-900 px-2 py-0.5 text-[11px] text-slate-500"
            >
              {s}
            </span>
          ))}

          {job.bonus_skills.map((s) => (
            <span
              key={s}
              title="Bonus skill — not part of your scoring, just nice to know it's there"
              className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-500"
            >
              +{s}
            </span>
          ))}
        </div>

        {/* Score breakdown */}
        <div className="mt-4.5 flex flex-col gap-2">
          <div>
            <div className="mb-0.5 text-[11px] text-slate-500">Skill match</div>
            <ScoreBar value={job.skill_match_score} color="#6366f1" />
          </div>
          <div>
            <div className="mb-0.5 text-[11px] text-slate-500">Recency (live)</div>
            <ScoreBar value={liveRecencyScore} color="#22c55e" />
          </div>
          <div>
            <div className="mb-0.5 text-[11px] text-slate-500">Relocation</div>
            <ScoreBar value={job.relocation_bonus} color="#f59e0b" />
          </div>
        </div>

        {job.gemini_reason && (
          <div className="mt-4 rounded-lg bg-[#0a0a18] px-3.5 py-2.5 text-[13px] italic text-slate-400">
            Gemini: {job.gemini_reason}
          </div>
        )}

        <a
          href={job.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4.5 inline-block rounded-lg bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white no-underline"
        >
          Apply →
        </a>
      </div>

      {/* Description */}
      {cleanDescription && (
        <div
          className="rounded-[10px] border border-[#1e1e30] bg-[#0d0d1a] px-7 py-6 text-sm leading-relaxed text-slate-300"
          dangerouslySetInnerHTML={{ __html: cleanDescription }}
        />
      )}
    </div>
  );
}
