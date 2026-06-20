"use client";
// src/components/v2/dashboard/StrategyModal.tsx

import { useState } from "react";
import type { ScoredJob } from "@/lib/v2/types";

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
      const res = await fetch("/api/v2/strategy", {
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
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#0d0d1a",
          border: "1px solid #1e1e30",
          borderRadius: 12,
          padding: 28,
          maxWidth: 580,
          width: "100%",
          maxHeight: "80vh",
          overflow: "auto",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 20,
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 17, color: "#e2e8f0", fontWeight: 600 }}>
              ✨ Application Strategy
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}>
              {job.title} at {job.company}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#64748b",
              fontSize: 20,
              cursor: "pointer",
              padding: 4,
            }}
          >
            ×
          </button>
        </div>

        {strategies.length === 0 && !loading && !error && (
          <button
            onClick={generate}
            style={{
              width: "100%",
              padding: "12px 0",
              background: "#6366f1",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Generate strategy with Gemini
          </button>
        )}

        {loading && (
          <div style={{ textAlign: "center", padding: "32px 0", color: "#818cf8", fontSize: 14 }}>
            <div style={{ marginBottom: 8, fontSize: 24 }}>✨</div>
            Thinking...
          </div>
        )}

        {error && (
          <div
            style={{
              padding: 14,
              background: "#1a0a0a",
              border: "1px solid #5b1717",
              borderRadius: 8,
              color: "#f87171",
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        {strategies.length > 0 && (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {strategies.map((s, i) => (
              <li
                key={i}
                style={{
                  display: "flex",
                  gap: 12,
                  padding: "12px 0",
                  borderBottom: i < strategies.length - 1 ? "1px solid #1e1e30" : "none",
                }}
              >
                <span
                  style={{
                    flexShrink: 0,
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    background: "#1e1e30",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    color: "#818cf8",
                    fontWeight: 700,
                  }}
                >
                  {i + 1}
                </span>
                <span style={{ fontSize: 14, color: "#cbd5e1", lineHeight: 1.5 }}>{s}</span>
              </li>
            ))}
          </ul>
        )}

        {strategies.length > 0 && (
          <button
            onClick={generate}
            style={{
              marginTop: 16,
              padding: "8px 16px",
              background: "#1e1e30",
              color: "#818cf8",
              border: "none",
              borderRadius: 6,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Regenerate
          </button>
        )}
      </div>
    </div>
  );
}
