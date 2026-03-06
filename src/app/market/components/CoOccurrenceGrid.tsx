// src/app/market/components/CoOccurrenceGrid.tsx
"use client";

import React from "react";

interface CoOccur {
  skillA: string;
  skillB: string;
  count: number;
}

export default function CoOccurrenceGrid({ data }: { data: CoOccur[]; allSkills: string[] }) {
  const topSkillsSet = new Set<string>();
  data.slice(0, 50).forEach((d) => {
    if (topSkillsSet.size < 10) {
      topSkillsSet.add(d.skillA);
      topSkillsSet.add(d.skillB);
    }
  });
  const topSkills = Array.from(topSkillsSet).sort().slice(0, 10);

  const getCount = (sA: string, sB: string) => {
    if (sA === sB) return "-";
    const match = data.find(
      (d) => (d.skillA === sA && d.skillB === sB) || (d.skillA === sB && d.skillB === sA),
    );
    return match ? match.count : 0;
  };

  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="market-card grid-section">
      <h2 className="section-title">
        <span className="icon">🕸️</span>
        Skill Co-occurrence Matrix
      </h2>

      <div className="scroll-container">
        <div className="matrix-wrapper">
          <div className="matrix-grid">
            {/* Header Spacer */}
            <div className="cell spacer" />

            {/* Column Headers */}
            {topSkills.map((s) => (
              <div key={s} className="cell header-col">
                {s}
              </div>
            ))}

            {/* Rows */}
            {topSkills.map((sA) => (
              <React.Fragment key={sA}>
                <div className="cell header-row">{sA}</div>
                {topSkills.map((sB) => {
                  const count = getCount(sA, sB);
                  const intensity = typeof count === "number" ? count / maxCount : 0;

                  return (
                    <div
                      key={`${sA}-${sB}`}
                      className="cell data-cell"
                      style={{
                        backgroundColor:
                          count === "-"
                            ? "rgba(255,255,255,0.02)"
                            : `rgba(99, 102, 241, ${intensity * 0.8 + 0.05})`,
                      }}
                    >
                      {typeof count === "number" && count > 0 && (
                        <span className="count-val" style={{ opacity: intensity > 0.3 ? 1 : 0.4 }}>
                          {count}
                        </span>
                      )}

                      {typeof count === "number" && count > 0 && (
                        <div className="tooltip">{count} SHARED JOBS</div>
                      )}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
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
        .scroll-container {
          overflow-x: auto;
          margin: 0 -10px;
          padding: 0 10px 20px;
        }
        .matrix-wrapper {
          min-width: 640px;
        }
        .matrix-grid {
          display: grid;
          grid-template-columns: 100px repeat(10, 1fr);
          gap: 2px;
        }
        .cell {
          aspect-ratio: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }
        .spacer {
          aspect-ratio: auto;
          height: 40px;
        }
        .header-col {
          aspect-ratio: auto;
          height: 40px;
          font-size: 8px;
          font-family: var(--font-mono);
          font-weight: 900;
          color: var(--text-dim);
          text-transform: uppercase;
          text-align: center;
          padding: 0 4px;
          letter-spacing: -0.02em;
        }
        .header-row {
          aspect-ratio: auto;
          height: auto;
          font-size: 8px;
          font-family: var(--font-mono);
          font-weight: 900;
          color: var(--text-dim);
          text-transform: uppercase;
          justify-content: flex-end;
          padding-right: 12px;
          letter-spacing: -0.02em;
        }
        .data-cell {
          border-radius: 2px;
          border: 1px solid rgba(255, 255, 255, 0.02);
          transition: all 0.2s;
          cursor: crosshair;
        }
        .data-cell:hover {
          transform: scale(1.1);
          z-index: 10;
          border-color: rgba(255, 255, 255, 0.2);
          box-shadow: 0 0 20px rgba(99, 102, 241, 0.4);
        }
        .count-val {
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 800;
          color: #fff;
        }
        .tooltip {
          position: absolute;
          bottom: 100%;
          left: 50%;
          transform: translateX(-50%);
          margin-bottom: 8px;
          background: #000;
          color: #fff;
          font-family: var(--font-mono);
          font-size: 9px;
          font-weight: 900;
          padding: 4px 8px;
          border-radius: 3px;
          border: 1px solid var(--border-hi);
          white-space: nowrap;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.2s;
          z-index: 100;
          letter-spacing: 0.05em;
          box-shadow: 0 10px 20px rgba(0, 0, 0, 0.5);
        }
        .data-cell:hover .tooltip {
          opacity: 1;
        }
      `}</style>
    </div>
  );
}
