// src/lib/scoring.ts
// Bug fixes vs old code (src/lib/scoring.ts):
//
// FIX #3: recencyScore is always computed LIVE from postedAt (never stored/frozen).
//         The exported computeRecencyScore() function is used both here and in the UI.
//
// FIX #5: date_unknown jobs use fetched_at as postedAt. Their recency decays
//         normally from fetch time rather than being permanently "now".
//
// FIX #6: recencyScore is computed independently of the skill gate. A job that
//         fails the skill gate gets recencyScore computed (not forced to 0) and
//         then the job is simply not stored (total_score gate applied at merge time).
//
// REGEX:  STAFF_KEYWORDS uses proper word boundaries on both ends:
//         /\b(lead|staff|principal|architect|director|vp|head)\b/i

import type { RawJob, ResolvedSettings, ScoredJob } from "./types";

// ── Seniority gate regex ─────────────────────────────────────

/** Fixed regex: word boundaries protect ALL terms, not just lead/head. */
export const STAFF_KEYWORDS = /\b(lead|staff|principal|architect|director|vp|head)\b/i;

const SENIOR_KEYWORDS = /\b(senior|sr\.?|principal|staff|lead)\b/i;
const MID_KEYWORDS = /\b(mid[-\s]?level|mid[-\s]?senior|intermediate)\b/i;
const JUNIOR_KEYWORDS = /\b(junior|jr\.?|entry[\s-]?level|intern|graduate)\b/i;

// ── Boilerplate-aware keyword matching (Bug 2, gemini-filter-audit.md) ──

/**
 * Many ATS postings open with a long "About [Company]" boilerplate
 * paragraph that mentions the company's own product/stack regardless of
 * the specific role — e.g. every Vercel posting (Account Executive,
 * Senior HRBP, Partner Operations Lead, ...) opens with "the team behind
 * Next.js". A naive "does this keyword appear anywhere" check treats that
 * boilerplate identically to a real requirements section, which produced
 * a 100% false-positive rate for non-engineering Vercel roles — confirmed
 * against live raw_jobs data. See
 * docs/plans/2026-06-24-bug2-boilerplate-keyword-gate.md.
 *
 * 600 chars comfortably covers the confirmed Vercel intro (~788 chars,
 * only match at ~190).
 */
const BOILERPLATE_WINDOW_CHARS = 600;

function wordBoundaryPattern(word: string): string {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return `\\b${escaped}\\b`;
}

/**
 * Returns true if `keywords` has a "meaningful" match in `text`: either a
 * match past the boilerplate-prone opening window, or two or more distinct
 * keywords matched anywhere (breadth). Texts at or under the window size
 * are exempt from the position check — too short for a real "intro vs.
 * body" split, so a single early match is trusted as before.
 */
export function hasMeaningfulKeywordMatch(text: string, keywords: string[]): boolean {
  if (text.length <= BOILERPLATE_WINDOW_CHARS) {
    return keywords.some((word) => new RegExp(wordBoundaryPattern(word), "i").test(text));
  }

  let distinctMatchCount = 0;
  let matchOutsideWindow = false;

  for (const word of keywords) {
    const regex = new RegExp(wordBoundaryPattern(word), "gi");
    let matchedThisWord = false;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
      matchedThisWord = true;
      if (m.index >= BOILERPLATE_WINDOW_CHARS) {
        matchOutsideWindow = true;
      }
      if (m.index === regex.lastIndex) regex.lastIndex++; // guard against zero-length matches
    }
    if (matchedThisWord) distinctMatchCount++;
  }

  return matchOutsideWindow || distinctMatchCount >= 2;
}

// ── Recency ──────────────────────────────────────────────────

/**
 * Compute recency score LIVE from a date string.
 * FIX #3: Never pass a pre-stored score; always call this with the current clock.
 *
 * Score decays linearly from 100 (just posted) to 0 at 7 days old, then stays 0.
 * Formula: 100 - (ageDays / 7) * 100  — mirrors the original constants.ts formula exactly.
 *
 * Examples:
 *   0 days old  → 100
 *   3.5 days    →  50
 *   7 days      →   0
 *   14 days     →   0
 */
