// src/lib/scoring.ts

const EXPERT_SKILLS = [
  "React", "TypeScript", "JavaScript", "Redux", "React Query",
  "Material UI", "Vite", "HTML", "CSS", "SASS", "Git",
];
const PROFICIENT_SKILLS = [
  "Next.js", "Node.js", "Express", "MongoDB", "GraphQL", "WebSocket",
  "Jest", "Vitest", "React Testing Library", "AWS", "Docker",
  "Webpack", "Sentry", "MobX",
];
const CORE_FRONTEND_SKILLS = [
  "react", "typescript", "javascript", "html", "css", "sass",
  "next.js", "vue", "angular", "redux", "react query",
  "material ui", "vite", "webpack", "svelte",
];
const MIN_CORE_SKILLS = 2;
const SCORE_DENOMINATOR = 15; // 5 expert × 3 = 100

// ── Title filters ──────────────────────────────────────────────────────────

export function isClearlyNonFrontend(title: string): boolean {
  const t = title.toLowerCase();
  return [
    /\bbackend\b/, /\bback[\s-]end\b/,
    /\bfullstack\b/, /\bfull[\s-]stack\b/,
    /\bhelpdesk\b/, /\bhelp\s+desk\b/, /\bservice\s+desk\b/,
    /\bdevops\b/, /\bsite[\s-]reliability\b/, /\bsre\b/,
    /\bdata\s+(engineer|scientist|analyst)\b/,
    /\bmachine\s+learning\s+engineer\b/,
    /\b(ai|ml)\s+engineer\b/,
    /\bmobile\s+engineer\b/, /\bios\s+engineer\b/, /\bandroid\s+engineer\b/,
    /\bplatform\s+engineer\b/,
    /\bsecurity\s+engineer\b/, /\bnetwork\s+engineer\b/,
    /\binfrastructure\s+engineer\b/, /\bembedded\s+(software|engineer)\b/,
    /\bfirmware\b/, /\bcloud\s+engineer\b/, /\bsolutions?\s+architect\b/,
    /\barchitect\b/,
    /\bproject\s+manager\b/, /\bprogram\s+manager\b/,
    /\bproduct\s+(manager|owner)\b/, /\baccount\s+manager\b/,
    /\bscrum\s+master\b/, /\boperations\s+manager\b/,
    /\bsales\s+manager\b/, /\bbusiness\s+(analyst|development)\b/,
    /\bcustomer\s+success\b/, /\bsupport\s+engineer\b/, /\bsupport\s+specialist\b/,
    /\bsolutions?\s+architect\b/, /\bimplementation\s+(consultant|engineer)\b/,
    /\btrainer\b/, /\btechnical\s+writer\b/, /\bcontent\s+(writer|manager|creator)\b/,
    /\brecruiter\b/, /\bhr\s+(manager|specialist|generalist)\b/,
    /\bfinance\s+(manager|analyst|lead)\b/, /\baccountant\b/,
    /\bmarketing\s+(manager|specialist|analyst)\b/,
    /\bquality\s+assurance\b/, /\bautomation\s+tester\b/, /\btest\s+engineer\b/,
    /\bdba\b/, /\bsysadmin\b/, /\bsystem\s+administrator\b/,
  ].some(re => re.test(t));
}

/**
 * Extra guard: "Software Engineer" with no frontend signal in title
 * but backend/infra-heavy description → reject.
 * Catches roles like Contentful "Senior Software Engineer" (storage infra team).
 */
export function isGenericTitleButBackendRole(title: string, description: string): boolean {
  const t = title.toLowerCase();
  // If title explicitly says frontend/UI, always keep
  if (/\bfrontend\b|\bfront[\s-]end\b|\bui\s+engineer\b|\bweb\s+engineer\b|\breact\s+developer\b/.test(t)) return false;
  // Only apply to generic titles
  if (!/\bsoftware\s+engineer\b|\bsoftware\s+developer\b/.test(t)) return false;

  const desc = description.toLowerCase();
  const backendSignals = [
    /\bkubernetes\b/, /\bterraform\b/, /\binfrastructure\b/,
    /\bpostgresql\b|\bpostgres\b/, /\bkafka\b/,
    /\bstorage\s+infrastructure\b/, /\bsystems?\s+engineering\b/,
    /\bsite\s+reliability\b/, /\bci\/cd\s+pipeline\b/, /\baws\s+(rds|s3|lambda)\b/,
  ];
  const hits = backendSignals.filter(re => re.test(desc)).length;
  return hits >= 3; // 3+ infra signals = backend role wearing a generic title
}

/** Rejects titles too senior for ~5 years of experience. */
export function isTooSenior(title: string): boolean {
  const t = title.toLowerCase();
  return [
    /\blead\b/, /\bprincipal\b/, /\bstaff\b/, /\bmanager\b/, /\bhead\s+of\b/,
    /\bdirector\b/, /\bvp\b/, /\bvice\s+president\b/, /\bchief\b/, /\bcto\b/, /\bcpo\b/,
    /\bdistinguished\s+engineer\b/, /\bfellow\b/,
  ].some(re => re.test(t));
}

export function requiresCitizenshipOrClearance(text: string): boolean {
  const t = text.toLowerCase();
  return [
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
    /must\s+be\s+authorized\s+to\s+work\s+without\s+sponsorship/,
    /preferred:\s*able\s+to\s+work\s+without\s+sponsorship/,
  ].some(re => re.test(t));
}

// ── Scoring ────────────────────────────────────────────────────────────────

export interface ScoreInput { title: string; description: string; location: string; postedAt: string; }
export interface ScoreResult { matchedSkills: string[]; missingSkills: string[]; skillMatchScore: number; recencyScore: number; relocationBonus: number; totalScore: number; }

export function scoreJob(input: ScoreInput): ScoreResult {
  const text = `${input.title} ${input.description}`.toLowerCase();

  const coreMatched = CORE_FRONTEND_SKILLS.filter(s => text.includes(s));
  if (coreMatched.length < MIN_CORE_SKILLS) {
    return {
      matchedSkills: [], missingSkills: EXPERT_SKILLS.slice(0, 6),
      skillMatchScore: 0, recencyScore: computeRecencyScore(input.postedAt), relocationBonus: 0, totalScore: 0
    };
  }

  const matchedExpert = EXPERT_SKILLS.filter(s => text.includes(s.toLowerCase()));
  const matchedProficient = PROFICIENT_SKILLS.filter(s => text.includes(s.toLowerCase()));
  const skillMatchScore = Math.min(100, Math.round(((matchedExpert.length * 3 + matchedProficient.length * 2) / SCORE_DENOMINATOR) * 100));

  const matchedSet = new Set([...matchedExpert, ...matchedProficient].map(s => s.toLowerCase()));
  const missingSkills = [...EXPERT_SKILLS, ...PROFICIENT_SKILLS].filter(s => !matchedSet.has(s.toLowerCase())).slice(0, 6);

  const recencyScore = computeRecencyScore(input.postedAt);
  const relocationBonus = /relocation/.test(input.description.toLowerCase()) ? 10 : 0;
  const totalScore = Math.round(skillMatchScore * 0.6 + recencyScore * 0.3 + relocationBonus * 0.1);

  return { matchedSkills: [...matchedExpert, ...matchedProficient], missingSkills, skillMatchScore, recencyScore, relocationBonus, totalScore };
}

export function computeRecencyScore(postedAt: string): number {
  const ms = Date.parse(postedAt);
  if (isNaN(ms)) return 50;
  return Math.max(0, Math.round(100 - ((Date.now() - ms) / 864e5 / 60) * 100));
}