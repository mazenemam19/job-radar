// src/lib/scoring.ts

// ── Skill Tiers ────────────────────────────────────────────────────────────
const EXPERT_SKILLS = [
  "React", "TypeScript", "JavaScript", "HTML", "CSS",
  "Redux", "React Query", "Zustand", "MobX",
  "Tailwind", "Material UI", "SASS",
  "Next.js", "Vite", "Webpack",
];

const SECONDARY_SKILLS = [
  "Jest", "Vitest", "React Testing Library",
  "React Native", "GraphQL", "WebSocket", "Storybook",
];

export const BONUS_SKILLS = [
  "Node.js", "Express", "MongoDB", "PostgreSQL", "AWS",
  "Docker", "Git", "Redis", "Kubernetes",
];

// ── Gate Logic ───────────────────────────────────────────────────────────

// Accept these titles even if they don't have frontend/react explicitly
const FE_TITLE_WHITELIST = /\b(frontend|front-end|react|react\.js|reactjs|ui engineer|web engineer|product engineer|design engineer|application engineer|software engineer|software developer)\b/i;

// Mandatory tech keywords - React is a MUST
const REACT_REQUIRED = /\b(react|next\.?js)\b/i;
const TECH_GATE = /\b(react|next\.?js|typescript|javascript|tailwind|frontend|front-end)\b/i;

const SCORE_DENOMINATOR = 18;

// ── Title filters ──────────────────────────────────────────────────────────

export function isClearlyNonFrontend(title: string): boolean {
  const t = title.toLowerCase();

  // NO-GO: If title says Fullstack or Backend, it's not a pure FE role.
  if (/\bfull[\s-]?stack\b|\bfullstack\b/.test(t)) return true;
  if (/\bbackend\b|\bback[\s-]end\b/.test(t)) return true;

  // NO-GO: Explicit non-FE focus in title (e.g. Rust/C++ Software Engineer)
  if (/\b(rust|c\+\+|cpp|golang|go|python|ruby|rails|java|kotlin|php|scala|elixir)\b/.test(t)) {
    // Only reject if it doesn't also mention frontend/react in title
    if (!/\b(frontend|front-end|react)\b/i.test(t)) return true;
  }

  const rejections = [
    /\bdevops\b/, /\bdev[\s-]ops\b/,
    /\bsite[\s-]reliability\b/, /\bsre\b/,
    /\bplatform\s+engineer\b/,
    /\binfrastructure\s+engineer\b/,
    /\bcloud\s+engineer\b/,
    /\bsecurity\s+engineer\b/, /\bnetwork\s+engineer\b/,
    /\bembedded\s+(software|engineer)\b/, /\bfirmware\b/,
    /\bml[\s-]?ops\b/, /\bmlops\b/,
    /\bdatabase\s+reliability\b/, /\bdbre\b/,
    /\bdatabase\s+engineer\b/, /\bdba\b/,
    /\bsysadmin\b/, /\bsystem\s+administrator\b/,
    /\bdata\s+(engineer|scientist|analyst)\b/,
    /\bmachine\s+learning\s+engineer\b/,
    /\b(ai|ml)\s+engineer\b/,
    /\bproject\s+manager\b/, /\bprogram\s+manager\b/,
    /\bproduct\s+(manager|owner)\b/, /\baccount\s+manager\b/,
    /\bscrum\s+master\b/, /\boperations\s+manager\b/,
    /\bsales\s+(manager|engineer|specialist)\b/,
    /\bbusiness\s+(analyst|development)\b/,
    /\bcustomer\s+success\b/,
    /\bsupport\s+(engineer|specialist|analyst)\b/,
    /\bhelpdesk\b/, /\bhelp\s+desk\b/, /\bservice\s+desk\b/,
    /\brecruiter\b/, /\bhr\s+(manager|specialist|generalist)\b/,
    /\bfinance\s+(manager|analyst|lead)\b/, /\baccountant\b/,
    /\bmarketing\s+(manager|specialist|analyst|operations)\b/,
    /\bcompliance\s+(analyst|engineer|manager|specialist|operations)\b/,
    /\bproduct\s+designer\b/, /\bux\s+(designer|researcher)\b/,
    /\bquality\s+assurance\b/, /\bautomation\s+tester\b/, /\btest\s+engineer\b/,
    /\bhardware\b/, /\bintern\b/,
  ];

  if (rejections.some(re => re.test(t))) return true;

  // Pass if it fits the whitelist
  return !FE_TITLE_WHITELIST.test(t);
}

export function isGenericTitleButBackendRole(title: string, description: string): boolean {
  const t = title.toLowerCase();
  const desc = description.toLowerCase();

  // Rejection if description explicitly says Fullstack noise
  if (/\bfull[\s-]?stack\b|\bfullstack\b/.test(desc)) return true;

  // If title has "Frontend" or "React", it's a safe pass
  if (/\b(frontend|front-end|react)\b/i.test(t)) return false;

  // React is a MUST for generic titles
  if (!REACT_REQUIRED.test(desc)) return true;

  const backendSignals = [
    /\bkubernetes\b/, /\bterraform\b/, /\binfrastructure\b/,
    /\bpostgresql\b|\bpostgres\b/, /\bkafka\b/,
    /\bsite\s+reliability\b/, /\bci\/cd\s+pipeline\b/,
    /\bspring\s*boot\b/, /\bjvm\b/, /\bdistributed\s+systems\b/,
    /\bmicroservices\b/, /\brabbitmq\b/, /\belasticsearch\b/,
    /\bbackend\s+api\b/, /\brest\s+api\b/,
  ];

  const feSignals = [
    /\breact\b/, /\bnext\.?js\b/, /\btypescript\b/, /\bjavascript\b/,
    /\btailwind\b/, /\bcss\b/, /\bhtml\b/,
  ];

  const bCount = backendSignals.filter(re => re.test(desc)).length;
  const fCount = feSignals.filter(re => re.test(desc)).length;

  // Lenient check: only reject if backend is dominant (4+ signals AND backend > frontend)
  if (bCount >= 4 && bCount > fCount) return true;

  return false;
}