export function computeRecencyScore(postedAt: string): number {
  const ms = Date.parse(postedAt);
  if (Number.isNaN(ms)) return 0;
  const ageDays = (Date.now() - ms) / 86_400_000;
  return Math.max(0, Math.round(100 - (ageDays / 7) * 100));
}

// ── Skill matching ───────────────────────────────────────────

/** Returns list of skills found in the description (case-insensitive). */
export function matchSkills(description: string, skills: string[]): string[] {
  const lower = description.toLowerCase();
  return skills.filter((s) => lower.includes(s.toLowerCase()));
}

/**
 * Compute raw skill match score.
 *
 * Expert skills each count as 3 points.
 * Secondary skills each count as 1 point.
 * Score is divided by score_denominator and capped at 100.
 */
export function computeSkillMatchScore(
  description: string,
  settings: Pick<ResolvedSettings, "expert_skills" | "secondary_skills" | "score_denominator">,
): { score: number; matched: string[] } {
  const expertMatched = matchSkills(description, settings.expert_skills);
  const secondaryMatched = matchSkills(description, settings.secondary_skills);

  const raw = expertMatched.length * 3 + secondaryMatched.length;
  const score = Math.min(100, Math.round((raw / settings.score_denominator) * 100));

  return {
    score,
    matched: [...expertMatched, ...secondaryMatched],
  };
}

// ── Relocation bonus ─────────────────────────────────────────

const RELOCATION_PATTERN = /\b(relocation|relo\b|visa\s+sponsorship|work\s+permit)\b/i;

export function hasRelocationSupport(job: RawJob): boolean {
  return (
    job.visa_sponsorship ||
    RELOCATION_PATTERN.test(job.description) ||
    RELOCATION_PATTERN.test(job.title)
  );
}

// ── Seniority gate ───────────────────────────────────────────

/**
 * Returns true if the job should be kept based on seniority gates.
 *
 * - If seniority_allow_mid = false: only Senior+ titles pass.
 * - If seniority_allow_mid = true: Mid-Senior and above pass.
 * - Junior/intern always rejected.
 * - Unlabelled jobs: allowed (Gemini will evaluate further).
 */
export function passesSeniorityGate(job: RawJob, allowMid: boolean): boolean {
  const text = `${job.title} ${job.description}`;

  if (JUNIOR_KEYWORDS.test(text)) return false;
  if (STAFF_KEYWORDS.test(text)) return true; // Staff/lead = senior
  if (SENIOR_KEYWORDS.test(text)) return true;
  if (MID_KEYWORDS.test(text)) return allowMid;

  // No seniority signal – pass through to Gemini
  return true;
}

// ── Settings gate & Pre-filters ──────────────────────────────

/**
 * Evaluates whether a raw job passes all user settings and pre-filter regex gates.
 * Run BEFORE sending jobs to Gemini.
 */
export function passesSettingsGate(job: RawJob, settings: ResolvedSettings): boolean {
  // 1. Seniority Gate
  if (!passesSeniorityGate(job, settings.seniority_allow_mid)) {
    return false;
  }

  const titleLower = job.title.toLowerCase();
  const descLower = job.description.toLowerCase();
  const locLower = job.location.toLowerCase();
  const textCombined = `${titleLower} ${descLower} ${locLower}`;

  // 2. Excluded Keywords (Dynamic role gate matching against job title)
  if (settings.excluded_keywords && settings.excluded_keywords.length > 0) {
    const hasExcluded = settings.excluded_keywords.some((word) => {
      const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
      const regex = new RegExp(`\\b${escaped}\\b`, "i");
      return regex.test(titleLower);
    });
    if (hasExcluded) {
      return false;
    }
  }

  // 3. Required Keywords (Dynamic tech/role gate matching against job title/description)
  // We use settings.required_keywords if provided, otherwise fallback to settings.expert_skills
  const techKeywords =
    settings.required_keywords && settings.required_keywords.length > 0
      ? settings.required_keywords
      : settings.expert_skills;

  if (techKeywords && techKeywords.length > 0) {
    if (!hasMeaningfulKeywordMatch(textCombined, techKeywords)) {
      return false;
    }
  }

  // 4. Blacklisted Locations (Dynamic location/clearance blacklist matching against title/description/location)
  if (settings.blacklisted_locations && settings.blacklisted_locations.length > 0) {
    const hasBlacklisted = settings.blacklisted_locations.some((word) => {
      const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
      const regex = new RegExp(`\\b${escaped}\\b`, "i");
      return regex.test(textCombined) || textCombined.includes(word.toLowerCase());
    });
    if (hasBlacklisted) {
      return false;
    }
  }

  // 5. Skill Match Check: Ensure there is at least one *meaningful* skill
  // match from the user's stack to keep relevancy high (Bug 2: boilerplate-
  // aware — see hasMeaningfulKeywordMatch above).
  if (
    !hasMeaningfulKeywordMatch(job.description, [
      ...settings.expert_skills,
      ...settings.secondary_skills,
    ])
  ) {
    return false;
  }

  return true;
}

