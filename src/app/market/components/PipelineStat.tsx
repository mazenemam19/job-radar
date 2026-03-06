// src/app/market/components/PipelineStat.tsx
"use client";

import React from "react";

interface PipelineData {
  total: number;
  topSkills: Array<{ skill: string; count: number }>;
}

const EMOJIS: Record<string, string> = {
  visa: "✈️",
  local: "🇪🇬",
  global: "🌍",
};

const NAMES: Record<string, string> = {
  visa: "Visa Hubs",
  local: "Egypt Market",
  global: "Global Remote",
};

export default function PipelineStat({ pipeline, data }: { pipeline: string; data: PipelineData }) {
  const maxCount = data.topSkills[0]?.count || 1;

  return (
    <div className="market-card pipeline-card">
      <div className="pipeline-header">
        <div className="pipeline-identity">
          <span className="emoji">{EMOJIS[pipeline]}</span>
          <h3 className="pipeline-name">{NAMES[pipeline]}</h3>
        </div>
        <div className="pipeline-total">{data.total}</div>
      </div>

      <div className="pipeline-skills">
        {data.topSkills.map((s) => (
          <div key={s.skill} className="skill-row">
            <div className="skill-meta">
              <span className="skill-label">{s.skill}</span>
              <span className="skill-count">{s.count}</span>
            </div>
            <div className="skill-track">
              <div className="skill-fill" style={{ width: `${(s.count / maxCount) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .market-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 24px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
          transition: border-color 0.3s;
        }
        .market-card:hover {
          border-color: var(--border-hi);
        }
        .pipeline-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
        }
        .pipeline-identity {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .emoji {
          font-size: 20px;
          filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.1));
        }
        .pipeline-name {
          font-family: var(--font-display);
          font-weight: 800;
          color: #fff;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .pipeline-total {
          background: var(--bg-2);
          color: #fff;
          font-family: var(--font-mono);
          font-weight: 700;
          font-size: 11px;
          padding: 4px 10px;
          border-radius: 4px;
          border: 1px solid var(--border);
        }
        .pipeline-skills {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .skill-row {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .skill-meta {
          display: flex;
          justify-content: space-between;
          font-family: var(--font-mono);
          font-size: 9px;
          text-transform: uppercase;
          font-weight: 700;
          letter-spacing: 0.1em;
        }
        .skill-label {
          color: var(--text-muted);
        }
        .skill-count {
          color: var(--text-dim);
        }
        .skill-track {
          height: 2px;
          background: var(--bg-3);
          border-radius: 2px;
          overflow: hidden;
        }
        .skill-fill {
          height: 100%;
          background: var(--accent);
          opacity: 0.4;
          border-radius: 2px;
        }
      `}</style>
    </div>
  );
}
