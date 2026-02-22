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
    // Use word boundary matching to avoid "react" matching "reactive"
    const pattern = new RegExp(`(?:^|\\s|[,;(])${escapeRegex(term)}(?:$|\\s|[,;)])`, "i");
    return pattern.test(normalized);
  });
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ─── Recency Score (0–100) ────────────────────────────────────────────────────
// Jobs posted today = 100, 30 days ago = 50, 60+ days ago = 0

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
// Weighted: core skills matter more than familiar ones

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
      // Only add to missing if it's proficient/core (weight >= 2)
      if (skill.weight >= 2) missing.push(skill.name);
    }
  }

  const score = totalWeight > 0 ? Math.round((matchedWeight / totalWeight) * 100) : 0;
  return { score, matched, missing };
}

// ─── Visa / Relocation Detection ─────────────────────────────────────────────

function detectVisaSponsorship(text: string): boolean {
  const lower = text.toLowerCase();
  return CV_PROFILE.visaKeywords.some((kw) => lower.includes(kw));
}

function detectRelocation(text: string): boolean {
  const lower = text.toLowerCase();
  return CV_PROFILE.relocationKeywords.some((kw) => lower.includes(kw));
}

// ─── Total Score ──────────────────────────────────────────────────────────────
// Weights: skill match 60%, recency 30%, visa bonus 5%, relocation bonus 5%

function computeTotalScore(
  skillScore: number,
  recencyScore: number,
  hasVisa: boolean,
  hasRelocation: boolean
): number {
  const base = skillScore * 0.6 + recencyScore * 0.3;
  const bonus = (hasVisa ? 5 : 0) + (hasRelocation ? 5 : 0);
  return Math.min(100, Math.round(base + bonus));
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export function scoreJob(job: Omit<Job, "matchScore" | "matchedSkills" | "missingSkills" | "recencyScore" | "totalScore">): Pick<Job, "matchScore" | "matchedSkills" | "missingSkills" | "recencyScore" | "totalScore" | "hasVisaSponsorship" | "hasRelocation"> {
  const fullText = `${job.title} ${job.description} ${job.tags.join(" ")}`;

  const { score: matchScore, matched, missing } = computeSkillScore(fullText);
  const recencyScore = computeRecencyScore(job.postedAt);
  const hasVisa = detectVisaSponsorship(fullText);
  const hasRelocation = detectRelocation(fullText);
  const totalScore = computeTotalScore(matchScore, recencyScore, hasVisa, hasRelocation);

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
