// src/lib/constants.ts

import type { ATSType, JobMode, TrackerStatus } from "./types";

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
  // Added: countries present in COUNTRY_FLAGS but previously missing here
  "czech republic": { name: "Czech Republic", flag: "🇨🇿" },
  czechia: { name: "Czech Republic", flag: "🇨🇿" },
  prague: { name: "Czech Republic", flag: "🇨🇿" },
  romania: { name: "Romania", flag: "🇷🇴" },
  bucharest: { name: "Romania", flag: "🇷🇴" },
  hungary: { name: "Hungary", flag: "🇭🇺" },
  budapest: { name: "Hungary", flag: "🇭🇺" },
  austria: { name: "Austria", flag: "🇦🇹" },
  vienna: { name: "Austria", flag: "🇦🇹" },
  switzerland: { name: "Switzerland", flag: "🇨🇭" },
  zurich: { name: "Switzerland", flag: "🇨🇭" },
  geneva: { name: "Switzerland", flag: "🇨🇭" },
  belgium: { name: "Belgium", flag: "🇧🇪" },
  brussels: { name: "Belgium", flag: "🇧🇪" },
  singapore: { name: "Singapore", flag: "🇸🇬" },
  norway: { name: "Norway", flag: "🇳🇴" },
  oslo: { name: "Norway", flag: "🇳🇴" },
  canada: { name: "Canada", flag: "🇨🇦" },
  toronto: { name: "Canada", flag: "🇨🇦" },
  australia: { name: "Australia", flag: "🇦🇺" },
  sydney: { name: "Australia", flag: "🇦🇺" },
  remote: { name: "Remote", flag: "🌍" },
};

/**
 * ISO 3166-1 alpha-2 code → flag emoji.
 * Used by submit/route.ts to stamp a flag on incoming company submissions.
 * Keep in sync with COUNTRY_MAP — every flag here should have a corresponding
 * name/city entry there so scraped jobs and submissions resolve consistently.
 */
export const COUNTRY_FLAGS: Record<string, string> = {
  US: "🇺🇸",
  UK: "🇬🇧",
  GB: "🇬🇧",
  DE: "🇩🇪",
  FR: "🇫🇷",
  EG: "🇪🇬",
  NL: "🇳🇱",
  ES: "🇪🇸",
  IT: "🇮🇹",
  PL: "🇵🇱",
  CA: "🇨🇦",
  AU: "🇦🇺",
  SE: "🇸🇪",
  NO: "🇳🇴",
  DK: "🇩🇰",
  FI: "🇫🇮",
  PT: "🇵🇹",
  CZ: "🇨🇿",
  RO: "🇷🇴",
  HU: "🇭🇺",
  AT: "🇦🇹",
  CH: "🇨🇭",
  BE: "🇧🇪",
  IE: "🇮🇪",
  SG: "🇸🇬",
  SA: "🇸🇦", // previously missing — Saudi Arabia
  AE: "🇦🇪", // previously missing — UAE
};

export const MODE_COLORS: Record<JobMode, string> = {
  local: "#22c55e",
  global: "#f59e0b",
};

export const MODE_LABELS: Record<JobMode, string> = {
  local: "🇪🇬 Local",
  global: "🌐 Remote",
};
