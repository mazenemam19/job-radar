// src/app/market/components/MarketLayout.tsx
"use client";

import React from "react";
import StatCard from "./StatCard";
import SkillBars from "./SkillBars";
import SkillGaps from "./SkillGaps";
import InsightsPanel from "./InsightsPanel";
import CoOccurrenceGrid from "./CoOccurrenceGrid";
import PipelineStat from "./PipelineStat";
import { MarketAnalysis } from "@/types";
import { CATEGORY_COLORS } from "@/lib/constants";

export default function MarketLayout({ data }: { data: MarketAnalysis }) {
  const categories = Array.from(new Set(Object.values(data.skillFrequency).map((s) => s.category)));

  return (
    <div className="market-container">
      <header className="market-header">
        <div className="title-block">
          <h1 className="main-title">Market Intelligence</h1>
          <div className="meta-strip">
            <span className="timestamp">Updated: {new Date(data.meta.generatedAt).toLocaleString()}</span>
            <span className="divider">|</span>
            <span className="source-count">Analyzing {data.meta.totalJobs} raw job listings</span>
          </div>
        </div>
        <div className="filter-stat">
          <div className="stat-label">Tech Gate Strength</div>
          <div className="stat-value-wrap">
            <span className="stat-value">{data.meta.filterRate}%</span>
            <div className="mini-track">
              <div className="mini-fill" style={{ width: `${data.meta.filterRate}%` }} />
            </div>
          </div>
        </div>
      </header>

      <div className="market-grid">
        {/* Row 1: High Level Stats */}
        <div className="stats-row">
          <StatCard 
            label="Qualified Match Rate" 
            value={`${100 - data.meta.filterRate}%`} 
            subtitle={`${data.meta.jobsPassingFilter} jobs passed all filters`}
            color="#4ade80"
          />
          <StatCard 
            label="Tech Ecosystem Breadth" 
            value={data.meta.uniqueSkillsFound} 
            subtitle="Distinct technologies identified"
            color="#6366f1"
          />
          <StatCard 
            label="Seniority Distribution" 
            value={data.seniorityBreakdown.find(s => s.level === 'Senior')?.count || 0} 
            subtitle="Senior-level roles found"
            color="#f59e0b"
          />
          <StatCard 
            label="Remote Density" 
            value={`${Math.round((data.remoteSignals.remote / data.meta.totalJobs) * 100)}%`} 
            subtitle="Explicitly remote-friendly"
            color="#0ea5e9"
          />
        </div>

        {/* Row 2: Deep Analysis */}
        <div className="analysis-grid">
          <div className="primary-column">
            <SkillBars data={data.skillFrequency} />
            <CoOccurrenceGrid data={data.coOccurrence} />
          </div>

          <div className="secondary-column">
            <InsightsPanel insights={data.insights} />
            
            <div className="market-card category-legend">
              <h3 className="legend-title">Category Map</h3>
              <div className="legend-grid">
                {categories.map(cat => (
                  <div key={cat} className="legend-item">
                    <span className="color-dot" style={{ background: CATEGORY_COLORS[cat] || '#64748b' }} />
                    <span className="cat-name">{cat}</span>
                  </div>
                ))}
              </div>
            </div>

            <SkillGaps data={data.marketSkillGaps} />
            
            <div className="pipeline-section">
              <PipelineStat label="Visa Hubs" total={data.pipelineBreakdown.visa.total} skills={data.pipelineBreakdown.visa.topSkills} />
              <PipelineStat label="Local (Egypt)" total={data.pipelineBreakdown.local.total} skills={data.pipelineBreakdown.local.topSkills} />
              <PipelineStat label="Global Remote" total={data.pipelineBreakdown.global.total} skills={data.pipelineBreakdown.global.topSkills} />
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .market-container {
          min-height: 100vh;
          background: #08080f;
          color: #dde1f0;
          padding: 40px;
          font-family: var(--font-body);
        }
        .market-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-bottom: 48px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          padding-bottom: 24px;
        }
        .main-title {
          font-family: var(--font-display);
          font-size: 42px;
          font-weight: 800;
          letter-spacing: -0.03em;
          color: #fff;
          margin-bottom: 8px;
        }
        .meta-strip {
          display: flex;
          gap: 12px;
          font-family: var(--font-mono);
          font-size: 11px;
          color: #a1a1c2;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }
        .divider { opacity: 0.2; }
        
        .filter-stat {
          text-align: right;
          min-width: 200px;
        }
        .stat-label {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.2em;
          color: #7171a3;
          margin-bottom: 8px;
          font-weight: 700;
        }
        .stat-value-wrap {
          display: flex;
          align-items: center;
          gap: 12px;
          justify-content: flex-end;
        }
        .stat-value {
          font-family: var(--font-mono);
          font-size: 24px;
          font-weight: 700;
          color: #fff;
        }
        .mini-track {
          width: 80px;
          height: 4px;
          background: rgba(255,255,255,0.05);
          border-radius: 2px;
          overflow: hidden;
        }
        .mini-fill {
          height: 100%;
          background: linear-gradient(90deg, #6366f1, #a855f7);
        }

        .market-grid {
          display: flex;
          flex-direction: column;
          gap: 32px;
        }
        .stats-row {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 24px;
        }
        .analysis-grid {
          display: grid;
          grid-template-columns: 1fr 380px;
          gap: 32px;
          align-items: start;
        }
        .primary-column {
          display: flex;
          flex-direction: column;
          gap: 32px;
        }
        .secondary-column {
          display: flex;
          flex-direction: column;
          gap: 32px;
        }

        .market-card {
          background: #0f0f1c;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px;
          padding: 24px;
        }
        .legend-title {
          font-family: var(--font-display);
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-bottom: 20px;
          color: #fff;
        }
        .legend-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .legend-item {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .color-dot {
          width: 8px;
          height: 8px;
          border-radius: 2px;
        }
        .cat-name {
          font-size: 10px;
          text-transform: uppercase;
          font-family: var(--font-mono);
          color: #a1a1c2;
        }

        .pipeline-section {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        @media (max-width: 1200px) {
          .analysis-grid {
            grid-template-columns: 1fr;
          }
          .secondary-column {
            order: -1;
          }
        }
        @media (max-width: 900px) {
          .stats-row {
            grid-template-columns: 1fr 1fr;
          }
        }
        @media (max-width: 600px) {
          .stats-row {
            grid-template-columns: 1fr;
          }
          .market-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 24px;
          }
        }
      `}</style>
    </div>
  );
}
