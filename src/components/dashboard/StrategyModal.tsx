"use client";
// src/components/dashboard/StrategyModal.tsx

import { useState } from "react";
import type { ScoredJob } from "@/lib/types";
import ModalShell from "@/components/ui/ModalShell";

interface Props {
  job: ScoredJob | null;
  onClose: () => void;
}

export default function StrategyModal({ job, onClose }: Props) {
  const [strategies, setStrategies] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    if (!job) return;
    setLoading(true);
    setError(null);
    setStrategies([]);

    try {
      const res = await fetch("/api/strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job: { title: job.title, company: job.company, description: job.description },
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setStrategies(data.data.strategies);
      } else {
        setError(data.error);
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!job) return null;

  return (
    <ModalShell
      titleId="strategy-modal-title"
      title="✨ Application Strategy"
      subtitle={`${job.title} at ${job.company}`}
      onClose={onClose}
      panelClassName="max-w-[580px] max-h-[80vh] overflow-auto"
    >
      {strategies.length === 0 && !loading && !error && (
        <button
          onClick={generate}
          className="w-full cursor-pointer rounded-lg border-0 bg-[#6366f1] py-3 text-sm font-semibold text-white"
        >
          Generate strategy with Gemini
        </button>
      )}

      {loading && (
        <div className="py-8 text-center text-sm text-[#818cf8]">
          <div className="mb-2 text-2xl">✨</div>
          Thinking...
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-[#5b1717] bg-[#1a0a0a] p-3.5 text-[13px] text-[#f87171]">
          {error}
        </div>
      )}

      {strategies.length > 0 && (
        <ul className="m-0 list-none p-0">
          {strategies.map((s, i) => (
            <li
              key={i}
              className={`flex gap-3 py-3 ${
                i < strategies.length - 1 ? "border-b border-[#1e1e30]" : ""
              }`}
            >
              <span className="flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-full bg-[#1e1e30] text-[11px] font-bold text-[#818cf8]">
                {i + 1}
              </span>
              <span className="text-sm leading-relaxed text-[#cbd5e1]">{s}</span>
            </li>
          ))}
        </ul>
      )}

      {strategies.length > 0 && (
        <button
          onClick={generate}
          className="mt-4 cursor-pointer rounded-md border-0 bg-[#1e1e30] px-4 py-2 text-[13px] text-[#818cf8]"
        >
          Regenerate
        </button>
      )}
    </ModalShell>
  );
}
