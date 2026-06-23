// src/lib/constants.ts

import type { ATSType, TrackerStatus } from "./types";

// ── Shared Constants ─────────────────────────────────────────────────────

export const VALID_ATS: ATSType[] = [
  "greenhouse",
  "lever",
  "ashby",
  "workable",
  "teamtailor",
  "breezy",
  "smartrecruiters",
  "bamboohr",
  "jazzhr",
];

export const VALID_STATUSES: TrackerStatus[] = [
  "applied",
  "interviewing",
  "offer",
  "rejected",
  "ghosted",
  "saved",
];
export const COUNTRY_MAP: Record<string, { name: string; flag: string }> = {
  ireland: { name: "Ireland", flag: "🇮🇪" },
  germany: { name: "Germany", flag: "🇩🇪" },
  netherlands: { name: "Netherlands", flag: "🇳🇱" },
  "united kingdom": { name: "UK", flag: "🇬🇧" },
  uk: { name: "UK", flag: "🇬🇧" },
  london: { name: "UK", flag: "🇬🇧" },
  berlin: { name: "Germany", flag: "🇩🇪" },
  amsterdam: { name: "Netherlands", flag: "🇳🇱" },
  dublin: { name: "Ireland", flag: "🇮🇪" },
  spain: { name: "Spain", flag: "🇪🇸" },
  barcelona: { name: "Spain", flag: "🇪🇸" },
  madrid: { name: "Spain", flag: "🇪🇸" },
  portugal: { name: "Portugal", flag: "🇵🇹" },
  lisbon: { name: "Portugal", flag: "🇵🇹" },
  france: { name: "France", flag: "🇫🇷" },
  paris: { name: "France", flag: "🇫🇷" },
  sweden: { name: "Sweden", flag: "🇸🇪" },
  stockholm: { name: "Sweden", flag: "🇸🇪" },
  denmark: { name: "Denmark", flag: "🇩🇰" },
  copenhagen: { name: "Denmark", flag: "🇩🇰" },
  finland: { name: "Finland", flag: "🇫🇮" },
  helsinki: { name: "Finland", flag: "🇫🇮" },
  poland: { name: "Poland", flag: "🇵🇱" },
  warsaw: { name: "Poland", flag: "🇵🇱" },
  usa: { name: "USA", flag: "🇺🇸" },
  "united states": { name: "USA", flag: "🇺🇸" },
  egypt: { name: "Egypt", flag: "🇪🇬" },
  cairo: { name: "Egypt", flag: "🇪🇬" },
  "saudi arabia": { name: "Saudi Arabia", flag: "🇸🇦" },
  "united arab emirates": { name: "UAE", flag: "🇦🇪" },
  uae: { name: "UAE", flag: "🇦🇪" },
  dubai: { name: "UAE", flag: "🇦🇪" },
  riyadh: { name: "Saudi Arabia", flag: "🇸🇦" },
  remote: { name: "Remote", flag: "🌍" },
};

export const MODE_COLORS: Record<string, string> = {
  visa: "#6366f1",
  local: "#22c55e",
  global: "#f59e0b",
};

export const MODE_LABELS: Record<string, string> = {
  visa: "✈️ Visa",
  local: "🇪🇬 Local",
  global: "🌐 Remote",
};
