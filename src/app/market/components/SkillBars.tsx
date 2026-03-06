// src/app/market/components/SkillBars.tsx
"use client";

import React, { useEffect, useState } from "react";
import { CATEGORY_COLORS } from "@/lib/constants";
import { SkillFrequency } from "@/types";

export default function SkillBars({ data }: { data: SkillFrequency[] }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 150);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="market-card skill-bars-section">
      <h2 className="section-title">
        <span className="icon">📊</span>
        Market Skill Frequency (Top 30)
      </h2>

      <div className="bars-list">
        {data.slice(0, 30).map((item) => (
          <div key={item.skill} className="bar-item">
            <div className="bar-info">
              <div className="skill-identity">
                <span className={`dot ${item.inYourSkillSet ? "active" : ""}`} />
                <span className="skill-name">{item.skill}</span>
                <span className="category-tag">{item.category}</span>
              </div>
              <div className="skill-metrics">
                <span className="count">{item.count}</span>
                <span className="pct">{item.percentage}%</span>
              </div>
            </div>
            <div className="track">
              <div
                className="fill"
                style={{
                  width: mounted ? `${item.percentage}%` : "0%",
                  background: CATEGORY_COLORS[item.category] || "#64748b",
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .market-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 32px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4);
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
        .bars-list {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .bar-item {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .bar-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .skill-identity {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--text-dim);
        }
        .dot.active {
          background: var(--green);
          box-shadow: 0 0 10px var(--green);
        }
        .skill-name {
          color: #fff;
          font-weight: 700;
          font-size: 14px;
          letter-spacing: -0.01em;
        }
        .category-tag {
          font-size: 9px;
          text-transform: uppercase;
          font-family: var(--font-mono);
          color: var(--text-muted);
          background: rgba(255, 255, 255, 0.03);
          padding: 2px 6px;
          border-radius: 4px;
          border: 1px solid var(--border);
          font-weight: 700;
        }
        .skill-metrics {
          font-family: var(--font-mono);
          display: flex;
          gap: 12px;
          align-items: baseline;
        }
        .count {
          color: #fff;
          font-weight: 700;
          font-size: 13px;
        }
        .pct {
          color: var(--text-dim);
          font-size: 10px;
        }
        .track {
          height: 4px;
          background: var(--bg-2);
          border-radius: 4px;
          overflow: hidden;
          border: 1px solid var(--border);
        }
        .fill {
          height: 100%;
          border-radius: 4px;
          transition: width 1.2s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
      `}</style>
    </div>
  );
}
