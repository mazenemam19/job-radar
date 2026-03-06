// src/app/market/components/SkillGaps.tsx
"use client";

import React from "react";
import { SkillGap } from "@/types";
import { CATEGORY_COLORS } from "@/lib/constants";

export default function SkillGaps({ data }: { data: SkillGap[] }) {
  return (
    <div className="market-card gaps-section">
      <h3 className="section-title">Market Skill Gaps</h3>
      <div className="gaps-list">
        {data.slice(0, 15).map((gap) => (
          <div key={gap.skill} className="gap-item">
            <div className="gap-info">
              <span
                className="skill-dot"
                style={{ background: CATEGORY_COLORS[gap.category] || "#64748b" }}
              />
              <span className="skill-name">{gap.skill}</span>
              {gap.trending && <span className="trend-tag">Trending</span>}
            </div>
            <div className="gap-pct">{gap.percentage}%</div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .market-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 24px;
        }
        .section-title {
          font-family: var(--font-display);
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-bottom: 20px;
          color: #fff;
        }
        .gaps-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .gap-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.03);
        }
        .gap-info {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .skill-dot {
          width: 6px;
          height: 6px;
          border-radius: 1px;
        }
        .skill-name {
          font-size: 13px;
          font-weight: 600;
          color: #fff;
        }
        .trend-tag {
          font-size: 8px;
          text-transform: uppercase;
          background: rgba(245, 158, 11, 0.1);
          color: #f59e0b;
          padding: 1px 4px;
          border-radius: 2px;
          font-weight: 800;
          letter-spacing: 0.05em;
        }
        .gap-pct {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--text-muted);
        }
      `}</style>
    </div>
  );
}
