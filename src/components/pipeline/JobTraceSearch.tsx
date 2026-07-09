"use client";
// src/components/pipeline/JobTraceSearch.tsx
// "Can't find it in the lists above? Search the full raw pool directly."
// Bypasses mode filtering and the 2000-row cap entirely — this is the
// escape hatch for jobs the gate-list breakdown above can never surface,
// because they never entered the candidate pool in the first place.

import { useState } from "react";
import type { JobTraceResult } from "@/lib/explain";

const GATE_LABELS: Record<string, string> = {
  date: "Date filter",
  seniority: "Seniority filter",
  excluded_keywords: "Excluded keywords",
  required_keywords: "Required keywords",
  blacklisted_locations: "Blacklisted locations",
  skill_match: "Skill match",
  global_mode: "Global-mode region filter",
  gemini: "Your Gemini filter",
  scoring: "Scoring",
};

export default function JobTraceSearch() {
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<JobTraceResult[] | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() && !company.trim()) {
      setError("Enter a title or company to search for.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (title.trim()) params.set("title", title.trim());
      if (company.trim()) params.set("company", company.trim());
      const res = await fetch(`/api/jobs/explain?${params.toString()}`);
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Search failed.");
        setResults(null);
      } else {
        setResults(data.data.matches as JobTraceResult[]);
      }
    } catch {
      setError("Search failed — check your connection and try again.");
      setResults(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-[#1e1e30] bg-[#0d0d1a]">
      <div className="border-b border-[#1e1e30] px-5 py-3.5">
        <div className="text-[13px] font-semibold text-slate-300">
          Can&apos;t find it in the lists above?
        </div>
        <p className="m-0 mt-1 text-xs text-slate-600">
          Search the full raw pool directly — no pipeline filter, no 2,000-job cap.
        </p>
      </div>

      <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-2 px-5 py-3.5">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Job title"
          className="min-w-[160px] flex-1 rounded-lg border border-[#1e1e30] bg-[#0a0a14] px-3 py-2 text-[13px] text-slate-300 placeholder:text-slate-600 focus:border-indigo-400 focus:outline-none"
        />
        <input
          type="text"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="Company"
          className="min-w-[160px] flex-1 rounded-lg border border-[#1e1e30] bg-[#0a0a14] px-3 py-2 text-[13px] text-slate-300 placeholder:text-slate-600 focus:border-indigo-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg border border-[#1e1e30] bg-[#1e1e30] px-4 py-2 text-[13px] text-indigo-400 cursor-pointer disabled:cursor-default disabled:opacity-50"
        >
          {loading ? "Searching…" : "Search"}
        </button>
      </form>

      {error && <p className="mx-5 mb-3 text-xs text-red-500">{error}</p>}

      {results && results.length === 0 && (
        <p className="mx-5 mb-4 text-xs text-slate-600">
          No jobs in the raw pool matched that search.
        </p>
      )}

      {results && results.length > 0 && (
        <div className="border-t border-[#1e1e30]">
          {results.map((job) => (
            <div key={job.id} className="border-b border-[#1e1e30] px-5 py-3.5 last:border-b-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-medium text-slate-300">{job.title}</span>
                <span className="text-[13px] text-slate-500">· {job.company}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    job.pipeline_match
                      ? "bg-emerald-400/10 text-emerald-400"
                      : "bg-red-500/10 text-red-500"
                  }`}
                >
                  {job.mode} pipeline {job.pipeline_match ? "· enabled" : "· not enabled"}
                </span>
              </div>

              <div className="mt-2 text-xs text-slate-500">
                {job.stopped_at ? (
                  <>
                    Stopped at{" "}
                    <span className="font-medium text-red-500">
                      {GATE_LABELS[job.stopped_at] ?? job.stopped_at}
                    </span>
                    : {job.gates.find((g) => g.gate === job.stopped_at)?.reason}
                  </>
                ) : job.gemini_pending ? (
                  <>Passed every gate so far — add a Gemini API key in Settings to check further.</>
                ) : (
                  <>
                    Passed every gate — on your dashboard with a score of{" "}
                    <span className="font-medium text-emerald-400">{job.final_score}</span>.
                  </>
                )}
              </div>

              {!job.pipeline_match && (
                <p className="m-0 mt-1 text-[11px] text-slate-600">
                  This job never entered your candidate pool — its mode isn&apos;t one of your
                  enabled pipelines, regardless of what the gates above show.
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
