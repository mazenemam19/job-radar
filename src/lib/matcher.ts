import { Job } from "@/types";
import { CV_PROFILE, SkillEntry } from "./cv-profile";
import { differenceInDays, parseISO } from "date-fns";

// ─── Skill Matching ───────────────────────────────────────────────────────────

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9.\s]/g, " ");
}

function skillFoundInText(skill: SkillEntry, text: string): boolean {
  const normalized = normalizeText(text);
  const allTerms = [skill.name, ...skill.aliases].map((t) => normalizeText(t));
  return allTerms.some((term) => {
    const pattern = new RegExp(`(?:^|\\s|[,;(])${escapeRegex(term)}(?:$|\\s|[,;)])`, "i");
    return pattern.test(normalized);
  });
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ─── Recency Score (0–100) ────────────────────────────────────────────────────

function computeRecencyScore(postedAt: string): number {
  try {
    const days = differenceInDays(new Date(), parseISO(postedAt));
    if (days <= 0) return 100;
    if (days >= 60) return 0;
    return Math.round(100 - (days / 60) * 100);
  } catch {
    return 50;
  }
}

// ─── Skill Match Score (0–100) ────────────────────────────────────────────────

function computeSkillScore(text: string): {
  score: number;
  matched: string[];
  missing: string[];
} {
  const { skills } = CV_PROFILE;
  let totalWeight = 0;
  let matchedWeight = 0;
  const matched: string[] = [];
  const missing: string[] = [];

  for (const skill of skills) {
    totalWeight += skill.weight;
    if (skillFoundInText(skill, text)) {
      matchedWeight += skill.weight;
      matched.push(skill.name);
    } else {
      if (skill.weight >= 2) missing.push(skill.name);
    }
  }

  const score = totalWeight > 0 ? Math.round((matchedWeight / totalWeight) * 100) : 0;
  return { score, matched, missing };
}

// ─── Visa Detection (negation-aware) ─────────────────────────────────────────
// Strategy:
//   1. Check explicit "not sponsoring" phrases first — if found, return false immediately
//   2. Then check for any positive visa keyword — if found, return true
// This avoids the over-broad negation window that was killing legitimate jobs.

const NEGATIVE_VISA_PHRASES = [
  "cannot offer visa sponsorship",
  "unable to offer visa sponsorship",
  "unable to provide visa sponsorship",
  "does not offer visa sponsorship",
  "do not offer visa sponsorship",
  "we do not offer visa sponsorship",
  "not open to visa sponsorship",
  "this role is not open to visa",
  "this position does not offer visa",
  "this position is not eligible for visa",
  "visa sponsorship is not available",
  "visa sponsorship not available",
  "visa sponsorship: not available",
  "no visa sponsorship",
  "without visa sponsorship",
  "not eligible for visa sponsorship",
  "sponsorship is not available",
  "sponsorship not available",
  "sponsorship: not available",
  "sponsorship: unfortunately",
  "unfortunately, sponsorship",
  "unfortunately sponsorship",
  "unable to sponsor",
  "cannot sponsor",
  "we cannot sponsor",
  "we do not sponsor",
  "we are unable to sponsor",
  "we are not able to sponsor",
  "no sponsorship",
  "not providing sponsorship",
  "must be eligible to work in the us without",
  "must be authorized to work in the us without",
  "not open to visa transfer",
  "corp-to-corp",
  // patterns like "visa sponsorship: not available" embedded in structured fields
  "visa: not available",
  "visa/sponsorship: no",
];

// After ruling out negatives, any mention of these terms is enough
const POSITIVE_VISA_TERMS = [
  "visa sponsorship",
  "visa sponsor",
  "tier 2 sponsor",
  "skilled worker visa",
  "work permit sponsor",
  "we will sponsor",
  "willing to sponsor",
];

function detectVisaSponsorship(text: string): boolean {
  const lower = text.toLowerCase();

  // Step 1: explicit negatives — fast exit
  if (NEGATIVE_VISA_PHRASES.some((phrase) => lower.includes(phrase))) return false;

  // Step 2: any positive mention is enough (negatives already ruled out above)
  return POSITIVE_VISA_TERMS.some((term) => lower.includes(term));
}

// ─── Relocation Detection ─────────────────────────────────────────────────────

function detectRelocation(text: string): boolean {
  const lower = text.toLowerCase();
  return CV_PROFILE.relocationKeywords.some((kw) => lower.includes(kw));
}

// ─── Total Score ──────────────────────────────────────────────────────────────

function computeTotalScore(
  skillScore: number,
  recencyScore: number,
  hasRelocation: boolean
): number {
  const base = skillScore * 0.6 + recencyScore * 0.3;
  const bonus = hasRelocation ? 10 : 0;
  return Math.min(100, Math.round(base + bonus));
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export function scoreJob(job: Omit<Job, "matchScore" | "matchedSkills" | "missingSkills" | "recencyScore" | "totalScore">): Pick<Job, "matchScore" | "matchedSkills" | "missingSkills" | "recencyScore" | "totalScore" | "hasVisaSponsorship" | "hasRelocation"> {
  const fullText = `${job.title} ${job.description} ${job.tags.join(" ")}`;

  const { score: matchScore, matched, missing } = computeSkillScore(fullText);
  const recencyScore = computeRecencyScore(job.postedAt);
  const hasVisa = detectVisaSponsorship(fullText);
  const hasRelocation = detectRelocation(fullText);
  const totalScore = computeTotalScore(matchScore, recencyScore, hasRelocation);

  return {
    matchScore,
    matchedSkills: matched,
    missingSkills: missing,
    recencyScore,
    totalScore,
    hasVisaSponsorship: hasVisa,
    hasRelocation,
  };
}