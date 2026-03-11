// src/app/market/components/MissingSkillsCard.tsx
"use client";

import React from "react";
import { CATEGORY_COLORS } from "@/lib/constants";

interface MissingSkill {
  skill: string;
  category: string;
  count: number;
  percentage: number;
  reason: string;
}

export default function MissingSkillsCard({ data }: { data: MissingSkill[] }) {
  if (data.length === 0) return null;

  return (
    <div className="market-card missing-skills-section">
      <div className="card-header">
        <h3 className="section-title">Missing Skill Advantage</h3>
        <p className="section-desc">
          Common skills in React jobs that you are currently missing. Adding these could increase
          your match rate.
        </p>
      </div>

      <div className="skills-list">
        {data.map((item) => (
          <div key={item.skill} className="skill-item">
            <div className="skill-main">
              <div className="skill-identity">
                <span
                  className="skill-dot"
                  style={{ background: CATEGORY_COLORS[item.category] || "#64748b" }}
                />
                <span className="skill-name">{item.skill}</span>
              </div>
              <div className="skill-bar-container">
                <div
                  className="skill-bar-fill"
                  style={{
                    width: `${item.percentage}%`,
                    background: CATEGORY_COLORS[item.category] || "#64748b",
                  }}
                />
              </div>
            </div>
            <div className="skill-meta">
              <span className="skill-pct">{item.percentage}% of filtered jobs</span>
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .market-card {
          background: #0f0f1c;
          border: 1px solid rgba(99, 102, 241, 0.2);
          border-radius: 12px;
          padding: 24px;
          position: relative;
          overflow: hidden;
        }
        .market-card::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          width: 4px;
          height: 100%;
          background: linear-gradient(to bottom, #6366f1, #a855f7);
        }
        .card-header {
          margin-bottom: 24px;
        }
        .section-title {
          font-family: var(--font-display);
          font-size: 14px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-bottom: 8px;
          color: #fff;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .section-title::after {
          font-size: 8px;
          background: rgba(99, 102, 241, 0.2);
          color: #818cf8;
          padding: 2px 6px;
          border-radius: 4px;
          vertical-align: middle;
        }
        .section-desc {
          font-size: 11px;
          color: #7171a3;
          line-height: 1.5;
        }
        .skills-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .skill-item {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .skill-main {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }
        .skill-identity {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 100px;
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
        .skill-bar-container {
          flex: 1;
          height: 4px;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 2px;
          overflow: hidden;
        }
        .skill-bar-fill {
          height: 100%;
          opacity: 0.6;
        }
        .skill-meta {
          display: flex;
          justify-content: flex-end;
        }
        .skill-pct {
          font-family: var(--font-mono);
          font-size: 10px;
          color: #52527a;
          text-transform: uppercase;
        }
      `}</style>
    </div>
  );
}
