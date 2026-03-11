// src/app/market/page.tsx
import React from "react";
import { computeMarketAnalysis } from "@/lib/market";
import AppHeader from "@/components/AppHeader";
import { readStore } from "@/lib/storage";
import MarketLayout from "./components/MarketLayout";

export const dynamic = "force-dynamic";

export default async function MarketPage() {
  const data = await computeMarketAnalysis();
  const store = await readStore();

  if (!data || data.meta.totalJobs === 0) {
    return (
      <div className="app-shell">
        <AppHeader lastUpdated={store?.lastUpdated} />
        <main className="dashboard-content">
          <div className="empty-state">
            <span className="empty-icon">📭</span>
            <p className="empty-title text-white">No Market Data Available</p>
            <p className="empty-sub text-slate-500">
              Run a scan from the main dashboard to generate market intelligence.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <AppHeader lastUpdated={store?.lastUpdated} />
      <div className="dashboard-content">
        <MarketLayout data={data} />
      </div>
    </div>
  );
}
