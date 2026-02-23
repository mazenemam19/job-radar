export interface SkillConfig {
  name: string;
  weight: number;
  aliases: string[];
}

// Skills that define a frontend developer — at least one must match
export const CORE_FRONTEND_SKILLS = new Set([
  "React",
  "TypeScript",
  "JavaScript",
  "HTML",
  "CSS",
  "SASS",
  "Next.js",
  "Vue",
  "Angular",
  "Redux",
  "React Query",
  "Material UI",
  "Vite",
  "Webpack",
  "Svelte",
]);

export const SKILLS: SkillConfig[] = [
  // Expert (weight 3)
  { name: "React", weight: 3, aliases: ["react.js", "reactjs"] },
  { name: "TypeScript", weight: 3, aliases: ["ts"] },
  { name: "JavaScript", weight: 3, aliases: ["js", "es6", "es2015", "ecmascript"] },
  { name: "Redux", weight: 3, aliases: ["redux toolkit", "redux-toolkit", "@reduxjs/toolkit"] },
  { name: "React Query", weight: 3, aliases: ["tanstack query", "react-query", "@tanstack/react-query"] },
  { name: "Material UI", weight: 3, aliases: ["mui", "material-ui", "@mui"] },
  { name: "Vite", weight: 3, aliases: [] },
  { name: "HTML", weight: 3, aliases: ["html5"] },
  { name: "CSS", weight: 3, aliases: ["css3"] },
  { name: "SASS", weight: 3, aliases: ["scss", "sass"] },
  { name: "Git", weight: 3, aliases: ["github", "gitlab"] },
  // Proficient (weight 2)
  { name: "Next.js", weight: 2, aliases: ["nextjs", "next js"] },
  { name: "Node.js", weight: 2, aliases: ["nodejs", "node"] },
  { name: "Express", weight: 2, aliases: ["expressjs", "express.js"] },
  { name: "MongoDB", weight: 2, aliases: ["mongo"] },
  { name: "GraphQL", weight: 2, aliases: ["gql"] },
  { name: "WebSocket", weight: 2, aliases: ["stomp", "websockets", "socket.io"] },
  { name: "Jest", weight: 2, aliases: [] },
  { name: "Vitest", weight: 2, aliases: [] },
  { name: "React Testing Library", weight: 2, aliases: ["testing-library", "@testing-library"] },
  { name: "AWS", weight: 2, aliases: ["amazon web services", "s3", "ec2", "lambda"] },
  { name: "Docker", weight: 2, aliases: ["dockerfile", "docker-compose"] },
  { name: "Webpack", weight: 2, aliases: [] },
  { name: "Sentry", weight: 2, aliases: [] },
  { name: "MobX", weight: 2, aliases: ["mobx-state-tree"] },
];

const MAX_POSSIBLE_SCORE = SKILLS.reduce((sum, s) => sum + s.weight, 0);

