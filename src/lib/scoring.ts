// src/lib/scoring.ts
import type { ScoreInput, ScoreResult, JobMode } from "../types";
import {
  EXPERT_SKILLS,
  SECONDARY_SKILLS,
  BONUS_SKILLS,
  SENIOR_KEYWORDS,
  JUNIOR_KEYWORDS,
  TOXIC_KEYWORDS,
  computeRecencyScore,
} from "./constants";
import { parseRelativeDate } from "./sources/ats-utils";

// ── Gate Logic ───────────────────────────────────────────────────────────

// Accept these titles even if they don't have frontend/react explicitly
const FE_TITLE_WHITELIST =
  /\b(frontend|front-end|react|react\.js|reactjs|ui engineer|web engineer|product engineer|design engineer|application engineer|software engineer|software developer)\b/i;

// Mandatory tech keywords - React is a MUST
const REACT_REQUIRED = /\b(react|next\.?js)\b/i;

const SCORE_DENOMINATOR = 18;

// ── Title & Description filters ─────────────────────────────────────────────

export function isClearlyNonFrontend(title: string): boolean {
  const t = title.toLowerCase();

  if (/\bfull[\s-]?stack\b|\bfullstack\b/.test(t)) return true;
  if (/\bbackend\b|\bback[\s-]end\b/.test(t)) return true;

  if (/\b(rust|c\+\+|cpp|golang|go|python|ruby|rails|java|kotlin|php|scala|elixir)\b/.test(t)) {
    if (!/\b(frontend|front-end|react)\b/i.test(t)) return true;
  }

  const rejections = [
    /\bdevops\b/,
    /\bdev[\s-]ops\b/,
    /\bsite[\s-]reliability\b/,
    /\bsre\b/,
    /\bplatform\s+engineer\b/,
    /\binfrastructure\s+engineer\b/,
    /\bcloud\s+engineer\b/,
    /\bsecurity\s+engineer\b/,
    /\bnetwork\s+engineer\b/,
    /\bembedded\s+(software|engineer)\b/,
    /\bfirmware\b/,
    /\bml[\s-]?ops\b/,
    /\bmlops\b/,
    /\bdatabase\s+reliability\b/,
    /\bdbre\b/,
    /\bdatabase\s+engineer\b/,
    /\bdba\b/,
    /\bsysadmin\b/,
    /\bsystem\s+administrator\b/,
    /\bdata\s+(engineer|scientist|analyst)\b/,
    /\bmachine\s+learning\s+engineer\b/,
    /\b(ai|ml)\s+engineer\b/,
    /\bproject\s+manager\b/,
    /\bprogram\s+manager\b/,
    /\bproduct\s+(manager|owner)\b/,
    /\baccount\s+manager\b/,
    /\bscrum\s+master\b/,
    /\boperations\s+manager\b/,
    /\bsales\s+(manager|engineer|specialist)\b/,
    /\bbusiness\s+(analyst|development)\b/,
    /\bcustomer\s+success\b/,
    /\bsupport\s+(engineer|specialist|analyst)\b/,
    /\bhelpdesk\b/,
    /\bhelp\s+desk\b/,
    /\bservice\s+desk\b/,
    /\brecruiter\b/,
    /\bhr\s+(manager|specialist|generalist)\b/,
    /\bfinance\s+(manager|analyst|lead)\b/,
    /\baccountant\b/,
    /\bmarketing\s+(manager|specialist|analyst|operations)\b/,
    /\bcompliance\s+(analyst|engineer|manager|specialist|operations)\b/,
    /\bproduct\s+designer\b/,
    /\bux\s+(designer|researcher)\b/,
    /\bquality\s+assurance\b/,
    /\bautomation\s+tester\b/,
    /\btest\s+engineer\b/,
    /\bhardware\b/,
    /\bintern\b/,
  ];

  if (rejections.some((re) => re.test(t))) return true;
  return !FE_TITLE_WHITELIST.test(t);
}

export function isTooSeniorOrTooJunior(title: string, mode?: JobMode): boolean {
  // Always reject Intern/Junior/Entry keywords
  if (JUNIOR_KEYWORDS.test(title)) return true;

  // For Local (Egypt), we allow Senior OR Mid-level/Experienced
  if (mode === "local") {
    // Only reject if it doesn't mention Senior OR Mid-level
    const isSenior = SENIOR_KEYWORDS.test(title);
    const isMid = /\bmid\b|experienced/i.test(title);
    return !isSenior && !isMid;
  }

  // For Visa and Global Remote, we allow everything that isn't JUNIOR_KEYWORDS
  return false;
}

