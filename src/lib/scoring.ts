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
// TIER 5b+5c: Seniority is now multi-label set-overlap, not single-winner precedence.
//             Four editable term arrays replace the four hardcoded regexes.
//             Junior is no longer a hard reject — just another selectable level.

import type { RawJob, ResolvedSettings, ScoredJob, SeniorityLevel } from "./types";

// ── Seniority: term-array classification (Tier 5c, B2) ───────

/** Ordinal rank for display badge purposes only (highest-wins). */
const SENIORITY_RANK: SeniorityLevel[] = ["junior", "mid", "senior", "staff"];

const VISA_SPONSORSHIP_PATTERN = /visa\s+sponsorship|relocation|work\s+permit/i;

/**
 * Build a word-boundary regex from a term array. Each term is escaped;
 * the resulting pattern matches any term as a whole word.
 *
 * Note on \b word boundaries: \b matches adjacent to word characters [A-Za-z0-9_].
 * Terms starting/ending with non-word chars (e.g. ".NET", "C++") will NOT match
 * as expected because \b requires a word character at the boundary. This is standard
 * regex behavior — document it so users know to use "dotnet" or "csharp" aliases
 * for such terms, or the system could be extended to use lookahead/lookbehind
 * assertions for non-word-boundary terms in future.
 */
function buildLevelRegex(terms: string[]): RegExp {
  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`\\b(${escaped.join("|")})\\b`, "i");
}

/**
 * Returns the set of seniority levels a job's text matches.
 * Multi-label: a job can match zero, one, or several levels simultaneously
 * (e.g. "Senior Staff Engineer" matches both Senior and Staff).
 */
export function getMatchedLevels(job: RawJob, settings: ResolvedSettings): SeniorityLevel[] {
  const text = `${job.title} ${job.description}`;
  const levels: SeniorityLevel[] = [];
  if (buildLevelRegex(settings.junior_keywords).test(text)) levels.push("junior");
  if (buildLevelRegex(settings.mid_keywords).test(text)) levels.push("mid");
  if (buildLevelRegex(settings.senior_keywords).test(text)) levels.push("senior");
  if (buildLevelRegex(settings.staff_keywords).test(text)) levels.push("staff");
  return levels;
}

/**
 * Gate logic: pass if any matched level is in the user's selected levels.
 * Unlabelled jobs (no level matches) always pass — unchanged behavior.
 */
export function passesSeniorityGate(job: RawJob, settings: ResolvedSettings): boolean {
  const matched = getMatchedLevels(job, settings);
  if (matched.length === 0) return true; // unlabelled — unchanged behavior
  return matched.some((l) => settings.seniority_levels.includes(l));
}

/**
 * Display-only: returns the highest-ranked matched seniority level for the badge.
 * Fixed ordinal rank, NOT user-editable — only decides badge text, never gating.
 * Returns null if the job matches no level (unlabelled).
 */
export function getDisplaySeniorityBadge(
  job: RawJob,
  settings: ResolvedSettings,
): SeniorityLevel | null {
  const matched = getMatchedLevels(job, settings);
  if (matched.length === 0) return null;
  // Iterate from highest rank downward, return first match found
  for (let i = SENIORITY_RANK.length - 1; i >= 0; i--) {
    if (matched.includes(SENIORITY_RANK[i])) return SENIORITY_RANK[i];
  }
  return null;
}

// ── Boilerplate-aware keyword matching (Bug 2, gemini-filter-audit.md) ──

/**
 * Many ATS postings open with a long "About [Company]" boilerplate
 * paragraph that mentions the company's own product/stack regardless of
 * the specific role.
 */
const BOILERPLATE_WINDOW_CHARS = 600;

function wordBoundaryPattern(word: string): string {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return `\\b${escaped}\\b`;
}

/**
 * Returns true if `keywords` has a "meaningful" match in `text`: either a
 * match past the boilerplate-prone opening window, or two or more distinct
 * keywords matched anywhere (breadth).
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
      if (m.index === regex.lastIndex) regex.lastIndex++;
    }
    if (matchedThisWord) distinctMatchCount++;
  }

  return matchOutsideWindow || distinctMatchCount >= 2;
}

// ── Recency ──────────────────────────────────────────────────

/**
 * Compute recency score LIVE from a date string.
 * FIX #3: Never pass a pre-stored score; always call this with the current clock.
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

export function hasRelocationSupport(job: RawJob): boolean {
  return (
    job.visa_sponsorship ||
    VISA_SPONSORSHIP_PATTERN.test(job.description) ||
    VISA_SPONSORSHIP_PATTERN.test(job.title)
  );
}

// ── Settings gate & Pre-filters ──────────────────────────────

/**
 * Evaluates whether a raw job passes all user settings and pre-filter regex gates.
 * Run BEFORE sending jobs to Gemini.
 */
export function passesSettingsGate(job: RawJob, settings: ResolvedSettings): boolean {
  // 1. Seniority Gate
  if (!passesSeniorityGate(job, settings)) {
    return false;
  }

  const titleLower = job.title.toLowerCase();
  const descLower = job.description.toLowerCase();
  const locLower = job.location.toLowerCase();
  const textCombined = `${titleLower} ${descLower} ${locLower}`;

  // 2. Excluded Keywords
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

  // 3. Required Keywords
  const techKeywords =
    settings.required_keywords && settings.required_keywords.length > 0
      ? settings.required_keywords
      : settings.expert_skills;

  if (techKeywords && techKeywords.length > 0) {
    if (!hasMeaningfulKeywordMatch(textCombined, techKeywords)) {
      return false;
    }
  }

  // 4. Blacklisted Locations
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

  // 5. Skill Match Check
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

// ── Global mode gate ────────────────────────────────────────

/**
 * Evaluates whether a job passes the user's global mode timezone/region filter.
 */
export function passesGlobalModeGate(job: RawJob, settings: ResolvedSettings): boolean {
  const text = `${job.title} ${job.description} ${job.location}`.toLowerCase();

  if (settings.global_mode_allowed_locations?.length) {
    const isAllowed = settings.global_mode_allowed_locations.some((loc) =>
      text.includes(loc.toLowerCase()),
    );
    if (isAllowed) return true;
  }

  if (settings.global_mode_blocked_regions?.length) {
    const isBlocked = settings.global_mode_blocked_regions.some((region) => {
      const escaped = region.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
      const regex = new RegExp(`\\b${escaped}\\b`, "i");
      return regex.test(text);
    });
    if (isBlocked) return false;
  }

  return true;
}

// ── Date gate ────────────────────────────────────────────────

/**
 * Returns true if the job is within the configured age window.
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
  if (!passesSeniorityGate(job, settings)) {
    return null;
  }

  const dateForRecency = job.date_unknown ? job.fetched_at : job.posted_at;
  const recency_score = computeRecencyScore(dateForRecency);

  const { score: skill_match_score, matched: matched_skills } = computeSkillMatchScore(
    job.description,
    settings,
  );

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
 */
export function mergeJobs(existing: ScoredJob[], incoming: ScoredJob[]): ScoredJob[] {
  const map = new Map(existing.map((j) => [j.id, j]));

  for (const job of incoming) {
    if (job.total_score <= 0) continue;
    const prev = map.get(job.id);
    if (!prev || job.fetched_at > prev.fetched_at) {
      map.set(job.id, job);
    }
  }

  return Array.from(map.values()).sort((a, b) => b.total_score - a.total_score);
}
