// src/lib/scoring.ts
//
// Scoring pipeline for frontend job candidates.
// All scoring is purely local — no LLM, no API calls, no rate limits.

// ── Skill definitions ──────────────────────────────────────────────────────

const EXPERT_SKILLS = [
  "React", "TypeScript", "JavaScript", "Redux", "React Query",
  "Material UI", "Vite", "HTML", "CSS", "SASS", "Git",
];

const PROFICIENT_SKILLS = [
  "Next.js", "Node.js", "Express", "MongoDB", "GraphQL", "WebSocket",
  "Jest", "Vitest", "React Testing Library", "AWS", "Docker",
  "Webpack", "Sentry", "MobX",
];

// A job must match ≥ 2 of these or it gets skillMatchScore = 0 (filtered out)
const CORE_FRONTEND_SKILLS = [
  "react", "typescript", "javascript", "html", "css", "sass",
  "next.js", "vue", "angular", "redux", "react query",
  "material ui", "vite", "webpack", "svelte",
];

const MIN_CORE_SKILLS = 2;

// Denominator for score normalization: 5 expert hits = perfect score
//   5 × 3 = 15 → 100%. Anything beyond is capped at 100.
const SCORE_DENOMINATOR = 15;

// ── Filters ────────────────────────────────────────────────────────────────

/**
 * Returns true when the job title clearly belongs to a non-frontend discipline.
 * Checked before scoring to save compute and avoid false positives.
 */
export function isClearlyNonFrontend(title: string): boolean {
  const t = title.toLowerCase();
  const nonFrontend = [
    /\bbackend\b/, /\bback[\s-]end\b/,
    /\bdevops\b/, /\bsite[\s-]reliability\b/, /\bsre\b/,
    /\bdata\s+(engineer|scientist|analyst)\b/,
    /\bmachine\s+learning\s+engineer\b/,
    /\b(ai|ml)\s+engineer\b/,
    /\bmobile\s+engineer\b/, /\bios\s+engineer\b/, /\bandroid\s+engineer\b/,
    /\bplatform\s+engineer\b/,
    /\bsecurity\s+engineer\b/,
    /\bnetwork\s+engineer\b/,
    /\binfrastructure\s+engineer\b/,
    /\bembedded\s+(software|engineer)\b/,
    /\bfirmware\s+engineer\b/,
    /\bstaff\s+engineer\b.*\b(ai|ml|data|infra|platform|ops)\b/,
    /\bcloud\s+engineer\b/,
    /\bsolutions?\s+architect\b/,
  ];
  return nonFrontend.some(re => re.test(t));
}

/**
 * Returns true when the job text indicates citizenship or clearance is required.
 * Also catches the BNSF-style "preferred: no sponsorship" false positive pattern.
 */
export function requiresCitizenshipOrClearance(text: string): boolean {
  const t = text.toLowerCase();

  // Hard citizenship / clearance rejectors
  const hardReject = [
    /must\s+be\s+a?\s*(us|uk|eu|canadian|australian)?\s*citizen/,
    /citizenship\s+required/,
    /security\s+clearance\s+required/,
    /(secret|top\s+secret)\s+clearance/,
    /must\s+(hold|have|maintain)\s+(active\s+)?clearance/,
    /cannot\s+(provide|offer|give)\s+visa\s+sponsorship/,
    /not\s+able\s+to\s+(provide|offer|give)\s+sponsorship/,
    /unable\s+to\s+sponsor/,
    /we\s+(do\s+not|don'?t)\s+sponsor/,
    /no\s+visa\s+sponsorship/,
    /sponsorship\s+(is\s+)?not\s+(available|provided|offered)/,
    /not\s+eligible\s+for\s+sponsorship/,
    /candidates?\s+must\s+be\s+authorized\s+to\s+work\s+without\s+sponsorship/,
    /preferred:\s*able\s+to\s+work\s+without\s+sponsorship/,
  ];

  return hardReject.some(re => re.test(t));
}

// ── Scoring ────────────────────────────────────────────────────────────────

export interface ScoreInput {
  title: string;
  description: string;
  location: string;
  postedAt: string;
}

export interface ScoreResult {
  matchedSkills: string[];
  missingSkills: string[];
  skillMatchScore: number;
  recencyScore: number;
  relocationBonus: number;
  totalScore: number;
}

export function scoreJob(input: ScoreInput): ScoreResult {
  const { title, description, location, postedAt } = input;
  const text = `${title} ${description}`.toLowerCase();

  // ── Core skill gate ────────────────────────────────────────────────────
  const coreMatched = CORE_FRONTEND_SKILLS.filter(s => text.includes(s));
  if (coreMatched.length < MIN_CORE_SKILLS) {
    return {
      matchedSkills: [],
      missingSkills: EXPERT_SKILLS.slice(0, 6),
      skillMatchScore: 0,
      recencyScore: recencyScore(postedAt),
      relocationBonus: 0,
      totalScore: 0,
    };
  }

  // ── Skill matching ─────────────────────────────────────────────────────
  const matchedExpert    = EXPERT_SKILLS.filter(s => text.includes(s.toLowerCase()));
  const matchedProficient = PROFICIENT_SKILLS.filter(s => text.includes(s.toLowerCase()));

  const raw = matchedExpert.length * 3 + matchedProficient.length * 2;
  const skillMatchScore = Math.min(100, Math.round((raw / SCORE_DENOMINATOR) * 100));

  // ── Missing skills (top 6 from unmatched) ─────────────────────────────
  const matchedSet = new Set([
    ...matchedExpert.map(s => s.toLowerCase()),
    ...matchedProficient.map(s => s.toLowerCase()),
  ]);
  const missingSkills = [...EXPERT_SKILLS, ...PROFICIENT_SKILLS]
    .filter(s => !matchedSet.has(s.toLowerCase()))
    .slice(0, 6);

  // ── Recency ────────────────────────────────────────────────────────────
  const recency = recencyScore(postedAt);

  // ── Relocation bonus ───────────────────────────────────────────────────
  const relocationBonus = /relocation/.test(description.toLowerCase()) ? 10 : 0;

  // ── Total ──────────────────────────────────────────────────────────────
  const totalScore = Math.round(
    skillMatchScore * 0.6 + recency * 0.3 + relocationBonus * 0.1,
  );

  return {
    matchedSkills: [...matchedExpert, ...matchedProficient],
    missingSkills,
    skillMatchScore,
    recencyScore: recency,
    relocationBonus,
    totalScore,
  };
}

function recencyScore(postedAt: string): number {
  const ms = Date.parse(postedAt);
  if (isNaN(ms)) return 50; // unknown date → neutral
  const days = (Date.now() - ms) / 864e5;
  return Math.max(0, Math.round(100 - (days / 60) * 100));
}