export function computeSkillMatch(description: string): {
  matchedSkills: string[];
  missingSkills: string[];
  skillMatchScore: number;
} {
  const lower = description.toLowerCase();
  const matched: SkillConfig[] = [];
  const missing: SkillConfig[] = [];

  for (const skill of SKILLS) {
    const terms = [skill.name.toLowerCase(), ...skill.aliases.map((a) => a.toLowerCase())];
    const found = terms.some((term) => {
      // Word boundary check
      const re = new RegExp(`(?<![a-z0-9])${escapeRegex(term)}(?![a-z0-9])`, "i");
      return re.test(lower);
    });
    if (found) matched.push(skill);
    else missing.push(skill);
  }

  const matchedWeight = matched.reduce((s, sk) => s + sk.weight, 0);
  const skillMatchScore = Math.round((matchedWeight / MAX_POSSIBLE_SCORE) * 100);

  return {
    matchedSkills: matched.map((s) => s.name),
    missingSkills: missing.map((s) => s.name),
    skillMatchScore,
  };
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function computeRecencyScore(postedAt: string): number {
  const posted = new Date(postedAt).getTime();
  const now = Date.now();
  const diffDays = (now - posted) / (1000 * 60 * 60 * 24);
  if (diffDays <= 0) return 100;
  if (diffDays >= 60) return 0;
  return Math.round(((60 - diffDays) / 60) * 100);
}

export function computeRelocationBonus(description: string): number {
  const lower = description.toLowerCase();
  const keywords = [
    "relocation package",
    "relocation assistance",
    "relocation support",
    "we cover relocation",
    "relocation bonus",
    "relocation stipend",
  ];
  return keywords.some((kw) => lower.includes(kw)) ? 10 : 0;
}

export function computeTotalScore(skillMatchScore: number, recencyScore: number, relocationBonus: number): number {
  return Math.round(skillMatchScore * 0.6 + recencyScore * 0.3 + relocationBonus * 0.1);
}

const CITIZENSHIP_PATTERNS = [
  /citizenship required/i,
  /security clearance required/i,
  /must be a citizen/i,
  /must hold citizenship/i,
  /require.{0,20}citizenship/i,
  /active.{0,10}clearance/i,
];

export function requiresCitizenshipOrClearance(text: string): boolean {
  return CITIZENSHIP_PATTERNS.some((re) => re.test(text));
}

export function getCountryFromLocation(location: string): { country: string; flag: string } {
  const loc = location.toLowerCase();
  const map: Array<[RegExp, string, string]> = [
    [/\bgermany\b|deutschland|\bde\b/, "Germany", "🇩🇪"],
    [/\bnether|amsterdam|rotterdam/, "Netherlands", "🇳🇱"],
    [/\buk\b|united kingdom|london|england|scotland/, "UK", "🇬🇧"],
    [/\bcanada\b|toronto|vancouver|montreal/, "Canada", "🇨🇦"],
    [/\busa\b|united states|new york|san francisco|seattle|austin|boston/, "USA", "🇺🇸"],
    [/\baustralia\b|sydney|melbourne|brisbane/, "Australia", "🇦🇺"],
    [/\bsweden\b|stockholm/, "Sweden", "🇸🇪"],
    [/\bdenmark\b|copenhagen/, "Denmark", "🇩🇰"],
    [/\bfinland\b|helsinki/, "Finland", "🇫🇮"],
    [/\bspain\b|madrid|barcelona/, "Spain", "🇪🇸"],
    [/\bfrance\b|paris/, "France", "🇫🇷"],
    [/\bitaly\b|milan|rome/, "Italy", "🇮🇹"],
    [/\bswitzerland\b|zurich|geneva/, "Switzerland", "🇨🇭"],
    [/\baustria\b|vienna|wien/, "Austria", "🇦🇹"],
    [/\bpoland\b|warsaw|krakow/, "Poland", "🇵🇱"],
    [/\bportugal\b|lisbon/, "Portugal", "🇵🇹"],
    [/\bireland\b|dublin/, "Ireland", "🇮🇪"],
    [/\bnorway\b|oslo/, "Norway", "🇳🇴"],
    [/\bbelgium\b|brussels/, "Belgium", "🇧🇪"],
    [/\bczech\b|prague/, "Czech Republic", "🇨🇿"],
    [/\bremote\b/, "Remote", "🌍"],
  ];

  for (const [re, country, flag] of map) {
    if (re.test(loc)) return { country, flag };
  }
  return { country: location || "Unknown", flag: "🌐" };
}

// Minimum number of CORE frontend skills that must match for a job to pass
export const MIN_CORE_SKILLS_REQUIRED = 2;

// Job titles that are clearly non-frontend — reject regardless of skill overlap
const NON_FRONTEND_TITLE_PATTERNS = [
  /\b(backend|back-end|back end)\b/i,
  /\b(devops|dev-ops|sre|site reliability)\b/i,
  /\b(data engineer|data scientist|ml engineer|machine learning)\b/i,
  /\b(ai engineer|llm engineer|ai developer)\b/i,
  /\b(android|ios|mobile)\s+(engineer|developer)\b/i,
  /\b(python|java|golang|go|rust|ruby|php|c\+\+|\.net)\s+(engineer|developer)\b/i,
  /\b(infrastructure|platform)\s+engineer\b/i,
  /\b(security|network)\s+engineer\b/i,
  /\bdentist\b|\bnurse\b|\bdoctor\b|\bphysician\b/i,
  // Staff/principal engineers with AI, data, ops, or cloud context but no frontend keyword
  /staff\s+engineer.{0,60}(ai|ml|data|ops|cloud|infra|platform)/i,
  /(ai|ml|data|ops|cloud|infra|platform).{0,60}staff\s+engineer/i,
];

// Frontend-positive title keywords — if title has none of these, require stronger skill signal
const FRONTEND_TITLE_KEYWORDS = [
  /\b(front.?end|ui|ux|react|angular|vue|web|javascript|typescript|css|html)\b/i,
  /\bfull.?stack\b/i,
  /\bsoftware\s+(engineer|developer)\b/i, // generic — allowed if skills match
];

export function isClearlyNonFrontend(title: string): boolean {
  return NON_FRONTEND_TITLE_PATTERNS.some((re) => re.test(title));
}

export function hasFrontendTitleSignal(title: string): boolean {
  return FRONTEND_TITLE_KEYWORDS.some((re) => re.test(title));
}

/**
 * Central pass/fail gate for a job. Returns null if job passes, or a string
 * reason if it should be dropped. Call this AFTER visa + citizenship checks.
 */
export function getFilterFailReason(title: string, matchedSkills: string[]): string | null {
  // 1. Title is clearly a non-frontend role
  if (isClearlyNonFrontend(title)) {
    return `non-frontend title: "${title}"`;
  }

  // 2. Must match at least MIN_CORE_SKILLS_REQUIRED core frontend skills
  const coreMatches = matchedSkills.filter((s) => CORE_FRONTEND_SKILLS.has(s));
  if (coreMatches.length < MIN_CORE_SKILLS_REQUIRED) {
    return `only ${
      coreMatches.length
    } core frontend skills matched (need ${MIN_CORE_SKILLS_REQUIRED}): ${matchedSkills.join(", ")}`;
  }

  // 3. No matched skills at all (belt + suspenders)
  if (matchedSkills.length === 0) {
    return "no skill match";
  }

  return null;
}
