// Converts raw ATS postings into the shared job shape used by the scraper.
import type { Job, BaseCompany, ATSRawInput } from "@/types";
import type { JobMode } from "@/lib/types";
import { detectWorkAuthorizationSignal } from "../../job-signals";
import {
  extractLanguageClues,
  inferEmploymentTypes,
  inferWorkplaceType,
  normalizePostingLocation,
} from "../../job-normalization";

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

export function processJobs(raw: ATSRawInput[], company: BaseCompany, mode: JobMode): Job[] {
  const now = new Date().toISOString();
  const out: Job[] = [];

  for (const r of raw) {
    const title = r.title.trim();

    // NOTE: All filtering (date, seniority, skills, timezone, Gemini) is now
    // applied downstream in the per-user pipeline (scoring.ts + dashboard route).
    // processJobs() only normalizes raw ATS data into the Job shape.

    const workAuthorization = detectWorkAuthorizationSignal(`${title}\n${r.description}`);
    const actualSponsorship = workAuthorization.status === "sponsorship_available";
    const normalizedLocation = normalizePostingLocation(r.location || "");
    const workplaceType = inferWorkplaceType(r.location, title, r.description, r.workplaceType);
    const employmentTypes = inferEmploymentTypes(r.employmentType, title, r.description);
    const languageClues = extractLanguageClues(r.description);

    out.push({
      id: r.id,
      source: "company",
      mode: workplaceType === "remote" ? "global" : mode,
      sourceName: company.name,
      title,
      company: r.company || company.name,
      location: normalizedLocation.sourceLocation || "Unknown location",
      sourceLocation: normalizedLocation.sourceLocation,
      city: normalizedLocation.city,
      country: normalizedLocation.country,
      countryCode: normalizedLocation.countryCode,
      countryFlag: normalizedLocation.countryFlag,
      workplaceType,
      employmentTypes,
      languageRequirements: languageClues.requirements,
      languageEvidence: languageClues.evidence,
      url: r.url,
      // Full description stored — no ceiling.
      description: r.description,
      isRemote: workplaceType === "remote",
      postedAt: r.postedAt || now,
      dateUnknown: !r.postedAt,
      visaSponsorship: actualSponsorship,
      workAuthorizationStatus: workAuthorization.status,
      workAuthorizationEvidence: workAuthorization.evidence,
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
