// src/app/layout.tsx
import React from "react";
import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Job Radar",
  description:
    "A personal job aggregator scraping career pages of companies known to sponsor visas. Direct. No aggregators.",
};

// favicon.ico, icon.png, apple-icon.png, and manifest.ts are all picked up
// automatically by Next's file-convention metadata — nothing to wire up
// here for those. themeColor lives in `viewport`, not `metadata`, per
// Next 14's split (an old `metadata.themeColor` still type-checks but is
// deprecated). Matches --bg in globals.css — the same background color
// the app, the email templates, and the icon's own flatten background all
// already use.
export const viewport: Viewport = {
  themeColor: "#08080f",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
