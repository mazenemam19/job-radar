// src/lib/sources/ats/job-processing.ts
// Split out of ats-utils.ts (see AUDIT_STATUS.md row #2) — no behavior change
// except the New Cairo fix noted below.
import type { Job, BaseCompany, ATSRawInput } from "@/types";
import type { JobMode } from "@/lib/types";
import { COUNTRY_MAP } from "../../constants";

/** Parses strings like '1 day ago', '2 hours ago', 'yesterday' into ISO strings. */
export function parseRelativeDate(text: string): string {
  if (!text) return new Date().toISOString();
  const t = text.toLowerCase().trim();
  const now = new Date();

  if (t === "yesterday") {
    return new Date(now.getTime() - 864e5).toISOString();
  }
  if (t === "just now" || t === "today") {
    return now.toISOString();
  }

  const match = t.match(/(\d+)\s+(minute|hour|day|week|month|year)s?\s+ago/);
  if (match) {
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const msMap: Record<string, number> = {
      minute: 60 * 1000,
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
      year: 365 * 24 * 60 * 60 * 1000,
    };
    return new Date(now.getTime() - value * msMap[unit]).toISOString();
  }

  // Fallback to native parse
  const parsed = Date.parse(text);
  return isNaN(parsed) ? now.toISOString() : new Date(parsed).toISOString();
}

function detectCountry(
  location: string,
  fallback: { name: string; flag: string },
): { name: string; flag: string } {
  const loc = (location || "").toLowerCase();
  for (const [key, val] of Object.entries(COUNTRY_MAP)) {
    const re = new RegExp(`\\b${key}\\b`, "i");
    if (re.test(loc)) return val;
  }
  return fallback;
}

export function stripHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Ordered match table for extractEgyptCity. "New Cairo" is checked before the
 * plain "cairo" pattern so it's actually reachable — see AUDIT_STATUS.md row
 * #2. (Previously "cairo" was checked first, which meant any location
 * containing "new cairo" was caught by the "cairo" branch and displayed as
 * "Cairo" instead of "New Cairo". That was a real behavior change when fixed,
 * not just a refactor, so it shipped as its own noted fix.)
 */
const EGYPT_CITY_PATTERNS: ReadonlyArray<{ matches: readonly string[]; result: string }> = [
  { matches: ["remote"], result: "Remote 🌐" },
  { matches: ["new cairo", "new-cairo"], result: "New Cairo" },
  { matches: ["cairo"], result: "Cairo" },
  { matches: ["giza"], result: "Giza" },
  { matches: ["alexandria"], result: "Alexandria" },
  { matches: ["maadi"], result: "Maadi, Cairo" },
  { matches: ["nasr city", "nasr-city"], result: "Nasr City, Cairo" },
  { matches: ["heliopolis"], result: "Heliopolis, Cairo" },
  { matches: ["6th", "sheikh zayed"], result: "6th of October" },
  { matches: ["smart village"], result: "Smart Village, Giza" },
];

/** For local jobs: extract a specific Egyptian city from the raw location string. */
function extractEgyptCity(rawLocation: string, companyCity?: string): string {
  const loc = (rawLocation || "").toLowerCase();
  const hit = EGYPT_CITY_PATTERNS.find((p) => p.matches.some((m) => loc.includes(m)));
  return hit?.result ?? companyCity ?? "Cairo";
}

export function processJobs(raw: ATSRawInput[], company: BaseCompany, mode: JobMode): Job[] {
  const now = new Date().toISOString();
  const out: Job[] = [];

  for (const r of raw) {
    const title = r.title.trim();

    // NOTE: All filtering (date, seniority, skills, timezone, Gemini) is now
    // applied downstream in the per-user pipeline (scoring.ts + dashboard route).
    // processJobs() only normalizes raw ATS data into the Job shape.

    const actualSponsorship = /visa\s+sponsorship|relocation|work\s+permit/i.test(
      title + " " + r.description,
    );
    const isRemote = /remote|work\s+from\s+home/i.test(title + r.location + r.description);
    const countryInfo = detectCountry(r.location, {
      name: company.country,
      flag: company.countryFlag,
    });

    const displayLocation =
      mode === "local" ? extractEgyptCity(r.location, company.city) : r.location;

    out.push({
      id: r.id,
      source: "company",
      mode,
      sourceName: company.name,
      title,
      company: r.company || company.name,
      location: displayLocation,
      country: countryInfo.name,
      countryFlag: countryInfo.flag,
      url: r.url,
      // Full description stored — no ceiling.
      description: r.description,
      isRemote,
      postedAt: r.postedAt || now,
      dateUnknown: !r.postedAt,
      visaSponsorship: actualSponsorship,
      // These fields are vestigial on the legacy `Job` type — nothing downstream
      // reads them (the dashboard pipeline computes its own scores in JobCard.tsx via
      // computeRecencyScore/passesSettingsGate against the user's real settings).
      // Kept as neutral defaults only to satisfy the existing type contract.
      matchedSkills: [],
      bonusSkills: [],
      missingSkills: [],
      skillMatchScore: 0,
      recencyScore: 0,
      relocationBonus: 0,
      totalScore: 0,
      fetchedAt: now,
    });
  }
  return out;
}

export async function pLimit<T>(fns: (() => Promise<T>)[], concurrency = 10): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < fns.length; i += concurrency) {
    const batch = await Promise.allSettled(fns.slice(i, i + concurrency).map((f) => f()));
    for (const r of batch) results.push(r.status === "fulfilled" ? r.value : (null as T));
    if (i + concurrency < fns.length) await new Promise((r) => setTimeout(r, 500));
  }
  return results;
}
