// src/app/market/components/SkillGaps.tsx
"use client";

import React, { useEffect, useState } from "react";

interface SkillGap {
  skill: string;
  category: string;
  count: number;
  percentage: number;
  trending: boolean;
}

export default function SkillGaps({ data }: { data: SkillGap[] }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="market-card skill-gaps-section">
      <div className="header">
        <h2 className="section-title">
          <span className="icon">⚠️</span>
          Market Skill Gaps
        </h2>
        <span className="badge">Gap Analysis</span>
      </div>

      <div className="gaps-list">
        {data.slice(0, 10).map((item) => (
          <div key={item.skill} className="gap-item">
            <div className="gap-info">
              <div className="gap-identity">
                <span className="skill-name">{item.skill}</span>
                <span className="category-tag">{item.category}</span>
                {item.trending && <span className="trending-tag">Trending</span>}
              </div>
              <span className="percentage">{item.percentage}%</span>
            </div>
            <div className="track">
              <div className="fill" style={{ width: mounted ? `${item.percentage}%` : "0%" }} />
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
          height: 100%;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 32px;
          padding-bottom: 16px;
          border-bottom: 1px solid var(--border);
        }
        .section-title {
          font-family: var(--font-display);
          font-size: 18px;
          font-weight: 800;
          color: #fff;
          display: flex;
          align-items: center;
          gap: 12px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .badge {
          font-family: var(--font-mono);
          font-size: 9px;
          text-transform: uppercase;
          color: var(--amber);
          background: rgba(251, 191, 36, 0.05);
          padding: 4px 10px;
          border-radius: 4px;
          border: 1px solid rgba(251, 191, 36, 0.2);
          font-weight: 900;
          letter-spacing: 0.1em;
        }
        .gaps-list {
          display: flex;
          flex-direction: column;
          gap: 28px;
        }
        .gap-item {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .gap-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .gap-identity {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .skill-name {
          color: #fff;
          font-weight: 800;
          font-size: 14px;
          letter-spacing: -0.01em;
        }
        .category-tag {
          font-size: 8px;
          text-transform: uppercase;
          font-family: var(--font-mono);
          color: var(--text-dim);
          font-weight: 700;
        }
        .trending-tag {
          font-size: 8px;
          font-family: var(--font-mono);
          background: var(--amber);
          color: #000;
          padding: 1px 5px;
          border-radius: 3px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .percentage {
          font-family: var(--font-mono);
          color: var(--amber);
          font-weight: 800;
          font-size: 13px;
        }
        .track {
          height: 2px;
          background: var(--bg-2);
          border-radius: 2px;
          overflow: hidden;
        }
        .fill {
          height: 100%;
          background: linear-gradient(90deg, #f59e0b, #ff7f50);
          border-radius: 2px;
          transition: width 1.5s cubic-bezier(0.34, 1.56, 0.64, 1);
          box-shadow: 0 0 10px rgba(255, 127, 80, 0.4);
        }
      `}</style>
    </div>
  );
}
