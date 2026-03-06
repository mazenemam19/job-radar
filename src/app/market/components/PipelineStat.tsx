// src/app/market/components/PipelineStat.tsx
"use client";

import React from "react";
import { PipelineData } from "@/types";

export default function PipelineStat({ label, total, skills }: PipelineData) {
  return (
    <div className="pipeline-card">
      <div className="pipeline-main">
        <span className="pipeline-label">{label}</span>
        <span className="pipeline-count">{total} jobs</span>
      </div>
      
      <div className="pipeline-skills">
        {skills.map(s => (
          <div key={s.skill} className="p-skill-item">
            <span className="p-skill-name">{s.skill}</span>
            <span className="p-skill-val">{s.count}</span>
          </div>
        ))}
      </div>

      <style jsx>{`
        .pipeline-card {
          background: rgba(255,255,255,0.02);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 16px 20px;
        }
        .pipeline-main {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 12px;
        }
        .pipeline-label {
          font-family: var(--font-display);
          font-size: 13px;
          font-weight: 800;
          color: #fff;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .pipeline-count {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--accent);
          font-weight: 700;
        }
        .pipeline-skills {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }
        .p-skill-item {
          display: flex;
          justify-content: space-between;
          font-size: 10px;
          font-family: var(--font-mono);
          color: var(--text-dim);
        }
        .p-skill-name {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .p-skill-val {
          color: var(--text-muted);
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}
