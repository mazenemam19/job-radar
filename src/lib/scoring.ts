// src/lib/scoring.ts

// ── Skill Tiers ────────────────────────────────────────────────────────────
//
// TIER 1 — GATE: React MUST appear in title/description or job is rejected.
//          No React = not a frontend job, full stop.
//
// TIER 2 — CORE FRONTEND (scored heavily): Your actual day-to-day skills.
//          These drive the skillMatchScore and matchedSkills display.
//
// TIER 3 — BONUS (shown in UI, NOT scored): Backend/infra skills that are
//          "nice to have" but you don't want them inflating the score of a
//          job that's really a Node/AWS role with a sprinkle of React.

// ── Tier 2: Scored frontend skills ─────────────────────────────────────────
const EXPERT_SKILLS = [
  // Absolute core — you use these every day
  "React", "TypeScript", "JavaScript", "HTML", "CSS",
  // State management / data fetching
  "Redux", "React Query", "Zustand", "MobX",
  // Styling
  "Tailwind", "Material UI", "SASS",
  // Build tools
  "Next.js", "Vite", "Webpack",
];

const SECONDARY_SKILLS = [
  // Testing — you know these, good signal
  "Jest", "Vitest", "React Testing Library",
  // Other frontend
  "React Native", "GraphQL", "WebSocket", "Storybook",
];

// ── Tier 3: Bonus — shown in UI but DON'T count toward score ───────────────
export const BONUS_SKILLS = [
  "Node.js", "Express", "MongoDB", "PostgreSQL", "AWS",
  "Docker", "Git", "Redis", "Kubernetes",
];

const LOG_FILTER_REASONS = process.env.LOG_FILTER_REASONS === "true";
const DEBUG_RELAX_FRONTEND = process.env.DEBUG_RELAX_FRONTEND === "true";
const FRONTEND_BYPASS_TERMS = /\bfrontend\b|\bfront[\s-]end\b|\breact\b|\bui\b|\bjsx\b|\btypescript\b|\btsx\b/i;

// ── Gate: ALL these must match for a job to pass ───────────────────────────
// React is non-negotiable. At least 1 more frontend term also required.
const REACT_GATE = /\breact\b/;  // strict word boundary — won't match "React Native" without "react"

const CORE_FRONTEND_TERMS = [
  "react", "typescript", "javascript", "html", "css", "sass",
  "next.js", "nextjs", "redux", "react query", "react-query",
  "material ui", "vite", "webpack", "tailwind", "zustand",
];
const MIN_CORE = 2; // React counts as 1, need at least 1 more frontend term

