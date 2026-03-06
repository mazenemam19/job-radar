// src/app/market/components/StatCard.tsx
"use client";

import React from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  color?: string;
}

export default function StatCard({ label, value, subtitle, color = "#fff" }: StatCardProps) {
  return (
    <div className="market-card stat-card">
      <div className="stat-content">
        <p className="stat-label">{label}</p>
        <h3 className="stat-value" style={{ color }}>
          {value}
        </h3>
      </div>
      {subtitle && <p className="stat-subtitle">{subtitle}</p>}

      <style jsx>{`
        .market-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 24px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        }
        .stat-label {
          color: var(--text-muted);
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.2em;
          font-weight: 700;
          font-family: var(--font-mono);
          margin-bottom: 8px;
        }
        .stat-value {
          font-family: var(--font-display);
          font-size: 32px;
          font-weight: 800;
          letter-spacing: -0.02em;
          line-height: 1;
        }
        .stat-subtitle {
          color: var(--text-dim);
          font-size: 10px;
          text-transform: uppercase;
          font-family: var(--font-mono);
          margin-top: 16px;
          padding-top: 12px;
          border-top: 1px solid var(--border);
          letter-spacing: 0.05em;
        }
      `}</style>
    </div>
  );
}
