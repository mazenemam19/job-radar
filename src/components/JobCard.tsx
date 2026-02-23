"use client";

import { useState } from "react";
import { Job } from "@/lib/types";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function scoreColor(score: number): { bg: string; text: string } {
  if (score >= 70) return { bg: "#15803d", text: "#86efac" };
  if (score >= 45) return { bg: "#92400e", text: "#fcd34d" };
  return { bg: "#374151", text: "#9ca3af" };
}

export default function JobCard({ job }: { job: Job }) {
  const [expanded, setExpanded] = useState(false);
  const { bg, text: textColor } = scoreColor(job.totalScore);

  const descExcerpt = job.description
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);

  return (
    <div
      className="rounded-xl overflow-hidden transition-all"
      style={{ background: "#0d1525", border: "1px solid #1e3050" }}
    >
      {/* Main row */}
      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Score circle */}
          <div
            className="flex-shrink-0 w-[52px] h-[52px] rounded-full flex items-center justify-center font-bold text-base"
            style={{ background: bg, color: textColor }}
          >
            {job.totalScore}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-white text-base leading-snug">{job.title}</h3>
                <div className="text-slate-400 text-sm mt-0.5">
                  {job.company}
                  <span className="mx-2 text-slate-600">·</span>
                  <span>{job.countryFlag} {job.location}</span>
                  {job.salary && (
                    <>
                      <span className="mx-2 text-slate-600">·</span>
                      <span className="text-blue-400">{job.salary}</span>
                    </>
                  )}
                </div>
                <div className="text-slate-600 text-xs mt-1 flex items-center gap-2">
                  <span>{timeAgo(job.postedAt)}</span>
                  <span>·</span>
                  <span className="capitalize">{job.source}</span>
                  {job.relocationBonus > 0 && (
                    <>
                      <span>·</span>
                      <span className="text-blue-400">✈️ Relocation</span>
                    </>
                  )}
                  <span>·</span>
                  <span className="text-green-500">🛂 Visa Sponsored</span>
                </div>
              </div>
              <a
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                Apply →
              </a>
            </div>

            {/* Skill pills */}
            <div className="flex flex-wrap gap-1.5 mt-3">
              {job.matchedSkills.slice(0, 8).map((skill) => (
                <span
                  key={skill}
                  className="px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{ background: "#14532d", color: "#86efac" }}
                >
                  {skill}
                </span>
              ))}
              {job.matchedSkills.length > 8 && (
                <span className="text-slate-500 text-xs px-2 py-0.5">
                  +{job.matchedSkills.length - 8} more
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded((e) => !e)}
          className="mt-3 text-slate-500 hover:text-slate-300 text-xs flex items-center gap-1 transition-colors"
        >
          {expanded ? "▲ Less details" : "▼ More details"}
        </button>
      </div>

      {/* Expanded section */}
      {expanded && (
        <div className="px-5 pb-5" style={{ borderTop: "1px solid #1e3050" }}>
          <div className="pt-4 grid md:grid-cols-2 gap-6">
            {/* Score breakdown */}
            <div>
              <h4 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">Score Breakdown</h4>
              <div className="space-y-2">
                {[
                  { label: "Skill Match", value: job.skillMatchScore, weight: "60%", color: "#3b82f6" },
                  { label: "Recency", value: job.recencyScore, weight: "30%", color: "#8b5cf6" },
                  { label: "Relocation Bonus", value: job.relocationBonus, weight: "10%", color: "#10b981" },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">{item.label} <span className="text-slate-600">({item.weight})</span></span>
                      <span className="font-bold" style={{ color: item.color }}>{item.value}</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#162238" }}>
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.min(100, item.value)}%`, background: item.color }}
                      />
                    </div>
                  </div>
                ))}
                <div className="pt-2 flex justify-between text-sm font-bold border-t mt-2" style={{ borderColor: "#1e3050" }}>
                  <span className="text-slate-300">Total Score</span>
                  <span className="text-white">{job.totalScore}</span>
                </div>
              </div>
            </div>

            {/* Missing skills */}
            <div>
              <h4 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">Missing Skills</h4>
              <div className="flex flex-wrap gap-1.5">
                {job.missingSkills.slice(0, 12).map((skill) => (
                  <span
                    key={skill}
                    className="px-2 py-0.5 rounded-full text-xs"
                    style={{ background: "#1c1917", color: "#78716c" }}
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Description excerpt */}
          <div className="mt-4">
            <h4 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Description Excerpt</h4>
            <p className="text-slate-400 text-sm leading-relaxed">
              {descExcerpt}
              {job.description.length > 300 && (
                <a
                  href={job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline ml-1"
                >
                  Read more →
                </a>
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