export function isGeographicallyBlacklisted(text: string): boolean {
  const t = text.toLowerCase();

  const blacklist = [
    /\bisrael\b/,
    /\btel\s+aviv\b/,
    /\btel-aviv\b/,
    /\bhaifa\b/,
    /\bherzliya\b/,
    /\bjerusalem\b/,
    /\bra'anana\b/,
    /\bgush\s+dan\b/,
    /\bcentral\s+district\b/,
    // Country restrictions
    /\b(us|usa|united\s+states|u\.?s\.?a\.?)\s+only\b/i,
    /\b(uk|u\.?k\.?|united\s+kingdom)\s+only\b/i,
    /\bcanada\s+only\b/i,
    /\beurope\s+only\b/i,
    /\bamericas\s+only\b/i,
    /\blatam\s+only\b/i,
    /\bapac\s+only\b/i,
    // Patterns found in recent quotes
    /remote\s*-\s*(united\s+states|usa|us)/i,
    /based\s+in\s+the\s+americas\s+or\s+europe/i,
    /restricted\s+to\s+candidates\s+in\s+(the\s+)?(us|usa|united\s+states)/i,
    /available\s+locations:\s*(bengaluru|india|bangalore)/i,
    // Hybrid/Office requirements
    /hybrid\s+workplace/i,
    /hybrid\s+role/i,
    /in-person\s+participation\s+is\s+required/i,
    /office\s+presence\s+is\s+required/i,
    /office\s+culture/i,
    /collaboration\s+of\s+being\s+together/i,
    /work-life\s+harmony/i,
    /value\s+in\s+our\s+office\s+culture/i,
    /\b(portugal|spain|france|germany|italy|poland|switzerland|india|nyc|san\s+francisco|bay\s+area|lisbon|madrid|barcelona|aveiro)\b/i,
  ];

  if (/\b(global|emea|egypt|cairo|giza|anywhere|worldwide)\b/i.test(t)) {
    if (/\bisrael|tel\s+aviv|haifa|herzliya/i.test(t)) return true;
    return false;
  }

  return blacklist.some((re) => re.test(t));
}

export function isGenericTitleButBackendRole(title: string, description: string): boolean {
  const t = title.toLowerCase();
  const desc = description.toLowerCase();

  const isSpecificallyFE = /\b(frontend|front-end|react|ui)\b/i.test(t);

  if (/\bfull[\s-]?stack\b|\bfullstack\b/.test(desc)) return true;
  if (!REACT_REQUIRED.test(desc)) return true;

  const backendSignals = [
    /\bkubernetes\b/,
    /\bterraform\b/,
    /\binfrastructure\b/,
    /\bpostgresql\b|\bpostgres\b/,
    /\bkafka\b/,
    /\bsite\s+reliability\b/,
    /\bci\/cd\s+pipeline\b/,
    /\bspring\s*boot\b/,
    /\bjvm\b/,
    /\bdistributed\s+systems\b/,
    /\bmicroservices\b/,
    /\brabbitmq\b/,
    /\belasticsearch\b/,
    /\bbackend\s+api\b/,
    /\brest\s+api\b/,
    /\bgolang\b|\bgo\s+backend\b/,
    /\bpython\s+(fastapi|django|flask)\b/,
    /\brust\b/,
    /\bc\+\+|\bcpp\b/,
    /\bsystems\s+programming\b/,
    /\bjava\b.*\bscala\b/i,
  ];

  const feSignals = [
    /\breact\b/,
    /\bnext\.?js\b/,
    /\btypescript\b/,
    /\bjavascript\b/,
    /\btailwind\b/,
  ];

  const bCount = backendSignals.filter((re) => re.test(desc)).length;
  const fCount = feSignals.filter((re) => re.test(desc)).length;

  if (!isSpecificallyFE && bCount >= 3 && bCount > fCount) return true;
  if (isSpecificallyFE && bCount >= 6 && bCount > fCount * 2) return true;

  return false;
}

