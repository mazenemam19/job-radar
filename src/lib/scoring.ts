// src/lib/scoring.ts

const EXPERT_SKILLS = [
  "React", "TypeScript", "JavaScript", "Redux", "React Query",
  "Material UI", "Vite", "HTML", "CSS", "SASS", "Git",
];
const PROFICIENT_SKILLS = [
  "Next.js", "Node.js", "Express", "MongoDB", "GraphQL", "WebSocket",
  "Jest", "Vitest", "React Testing Library", "AWS", "Docker",
  "Webpack", "Sentry", "MobX", "Tailwind", "Zustand", "React Native",
];
// Only React-ecosystem signals — Angular/Vue/Svelte are not your stack
const CORE_FRONTEND_SKILLS = [
  "react", "typescript", "javascript", "html", "css", "sass",
  "next.js", "nextjs", "redux", "react query", "react-query",
  "material ui", "vite", "webpack", "tailwind",
];
const MIN_CORE_SKILLS = 1;
const SCORE_DENOMINATOR = 15;

// ── Title filters ──────────────────────────────────────────────────────────

export function isClearlyNonFrontend(title: string): boolean {
  const t = title.toLowerCase();
  return [
    // ── Backend / Infra ──────────────────────────────────────────────────────
    /\bbackend\b/, /\bback[\s-]end\b/,
    /\bdevops\b/, /\bdev[\s-]ops\b/,
    /\bsite[\s-]reliability\b/, /\bsre\b/,
    /\bplatform\s+engineer\b/,
    /\binfrastructure\s+engineer\b/,
    /\bcloud\s+engineer\b/,
    /\bsecurity\s+engineer\b/, /\bnetwork\s+engineer\b/,
    /\bembedded\s+(software|engineer)\b/, /\bfirmware\b/,
    /\bml[\s-]?ops\b/, /\bmlops\b/,                        // MLOps
    /\bdatabase\s+reliability\b/, /\bdbre\b/,              // Database Reliability
    /\bdatabase\s+engineer\b/, /\bdba\b/,
    /\bsysadmin\b/, /\bsystem\s+administrator\b/,

    // ── Mobile (not React Native specifically) ────────────────────────────────
    /\bandroid\b/,                                          // Android engineer / Android - KMP
    /\bios\s+engineer\b/, /\bswift\s+developer\b/,
    /\bmobile\s+engineer\b/,
    /\bkotlin\s+(developer|engineer|multiplatform)\b/,     // Kotlin dev
    /[\s,\-–]\s*kotlin\s*[\s,\-–(]/,                     // "Engineer - Kotlin" or "Engineer, Kotlin"
    /[\s,\-–]\s*java\s*[\s,\-–(]/,                       // "Engineer - Java"
    /[\s,\-–]\s*ruby\s*[\s,\-–(]/,                       // "Engineer - Ruby"

    // ── Data / ML / AI ────────────────────────────────────────────────────────
    /\bdata\s+(engineer|scientist|analyst)\b/,
    /\bmachine\s+learning\s+engineer\b/,
    /\b(ai|ml)\s+engineer\b/,
    /\banalytics\s+analyst\b/, /\bweb\s+analytics\b/,     // Analytics Analyst

    // ── Non-eng roles ─────────────────────────────────────────────────────────
    /\bproject\s+manager\b/, /\bprogram\s+manager\b/,
    /\bproduct\s+(manager|owner)\b/, /\baccount\s+manager\b/,
    /\bscrum\s+master\b/, /\boperations\s+manager\b/,
    /\bsales\s+(manager|engineer|specialist)\b/,
    /\bbusiness\s+(analyst|development)\b/,
    /\bcustomer\s+success\b/,
    /\bsupport\s+(engineer|specialist|analyst)\b/,
    /\bhelpdesk\b/, /\bhelp\s+desk\b/, /\bservice\s+desk\b/,
    /\bimplementation\s+(consultant|engineer)\b/,
    /\bsolutions?\s+architect\b/, /\barchitect\b/,
    /\btrainer\b/, /\btechnical\s+writer\b/,
    /\bcontent\s+(writer|manager|creator)\b/,
    /\brecruiter\b/, /\bhr\s+(manager|specialist|generalist)\b/,
    /\bfinance\s+(manager|analyst|lead)\b/, /\baccountant\b/,
    /\bmarketing\s+(manager|specialist|analyst|operations)\b/, // Marketing Ops
    /\bcompliance\s+(analyst|engineer|manager|specialist)\b/,  // Compliance
    /\boperations\s+analyst\b/,
    /\bquality\s+assurance\b/, /\bautomation\s+tester\b/, /\btest\s+engineer\b/,
    /\bhardware\b/,                                            // Hardware Specialist
    /\bintern\b/,                                              // Internships (5yr exp)
    /\bforward\s+deployed\b/,                                  // Forward Deployed Engineer (consulting)
  ].some(re => re.test(t));
}

/**
 * Extra guard: generic "Software Engineer" title with backend signals in description.
 * Also catches titles that name a backend language explicitly (e.g. "- Kotlin", "- Java").
 */
export function isGenericTitleButBackendRole(title: string, description: string): boolean {
  const t = title.toLowerCase();
  // Always keep explicit frontend titles
  if (/\bfrontend\b|\bfront[\s-]end\b|\bui\s+engineer\b|\bweb\s+engineer\b|\breact\s+developer\b/.test(t)) return false;
  // Only apply to generic SE/SD titles
  if (!/\bsoftware\s+engineer\b|\bsoftware\s+developer\b/.test(t)) return false;

  // If the title itself names a backend language after a dash/comma, reject immediately
  if (/[-–,]\s*(kotlin|java|ruby|python|go|rust|c\+\+|php|scala)\b/.test(t)) return true;

  const desc = description.toLowerCase();
  const backendSignals = [
    /\bkubernetes\b/, /\bterraform\b/, /\binfrastructure\b/,
    /\bpostgresql\b|\bpostgres\b/, /\bkafka\b/,
    /\bstorage\s+infrastructure\b/, /\bsystems?\s+engineering\b/,
    /\bsite\s+reliability\b/, /\bci\/cd\s+pipeline\b/, /\baws\s+(rds|s3|lambda)\b/,
    /\bspring\s*boot\b/, /\bjvm\b/, /\bdistributed\s+systems\b/,
  ];
  const hits = backendSignals.filter(re => re.test(desc)).length;
  return hits >= 3;
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