export function requiresCitizenshipOrClearance(text: string): boolean {
  const t = text.toLowerCase();
  return [
    /must\s+be\s+a?\s*(us|uk|eu|canadian|australian)?\s*citizen/,
    /citizenship\s+required/,
    /security\s+clearance\s+required/,
    /cannot\s+(provide|offer|give)\s+visa\s+sponsorship/,
    /unable\s+to\s+(provide|offer|give|support)\s+visa\s+sponsorship/,
    /we\s+are\s+unable\s+to\s+offer\s+visa/,
    /not\s+ able\s+to\s+(provide|offer|give)\s+sponsorship/,
    /unable\s+to\s+sponsor/,
    /we\s+(do\s+not|don'?t)\s+sponsor/,
    /no\s+visa\s+sponsorship/,
  ].some(re => re.test(t));
}

export function isTooSenior(title: string): boolean {
  const t = title.toLowerCase();
  return [
    /\blead\b/, /\bprincipal\b/, /\bstaff\b/, /\bmanager\b/, /\bhead\s+of\b/,
    /\bdirector\b/, /\bvp\b/, /\bvice\s+president\b/, /\bchief\b/, /\bcto\b/, /\bcpo\b/,
  ].some(re => re.test(t));
}

// ── Scoring ────────────────────────────────────────────────────────────────

export interface ScoreInput { title: string; description: string; location: string; postedAt: string; }
export interface ScoreResult {
  matchedSkills: string[];
  bonusSkills: string[];
  missingSkills: string[];
  skillMatchScore: number;
  recencyScore: number;
  relocationBonus: number;
  totalScore: number;
}

function skillMatch(text: string, skill: string): boolean {
  const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`\\b${escaped}\\b`).test(text);
}

export function scoreJob(input: ScoreInput, company?: string): ScoreResult {
  const text = `${input.title} ${input.description}`.toLowerCase();
  const companyName = company ?? "unknown";

  // ── GATE: Tech Signal Check ─────────────────────────────────────────────
  // React is now strictly required for all roles
  if (!REACT_REQUIRED.test(text)) {
    if (process.env.LOG_FILTER_REASONS === 'true') {
      console.log(`[filter-debug] ${companyName} | ${input.title} | rejected: missing-react`);
    }
    return { matchedSkills: [], bonusSkills: [], missingSkills: EXPERT_SKILLS.slice(0, 6), skillMatchScore: 0, recencyScore: 0, relocationBonus: 0, totalScore: 0 };
  }

  const matchedExpert    = EXPERT_SKILLS.filter(s => skillMatch(text, s.toLowerCase()));
  const matchedSecondary = SECONDARY_SKILLS.filter(s => skillMatch(text, s.toLowerCase()));

  let skillMatchScore = Math.min(100, Math.round(
    ((matchedExpert.length * 3 + matchedSecondary.length * 1) / SCORE_DENOMINATOR) * 100
  ));

  if (/\b(frontend|front-end|react)\b/i.test(input.title)) {
    skillMatchScore = Math.min(100, skillMatchScore + 20);
  }

  // Threshold lowered to 5% to capture all React roles
  if (skillMatchScore < 5) {
    if (process.env.LOG_FILTER_REASONS === 'true') {
      console.log(`[filter-debug] ${companyName} | ${input.title} | rejected: low-skill-match (${skillMatchScore})`);
    }
    return { matchedSkills: [], bonusSkills: [], missingSkills: EXPERT_SKILLS.slice(0, 6), skillMatchScore: 0, recencyScore: 0, relocationBonus: 0, totalScore: 0 };
  }

  const bonusSkills = BONUS_SKILLS.filter(s => skillMatch(text, s.toLowerCase()));
  const matchedSet = new Set([...matchedExpert, ...matchedSecondary].map(s => s.toLowerCase()));
  const missingSkills = EXPERT_SKILLS.filter(s => !matchedSet.has(s.toLowerCase())).slice(0, 6);

  const recencyScore = computeRecencyScore(input.postedAt);
  const relocationBonus = /\brelocation\b/.test(input.description.toLowerCase()) ? 10 : 0;
  const totalScore = Math.round(skillMatchScore * 0.6 + recencyScore * 0.3 + relocationBonus * 0.1);

  return { matchedSkills: [...matchedExpert, ...matchedSecondary], bonusSkills, missingSkills, skillMatchScore, recencyScore, relocationBonus, totalScore };
}

export function computeRecencyScore(postedAt: string): number {
  const ms = Date.parse(postedAt);
  if (isNaN(ms)) return 50;
  return Math.max(0, Math.round(100 - ((Date.now() - ms) / 864e5 / 7) * 100));
}
