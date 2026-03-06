// src/app/layout.tsx
import React from "react";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Job Radar — Frontend Roles at Visa-Sponsoring Companies",
  description:
    "A personal job aggregator scraping career pages of companies known to sponsor visas. Direct. No aggregators.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
