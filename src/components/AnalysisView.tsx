// src/components/AnalysisView.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import type { JobStore } from "@/lib/types";
import AppHeader from "./AppHeader";
import SourceHealthDashboard from "./SourceHealthDashboard";

export default function AnalysisView({ cronSecret }: { cronSecret?: string }) {
  const [store, setStore] = useState<JobStore | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/jobs");
      setStore((await res.json()) as JobStore);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="app-shell">
      <AppHeader lastUpdated={store?.lastUpdated} onRefresh={loadData} cronSecret={cronSecret} />

      <main className="analysis-page mt-12 mb-24">
        {loading ? (
          <div className="loading-state">Initializing diagnostics...</div>
        ) : !store?.cronLogs || store.cronLogs.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">📊</span>
            <p>No log data synchronized. Execute a scan to populate engine metrics.</p>
          </div>
        ) : (
          <SourceHealthDashboard logs={store.cronLogs} alwaysOpen={true} />
        )}
      </main>

      <style jsx>{`
        .loading-state {
          padding: 100px 0;
          text-align: center;
          font-family: var(--font-mono);
          color: var(--text-muted);
        }
        .empty-state {
          padding: 100px 24px;
          text-align: center;
          color: var(--text-muted);
        }
        .empty-icon {
          display: block;
          font-size: 52px;
          margin-bottom: 18px;
          opacity: 0.2;
        }
      `}</style>
    </div>
  );
}
