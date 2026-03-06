// src/components/AppHeader.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { AppHeaderProps } from "@/lib/types";

function relativeTime(iso: string): string {
  const s = Math.floor((Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function AppHeader({ lastUpdated, onRefresh, cronSecret }: AppHeaderProps) {
  const pathname = usePathname();
  const [running, setRunning] = useState(false);
  const [runStatus, setRunStatus] = useState<"idle" | "ok" | "err">("idle");

  const runScan = async () => {
    if (running) return;
    setRunning(true);
    setRunStatus("idle");
    try {
      const headers: Record<string, string> = {};
      if (cronSecret) headers["x-cron-secret"] = cronSecret;

      const res = await fetch("/api/cron", { method: "POST", headers });
      setRunStatus(res.ok ? "ok" : "err");
      if (res.ok && onRefresh) await onRefresh();
    } catch {
      setRunStatus("err");
    } finally {
      setRunning(false);
      setTimeout(() => setRunStatus("idle"), 4000);
    }
  };

  return (
    <header className="app-header">
      <div className="header-inner">
        <div className="brand">
          <div className="radar-dot">
            <span className="radar-pulse" />
          </div>
          <div>
            <h1 className="brand-title">JOB RADAR</h1>
            <p className="brand-sub">
              Frontend roles · Direct from company career pages · No aggregators
            </p>
          </div>
        </div>
        <div className="header-actions">
          {lastUpdated && <span className="last-updated">Updated {relativeTime(lastUpdated)}</span>}
          {runStatus === "ok" && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--green)" }}>
              ✓ Done
            </span>
          )}
          {runStatus === "err" && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#f87171" }}>
              ✗ Error
            </span>
          )}
          <button
            className={`btn-run ${running ? "running" : ""}`}
            onClick={runScan}
            disabled={running}
          >
            <span className="run-icon">⟳</span>
            {running ? "Scanning…" : "Run Scan"}
          </button>
        </div>
      </div>

      <nav className="view-switcher">
        <Link href="/" className={`view-tab ${pathname === "/" ? "active" : ""}`}>
          <span className="tab-icon">📋</span>
          Jobs
        </Link>
        <Link href="/analysis" className={`view-tab ${pathname === "/analysis" ? "active" : ""}`}>
          <span className="tab-icon">📈</span>
          Source Health
        </Link>
        <Link href="/market" className={`view-tab ${pathname === "/market" ? "active" : ""}`}>
          <span className="tab-icon">📊</span>
          Market
        </Link>
      </nav>
    </header>
  );
}
