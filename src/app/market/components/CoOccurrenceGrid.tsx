// src/app/market/components/CoOccurrenceGrid.tsx
"use client";

import React from "react";
import { CoOccur } from "@/types";

export default function CoOccurrenceGrid({ data }: { data: CoOccur[] }) {
  return (
    <div className="market-card co-occur-section">
      <h2 className="section-title">
        <span className="icon">🔗</span>
        Top Skill Co-Occurrence
      </h2>

      <div className="occur-grid">
        {data.slice(0, 24).map((pair, idx) => (
          <div key={idx} className="occur-item">
            <div className="pair-names">
              <span className="skill-a">{pair.skillA}</span>
              <span className="plus">+</span>
              <span className="skill-b">{pair.skillB}</span>
            </div>
            <div className="pair-count">{pair.count}</div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .market-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 32px;
        }
        .section-title {
          font-family: var(--font-display);
          font-size: 18px;
          font-weight: 800;
          color: #fff;
          margin-bottom: 32px;
          padding-bottom: 16px;
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          gap: 12px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .occur-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }
        .occur-item {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 12px 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .pair-names {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-muted);
          display: flex;
          gap: 6px;
          align-items: center;
        }
        .skill-a,
        .skill-b {
          color: #fff;
        }
        .plus {
          opacity: 0.3;
        }
        .pair-count {
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--accent);
          font-weight: 700;
        }
      `}</style>
    </div>
  );
}