const SCORE_DENOMINATOR = 18; // Total possible expert points for normalization

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
    /\bml[\s-]?ops\b/, /\bmlops\b/,
    /\bdatabase\s+reliability\b/, /\bdbre\b/,
    /\bdatabase\s+engineer\b/, /\bdba\b/,
    /\bsysadmin\b/, /\bsystem\s+administrator\b/,

    // ── Fullstack ─────────────────────────────────────────────────────────────
    /\bfull[\s-]?stack\b/, /\bfullstack\b/,

    // ── Mobile ────────────────────────────────────────────────────────────────
    /\bandroid\b/,
    /\bios\s+engineer\b/, /\bswift\s+developer\b/,
    /\bmobile\s+engineer\b/,
    /\bkotlin\s+(developer|engineer|multiplatform)\b/,
    /[\s,\-–]\s*kotlin\s*[\s,\-–(]/,
    /[\s,\-–]\s*java\s*[\s,\-–(]/,
    /[\s,\-–]\s*ruby\s*[\s,\-–(]/,

    // ── Data / ML ─────────────────────────────────────────────────────────────
    /\bdata\s+(engineer|scientist|analyst)\b/,
    /\bmachine\s+learning\s+engineer\b/,
    /\b(ai|ml)\s+engineer\b/,
    /\banalytics\s+analyst\b/, /\bweb\s+analytics\b/,

    // ── Non-eng ───────────────────────────────────────────────────────────────
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
    /\bmarketing\s+(manager|specialist|analyst|operations)\b/,
    /\bcompliance\s+(analyst|engineer|manager|specialist|operations)\b/,
    /\bcompliance\s+operations\b/,
    /\boperations\s+analyst\b/,
    /\bproduct\s+designer\b/, /\bux\s+(designer|researcher)\b/,
    /\bquality\s+assurance\b/, /\bautomation\s+tester\b/, /\btest\s+engineer\b/,
    /\bhardware\b/,
    /\bintern\b/,
    /\bforward\s+deployed\b/,
  ].some(re => re.test(t));
}

export function isGenericTitleButBackendRole(title: string, description: string): boolean {
  const t = title.toLowerCase();
  if (/\bfrontend\b|\bfront[\s-]end\b|\bui\s+engineer\b|\bweb\s+engineer\b|\breact\s+developer\b/.test(t)) return false;
  if (!/\bsoftware\s+engineer\b|\bsoftware\s+developer\b|\bfull[\s-]stack\b|\bfullstack\b/.test(t)) return false;

  // Explicit backend language anywhere in title (catches "React/Java", "- Kotlin", "(Fullstack) - React/Java")
  if (/\b(kotlin|java|ruby|python|go|rust|c\+\+|php|scala)\b/.test(t)) return true;

  const desc = description.toLowerCase();

  // Any fullstack title + ANY JVM/backend signal in description → reject
  const isFullstack = /\bfull[\s-]?stack\b|\bfullstack\b/.test(t);
  if (isFullstack) {
    const backendSignals = [
      /\bjvm\b/, /\bspring\s*boot\b/, /\bspring\s+framework\b/, /\bkotlin\b/,
      /\bjava\b/, /\bruby\b/, /\brails\b/, /\bpython\b/,
      /\bnode\.js\b/, /\bexpress\b/, /\bpostgresql\b|\bpostgres\b/,
      /\bmongodb\b/, /\bkafka\b/, /\bdocker\b/, /\bkubernetes\b/,
      /\bmicroservices\b/, /\brest\s+api\b/, /\bgraphql\b.*\bserver\b/,
    ];
    // Fullstack title + 2+ backend signals → reject (was requiring 1 JVM signal, now broader)
    if (backendSignals.filter(re => re.test(desc)).length >= 2) return true;
  }

  // Generic "Software Engineer" title needs stronger backend signal count
  const backendSignals = [
    /\bkubernetes\b/, /\bterraform\b/, /\binfrastructure\b/,
    /\bpostgresql\b|\bpostgres\b/, /\bkafka\b/,
    /\bsite\s+reliability\b/, /\bci\/cd\s+pipeline\b/,
    /\bspring\s*boot\b/, /\bjvm\b/, /\bdistributed\s+systems\b/,
    /\bmicroservices\b/, /\brabbitmq\b/, /\belasticsearch\b/,
    /\bbackend\s+api\b/, /\brest\s+api\b.*\bserver\b/,
  ];
  return backendSignals.filter(re => re.test(desc)).length >= 3;
}

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
    /unable\s+to\s+(provide|offer|give|support)\s+visa\s+sponsorship/,
    /we\s+are\s+unable\s+to\s+offer\s+visa/,
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
export interface ScoreResult {
  matchedSkills: string[];    // Tier 2 frontend skills found (shown as green chips)
  bonusSkills: string[];      // Tier 3 backend/infra skills found (shown as grey chips)
  missingSkills: string[];
  skillMatchScore: number;
  recencyScore: number;
  relocationBonus: number;
  totalScore: number;
}

function logFilterReason(company: string, title: string, reasonKey: string, metrics: Record<string, unknown>): void {
  if (!LOG_FILTER_REASONS) return;
  const metricsJson = JSON.stringify(metrics);
  console.log(`[filter-debug] ${company}|${title}|${reasonKey}|${metricsJson}`);
}

/**
 * Word-boundary skill match.
 * Prevents false positives: "vite" in "invite", "git" in "digital", etc.
 */
function skillMatch(text: string, skill: string): boolean {
  const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`\\b${escaped}\\b`).test(text);
}

export function scoreJob(input: ScoreInput, company?: string): ScoreResult {
  const text = `${input.title} ${input.description}`.toLowerCase();
  const companyName = company ?? "unknown";

  // ── GATE 1: React must be present ──────────────────────────────────────
  if (!REACT_GATE.test(text)) {
    logFilterReason(companyName, input.title, "missing-react", {});
    return { matchedSkills: [], bonusSkills: [], missingSkills: EXPERT_SKILLS.slice(0, 6), skillMatchScore: 0, recencyScore: computeRecencyScore(input.postedAt), relocationBonus: 0, totalScore: 0 };
  }

  // ── GATE 2: Must have React + at least 1 more frontend core term (or DEBUG_RELAX bypass) ────
  const coreMatched = CORE_FRONTEND_TERMS.filter(s => skillMatch(text, s));
  const bypassCore = DEBUG_RELAX_FRONTEND && FRONTEND_BYPASS_TERMS.test(input.title);
  if (coreMatched.length < MIN_CORE && !bypassCore) {
    logFilterReason(companyName, input.title, "core-gate", { coreMatched: coreMatched.join(",") || "none" });
    return { matchedSkills: [], bonusSkills: [], missingSkills: EXPERT_SKILLS.slice(0, 6), skillMatchScore: 0, recencyScore: computeRecencyScore(input.postedAt), relocationBonus: 0, totalScore: 0 };
  }

  // ── TIER 2: Score only frontend skills ─────────────────────────────────
  const matchedExpert    = EXPERT_SKILLS.filter(s => skillMatch(text, s.toLowerCase()));
  const matchedSecondary = SECONDARY_SKILLS.filter(s => skillMatch(text, s.toLowerCase()));

  // Expert skills worth 3pts, secondary worth 1pt. Backend skills = 0.
  const skillMatchScore = Math.min(100, Math.round(
    ((matchedExpert.length * 3 + matchedSecondary.length * 1) / SCORE_DENOMINATOR) * 100
  ));

  // ── TIER 3: Bonus skills (shown but not scored) ─────────────────────────
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
