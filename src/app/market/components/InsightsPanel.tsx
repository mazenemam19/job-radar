// src/app/market/components/InsightsPanel.tsx
"use client";

import React from "react";

export default function InsightsPanel({ insights }: { insights: string[] }) {
  // Helper to parse **bold** text and turn it into styled spans
  const parseMarkdown = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <span key={i} className="skill-highlight">
            {part.slice(2, -2)}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div className="market-insights">
      <h2 className="section-title">
        <span className="icon">✦</span>
        Market Intelligence Briefing
      </h2>

      <div className="insights-grid">
        {insights.map((insight, i) => (
          <div key={i} className="insight-card">
            <span className="bullet">✦</span>
            <p className="insight-text">{parseMarkdown(insight)}</p>
          </div>
        ))}
      </div>

      <style jsx>{`
        .market-insights {
          margin-bottom: 80px;
        }
        .section-title {
          font-family: var(--font-display);
          font-size: 18px;
          font-weight: 800;
          color: #fff;
          margin-bottom: 24px;
          display: flex;
          align-items: center;
          gap: 12px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }
        .icon {
          color: var(--accent);
        }
        .insights-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
          gap: 16px;
        }
        .insight-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 24px;
          display: flex;
          gap: 16px;
          align-items: flex-start;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
          transition: border-color 0.3s;
        }
        .insight-card:hover {
          border-color: var(--border-hi);
        }
        .bullet {
          color: var(--accent);
          font-size: 18px;
          margin-top: -2px;
        }
        .insight-text {
          color: var(--text);
          font-size: 14px;
          line-height: 1.6;
          font-weight: 500;
        }
        :global(.skill-highlight) {
          color: var(--accent-h);
          font-weight: 800;
        }
        @media (max-width: 600px) {
          .insights-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