export function requiresCitizenshipOrClearance(text: string): boolean {
  const t = text.toLowerCase();
  return [
    /must\s+be\s+a?\s*(us|uk|eu|canadian|australian|u\.?s\.?|u\.?k\.?)?\s*citizen/,
    /citizenship\s+required/,
    /security\s+clearance\s+required/,
    /cannot\s+(provide|offer|give)\s+visa\s+sponsorship/,
    /unable\s+to\s+(provide|offer|give|support)\s+visa\s+sponsorship/,
    /we\s+are\s+unable\s+to\s+offer\s+visa/,
    /not\s+ able\s+to\s+(provide|offer|give)\s+sponsorship/,
    /unable\s+to\s+sponsor/,
    /we\s+(do\s+not|don'?t)\s+sponsor/,
    /no\s+visa\s+sponsorship/,
    /remotely?\s+in\s+the\s+(united\s+states|us|uk|canada|u\.?s\.?|u\.?k\.?)/,
    /must\s+be\s+located\s+in\s+(the\s+)?(united\s+states|us|uk|canada|u\.?s\.?|u\.?k\.?)/,
    /\bu\.?s\.?\s+hubs?\b/,
    /\bu\.?s\.?-only\b/,
    /only\s+open\s+to\s+(residents|citizens|candidates)\s+of\s+(the\s+)?(united\s+states|us|uk|canada|u\.?s\.?|u\.?k\.?)/,
    /\bhybrid\b.*\b(london|berlin|paris|nyc|san\s+francisco|bay\s+area|bangalore|bengaluru|lisbon|madrid|barcelona|aveiro)\b/i,
    /\b(onsite|on-site|in-office|office-based)\b.*\b(london|berlin|paris|nyc|san\s+francisco|bay\s+area|bangalore|bengaluru|lisbon|madrid|barcelona|aveiro)\b/i,
  ].some((re) => re.test(t));
}

// ── Red Flag Detection ────────────────────────────────────────────────────

export function detectRedFlags(description: string): string[] {
  const flags: string[] = [];
  const text = description.toLowerCase();
  for (const { regex, label } of TOXIC_KEYWORDS) {
    if (regex.test(text)) {
      flags.push(label);
    }
  }
  return flags;
}

// ── Scoring ────────────────────────────────────────────────────────────────

function skillMatch(text: string, skill: string): boolean {
  const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`\\b${escaped}\\b`).test(text);
}

export function scoreJob(input: ScoreInput, mode?: JobMode): ScoreResult {
  const text = `${input.title} ${input.description}`.toLowerCase();

  // ── GATE: Tech Signal Check ─────────────────────────────────────────────
  if (!REACT_REQUIRED.test(text)) {
    return {
      matchedSkills: [],
      bonusSkills: [],
      missingSkills: EXPERT_SKILLS.slice(0, 6),
      skillMatchScore: 0,
      recencyScore: 0,
      relocationBonus: 0,
      totalScore: 0,
      redFlags: [],
    };
  }

  // ── GATE: Non-Frontend / Backend / Clearance Check ──────────────────────
  if (isClearlyNonFrontend(input.title) || isTooSeniorOrTooJunior(input.title, mode)) {
    return {
      matchedSkills: [],
      bonusSkills: [],
      missingSkills: EXPERT_SKILLS.slice(0, 6),
      skillMatchScore: 0,
      recencyScore: 0,
      relocationBonus: 0,
      totalScore: 0,
      redFlags: [],
    };
  }

  if (
    isGeographicallyBlacklisted(text) ||
    isGenericTitleButBackendRole(input.title, input.description) ||
    requiresCitizenshipOrClearance(text)
  ) {
    return {
      matchedSkills: [],
      bonusSkills: [],
      missingSkills: EXPERT_SKILLS.slice(0, 6),
      skillMatchScore: 0,
      recencyScore: 0,
      relocationBonus: 0,
      totalScore: 0,
      redFlags: [],
    };
  }

  const matchedExpert = EXPERT_SKILLS.filter((s) => skillMatch(text, s.toLowerCase()));
  const matchedSecondary = SECONDARY_SKILLS.filter((s) => skillMatch(text, s.toLowerCase()));

  let skillMatchScore = Math.min(
    100,
    Math.round(
      ((matchedExpert.length * 3 + matchedSecondary.length * 1) / SCORE_DENOMINATOR) * 100,
    ),
  );
  if (/\b(frontend|front-end|react)\b/i.test(input.title))
    skillMatchScore = Math.min(100, skillMatchScore + 20);

  if (skillMatchScore < 5)
    return {
      matchedSkills: [],
      bonusSkills: [],
      missingSkills: EXPERT_SKILLS.slice(0, 6),
      skillMatchScore: 0,
      recencyScore: 0,
      relocationBonus: 0,
      totalScore: 0,
      redFlags: [],
    };

  const bonusSkills = BONUS_SKILLS.filter((s) => skillMatch(text, s.toLowerCase()));
  const matchedSet = new Set([...matchedExpert, ...matchedSecondary].map((s) => s.toLowerCase()));
  const missingSkills = EXPERT_SKILLS.filter((s) => !matchedSet.has(s.toLowerCase())).slice(0, 6);

  const parsedDate = parseRelativeDate(input.postedAt);
  const recencyScore = computeRecencyScore(parsedDate);
  const relocationBonus = /\brelocation\b/.test(input.description.toLowerCase()) ? 10 : 0;
  const totalScore = Math.round(skillMatchScore * 0.6 + recencyScore * 0.3 + relocationBonus * 0.1);

  const redFlags = detectRedFlags(input.description);

  return {
    matchedSkills: [...matchedExpert, ...matchedSecondary],
    bonusSkills,
    missingSkills,
    skillMatchScore,
    recencyScore,
    relocationBonus,
    totalScore,
    redFlags,
  };
}