// ── Date gate ────────────────────────────────────────────────

/**
 * Returns true if the job is within the configured age window.
 * Uses posted_at (or fetched_at for date_unknown jobs – FIX #5).
 */
export function passesDateGate(job: RawJob, maxAgeDays: number): boolean {
  const dateStr = job.date_unknown ? job.fetched_at : job.posted_at;
  const ms = Date.parse(dateStr);
  if (Number.isNaN(ms)) return false;
  const ageDays = (Date.now() - ms) / 86_400_000;
  return ageDays <= maxAgeDays;
}

// ── Main scoring function ────────────────────────────────────

/**
 * Score a raw job against user settings.
 *
 * FIX #6: recencyScore is computed regardless of skill gate result.
 * The caller (runner) decides whether to store the job based on total_score > 0.
 *
 * Returns null if the seniority gate fails (hard reject, no score).
 * Returns a ScoredJob (with total_score possibly = 0) if skill gate fails.
 */
export function scoreJob(
  job: RawJob,
  settings: ResolvedSettings,
  geminiPass = false,
  geminiReason: string | null = null,
  geminiReviewed = false,
  geminiQuotaExhausted = false,
): ScoredJob | null {
  // Seniority hard gate – null means "do not store at all"
  if (!passesSeniorityGate(job, settings.seniority_allow_mid)) {
    return null;
  }

  // FIX #6: compute recency independently – never forced to 0
  // FIX #3: always compute live (not from a stored value)
  const dateForRecency = job.date_unknown ? job.fetched_at : job.posted_at;
  const recency_score = computeRecencyScore(dateForRecency);

  const { score: skill_match_score, matched: matched_skills } = computeSkillMatchScore(
    job.description,
    settings,
  );

  // Bonus skills are informational only — shown to the user, never scored.
  // (Matches the original single-tenant behavior: nice-to-have skills like
  // Node/Docker/AWS surfaced separately from the pass/fail skill match.)
  const bonus_skills = matchSkills(job.description, settings.bonus_skills);

  const relocation_bonus = hasRelocationSupport(job) ? 100 : 0;

  const { skill, recency, relocation } = settings.scoring_weights;
  const total_score = Math.round(
    skill_match_score * skill + recency_score * recency + relocation_bonus * relocation,
  );

  return {
    ...job,
    skill_match_score,
    recency_score,
    relocation_bonus,
    total_score,
    matched_skills,
    bonus_skills,
    gemini_pass: geminiPass,
    gemini_reason: geminiReason,
    gemini_reviewed: geminiReviewed,
    gemini_quota_exhausted: geminiQuotaExhausted,
  };
}

// ── Merge / dedup ────────────────────────────────────────────

/**
 * Merges new scored jobs into an existing array.
 * Deduplication by job.id (URL hash).
 *
 * FIX #6: totalScore > 0 gate applied HERE before storing.
 *         Jobs with total_score = 0 (skill mismatch) are dropped.
 *
 * Returns jobs sorted descending by total_score.
 */
export function mergeJobs(existing: ScoredJob[], incoming: ScoredJob[]): ScoredJob[] {
  const map = new Map(existing.map((j) => [j.id, j]));

  for (const job of incoming) {
    // FIX #6: gate on total_score > 0
    if (job.total_score <= 0) continue;
    // Newer entry wins (fetched_at comparison)
    const prev = map.get(job.id);
    if (!prev || job.fetched_at > prev.fetched_at) {
      map.set(job.id, job);
    }
  }

  return Array.from(map.values()).sort((a, b) => b.total_score - a.total_score);
}
