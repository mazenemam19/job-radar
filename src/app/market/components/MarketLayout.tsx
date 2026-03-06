// src/app/market/components/MarketLayout.tsx
"use client";

import React from "react";
import StatCard from "./StatCard";
import SkillBars from "./SkillBars";
import SkillGaps from "./SkillGaps";
import PipelineStat from "./PipelineStat";
import CoOccurrenceGrid from "./CoOccurrenceGrid";
import InsightsPanel from "./InsightsPanel";
import { MarketAnalysis } from "@/lib/market";

export default function MarketLayout({ data }: { data: MarketAnalysis }) {
  const allSkills = data.skillFrequency.map((s) => s.skill);

  return (
    <div className="market-container">
      {/* Header Section */}
      <header className="market-header">
        <h1 className="page-title">Market Intelligence</h1>
        <div className="meta-strip">
          <span className="meta-item">Analyzing {data.meta.totalJobs} Raw Signals</span>
          <span className="divider" />
          <span className="meta-item">
            Generated {new Date(data.meta.generatedAt).toLocaleDateString()}
          </span>
        </div>
      </header>

      {/* Hero stats */}
      <section className="hero-grid">
        <StatCard label="Database" value={data.meta.totalJobs} subtitle="Raw Signals" />
        <StatCard
          label="Fit Rate"
          value={data.meta.jobsPassingFilter}
          subtitle="Personal Match"
          color="var(--green)"
        />
        <StatCard
          label="Noise Rate"
          value={`${data.meta.filterRate}%`}
          subtitle="Filtered Out"
          color="var(--amber)"
        />
        <StatCard
          label="Tech Stack"
          value={data.meta.uniqueSkillsFound}
          subtitle="Unique Tools"
          color="var(--accent-h)"
        />
      </section>

      {/* Demand vs Gaps */}
      <section className="split-grid">
        <div className="demand-card market-card">
          <div className="card-header">
            <h2 className="card-title">Your Skills Market Demand</h2>
            <span className="card-badge">Profile Strengths</span>
          </div>
          <div className="demand-grid">
            {data.yourSkillsMarketDemand.slice(0, 10).map((skill) => (
              <div key={skill.skill} className="skill-box">
                <div className="box-top">
                  <span className="skill-label">{skill.skill}</span>
                  <span className={`strength-pill ${skill.marketStrength}`}>
                    {skill.marketStrength}
                  </span>
                </div>
                <div className="box-bottom">
                  <span className="skill-pct">{skill.percentage}%</span>
                  <span className="box-lbl">Demand</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <SkillGaps data={data.marketSkillGaps} />
      </section>

      {/* Frequencies */}
      <section className="full-width">
        <SkillBars data={data.skillFrequency} />
      </section>

      {/* Co-occurrence */}
      <section className="full-width">
        <CoOccurrenceGrid data={data.coOccurrence} allSkills={allSkills} />
      </section>

      {/* Pipelines */}
      <section className="pipeline-grid">
        <PipelineStat pipeline="visa" data={data.pipelineBreakdown.visa} />
        <PipelineStat pipeline="local" data={data.pipelineBreakdown.local} />
        <PipelineStat pipeline="global" data={data.pipelineBreakdown.global} />
      </section>

      {/* Seniority & Score */}
      <section className="split-grid">
        <div className="market-card">
          <h2 className="card-title mb-32">Seniority Distribution</h2>
          <div className="seniority-list">
            {data.seniorityBreakdown.map((level) => (
              <div key={level.level} className="senior-item">
                <div className="senior-meta">
                  <span className="senior-label">{level.level}</span>
                  <span className="senior-count">{level.count} JOBS</span>
                </div>
                <div className="senior-track">
                  <div
                    className="senior-fill"
                    style={{ width: `${(level.count / data.meta.totalJobs) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="market-card">
          <h2 className="card-title mb-32">Match Score Distribution</h2>
          <div className="score-chart">
            {data.scoreDistribution.map((bucket) => {
              const maxCount = Math.max(...data.scoreDistribution.map((b) => b.count));
              const height = maxCount > 0 ? (bucket.count / maxCount) * 100 : 0;
              return (
                <div key={bucket.bucket} className="chart-col">
                  <div className="col-bar-wrapper">
                    <div className="col-bar" style={{ height: `${height}%` }} />
                    <span className="col-val">{bucket.count}</span>
                  </div>
                  <span className="col-lbl">{bucket.bucket}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Companies & Workplace */}
      <section className="split-grid-70-30">
        <div className="market-card">
          <h2 className="card-title mb-32">Hiring Powerhouses</h2>
          <div className="cos-grid">
            {data.topCompanies.map((company, i) => (
              <div key={i} className="co-row">
                <div className="co-identity">
                  <span className="co-rank">{String(i + 1).padStart(2, "0")}</span>
                  <span className="co-name">{company.company}</span>
                </div>
                <div className="co-meta">
                  <span className="co-pipeline">{company.pipeline}</span>
                  <span className="co-count">{company.count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="market-card flex-col">
          <h2 className="card-title mb-32">Workplace Trends</h2>
          <div className="workplace-list">
            {[
              { label: "Remote", count: data.remoteSignals.remote, color: "var(--green)" },
              { label: "Hybrid", count: data.remoteSignals.hybrid, color: "#3b82f6" },
              { label: "On-Site", count: data.remoteSignals.onSite, color: "#f43f5e" },
              { label: "Relocation", count: data.remoteSignals.relocation, color: "#a855f7" },
            ].map((sig) => (
              <div key={sig.label} className="work-item">
                <div
                  className="work-dot"
                  style={{ background: sig.color, boxShadow: `0 0 10px ${sig.color}` }}
                />
                <div className="work-content">
                  <div className="work-meta">
                    <span>{sig.label}</span>
                    <span className="work-val">{sig.count}</span>
                  </div>
                  <div className="work-track">
                    <div
                      className="work-fill"
                      style={{
                        width: `${(sig.count / data.meta.totalJobs) * 100}%`,
                        background: sig.color,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Insights */}
      <InsightsPanel insights={data.insights} />

      <style jsx>{`
        .market-container {
          padding-top: 40px;
        }
        .market-header {
          padding: 40px 0;
          border-bottom: 1px solid var(--border);
          margin-bottom: 48px;
        }
        .page-title {
          font-family: var(--font-display);
          font-size: 42px;
          font-weight: 800;
          color: #fff;
          letter-spacing: -0.02em;
          text-transform: uppercase;
          line-height: 1;
          margin-bottom: 12px;
        }
        .meta-strip {
          display: flex;
          align-items: center;
          gap: 16px;
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.2em;
          font-weight: 700;
        }
        .divider {
          width: 4px;
          height: 4px;
          background: var(--text-dim);
          border-radius: 50%;
        }
        .hero-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
          margin-bottom: 48px;
        }
        .split-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          margin-bottom: 48px;
        }
        .split-grid-70-30 {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 24px;
          margin-bottom: 48px;
        }
        .full-width {
          margin-bottom: 48px;
        }
        .pipeline-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
          margin-bottom: 48px;
        }
        .market-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 32px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4);
        }
        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 32px;
          padding-bottom: 16px;
          border-bottom: 1px solid var(--border);
        }
        .card-title {
          font-family: var(--font-display);
          font-size: 18px;
          font-weight: 800;
          color: #fff;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .mb-32 {
          margin-bottom: 32px;
        }
        .card-badge {
          font-family: var(--font-mono);
          font-size: 9px;
          color: var(--accent-h);
          background: rgba(99, 102, 241, 0.05);
          padding: 4px 10px;
          border-radius: 4px;
          border: 1px solid rgba(99, 102, 241, 0.2);
          font-weight: 900;
          text-transform: uppercase;
        }
        .demand-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .skill-box {
          background: var(--bg-2);
          border: 1px solid var(--border);
          padding: 20px;
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          height: 110px;
          transition: border-color 0.3s;
        }
        .skill-box:hover {
          border-color: rgba(74, 222, 128, 0.2);
        }
        .box-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }
        .skill-label {
          font-weight: 800;
          color: #fff;
          font-size: 13px;
          text-transform: uppercase;
        }
        .strength-pill {
          font-size: 8px;
          font-weight: 900;
          text-transform: uppercase;
          padding: 2px 6px;
          border-radius: 4px;
        }
        .strength-pill.strong {
          color: var(--green);
          background: rgba(74, 222, 128, 0.1);
        }
        .strength-pill.moderate {
          color: #3b82f6;
          background: rgba(59, 130, 246, 0.1);
        }
        .strength-pill.weak {
          color: var(--text-dim);
          background: rgba(255, 255, 255, 0.02);
        }
        .box-bottom {
          display: flex;
          align-items: baseline;
          gap: 8px;
        }
        .skill-pct {
          font-family: var(--font-mono);
          font-size: 24px;
          font-weight: 800;
          color: #fff;
        }
        .box-lbl {
          font-family: var(--font-mono);
          font-size: 9px;
          color: var(--text-dim);
          font-weight: 700;
          text-transform: uppercase;
        }

        .seniority-list {
          display: flex;
          flex-direction: column;
          gap: 32px;
        }
        .senior-item {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .senior-meta {
          display: flex;
          justify-content: space-between;
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 800;
        }
        .senior-label {
          color: var(--text-muted);
        }
        .senior-count {
          color: #fff;
        }
        .senior-track {
          height: 2px;
          background: var(--bg-2);
          border-radius: 2px;
        }
        .senior-fill {
          height: 100%;
          background: var(--accent);
          border-radius: 2px;
          box-shadow: 0 0 10px var(--accent);
          transition: width 1s;
        }

        .score-chart {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 8px;
          height: 180px;
          padding-bottom: 20px;
          border-bottom: 1px solid var(--border);
        }
        .chart-col {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          height: 100%;
        }
        .col-bar-wrapper {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          align-items: center;
          position: relative;
        }
        .col-bar {
          width: 100%;
          background: var(--accent);
          opacity: 0.3;
          border-radius: 2px 2px 0 0;
          transition: all 0.5s;
          cursor: pointer;
        }
        .chart-col:hover .col-bar {
          opacity: 0.6;
          transform: scaleX(1.05);
        }
        .col-val {
          position: absolute;
          top: -24px;
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 800;
          color: var(--accent-h);
          opacity: 0;
          transition: opacity 0.3s;
        }
        .chart-col:hover .col-val {
          opacity: 1;
        }
        .col-lbl {
          font-family: var(--font-mono);
          font-size: 9px;
          color: var(--text-dim);
          font-weight: 900;
          transform: rotate(-45deg);
          white-space: nowrap;
          margin-top: 8px;
        }

        .cos-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px 48px;
        }
        .co-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.02);
        }
        .co-identity {
          display: flex;
          align-items: center;
          gap: 12px;
          overflow: hidden;
        }
        .co-rank {
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--text-dim);
          font-weight: 900;
        }
        .co-name {
          color: var(--text);
          font-weight: 700;
          font-size: 13px;
          text-transform: uppercase;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .co-meta {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .co-pipeline {
          font-family: var(--font-mono);
          font-size: 8px;
          color: var(--text-muted);
          font-weight: 900;
          text-transform: uppercase;
          padding: 2px 6px;
          border: 1px solid var(--border);
          border-radius: 4px;
        }
        .co-count {
          font-family: var(--font-mono);
          font-size: 13px;
          color: var(--accent-h);
          font-weight: 800;
          width: 24px;
          text-align: right;
        }

        .workplace-list {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        .work-item {
          display: flex;
          gap: 16px;
          align-items: center;
        }
        .work-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .work-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .work-meta {
          display: flex;
          justify-content: space-between;
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
          color: var(--text-muted);
        }
        .work-val {
          color: #fff;
        }
        .work-track {
          height: 2px;
          background: var(--bg-2);
          border-radius: 2px;
        }
        .work-fill {
          height: 100%;
          border-radius: 2px;
          opacity: 0.6;
          transition: width 1s;
        }

        @media (max-width: 1024px) {
          .hero-grid {
            grid-template-columns: 1fr 1fr;
          }
          .split-grid,
          .split-grid-70-30 {
            grid-template-columns: 1fr;
          }
          .pipeline-grid {
            grid-template-columns: 1fr;
          }
          .cos-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
