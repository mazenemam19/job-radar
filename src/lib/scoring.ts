import { Job } from "./types";

export interface SkillConfig {
  name: string;
  weight: number;
  aliases: string[];
}

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
  const keywords = ["relocation package", "relocation assistance", "relocation support", "we cover relocation", "relocation bonus", "relocation stipend"];
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
