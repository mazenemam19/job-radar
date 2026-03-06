// src/lib/constants.ts

export const SKILL_REGISTRY: Record<string, { aliases: string[]; category: string }> = {
  // Frontend Frameworks & UI
  React: { aliases: ["react.js", "reactjs", "react js", "react"], category: "frontend" },
  "Next.js": { aliases: ["nextjs", "next.js", "next js"], category: "frontend" },
  Vue: { aliases: ["vue.js", "vuejs", "vue 3", "vue 2"], category: "frontend" },
  Angular: {
    aliases: ["angularjs", "angular 2+", "angular 10", "angular 12"],
    category: "frontend",
  },
  Svelte: { aliases: ["sveltekit", "svelte.js"], category: "frontend" },
  Remix: { aliases: ["remix.run", "remix-run"], category: "frontend" },
  Astro: { aliases: ["astro.build"], category: "frontend" },
  Solid: { aliases: ["solidjs", "solid.js"], category: "frontend" },

  // Mobile
  "React Native": { aliases: ["react-native", "rn"], category: "mobile" },
  Flutter: { aliases: [], category: "mobile" },
  Ionic: { aliases: [], category: "mobile" },
  Swift: { aliases: ["swiftui"], category: "mobile" },
  Kotlin: { aliases: ["android development"], category: "mobile" },

  // Languages
  TypeScript: { aliases: ["ts", "tsx"], category: "language" },
  JavaScript: {
    aliases: ["js", "es6", "es2015", "ecmascript", "javascript.js"],
    category: "language",
  },
  Python: { aliases: ["django", "flask", "fastapi"], category: "language" },
  Go: { aliases: ["golang"], category: "language" },
  Rust: { aliases: ["rs"], category: "language" },
  Java: { aliases: ["spring boot", "jvm"], category: "language" },
  "C++": { aliases: ["cpp", "cplusplus"], category: "language" },
  Ruby: { aliases: ["rails", "ruby on rails"], category: "language" },
  PHP: { aliases: ["laravel", "symfony"], category: "language" },

  // Styling & UI Components
  Tailwind: { aliases: ["tailwindcss", "tailwind css", "tw"], category: "styling" },
  "CSS Modules": { aliases: ["css-modules"], category: "styling" },
  "Styled Components": { aliases: ["styled-components"], category: "styling" },
  "Material UI": { aliases: ["mui", "material-ui"], category: "styling" },
  Sass: { aliases: ["scss", "syntactically awesome style sheets"], category: "styling" },
  "Radix UI": { aliases: ["radix"], category: "styling" },
  shadcn: { aliases: ["shadcn/ui", "shadcn ui"], category: "styling" },
  Chakra: { aliases: ["chakra-ui", "chakra ui"], category: "styling" },
  Ant: { aliases: ["ant-design", "antd"], category: "styling" },
  Emotion: { aliases: ["emotion.js"], category: "styling" },

  // State Management
  Redux: { aliases: ["redux toolkit", "rtk", "react-redux"], category: "state" },
  Zustand: { aliases: [], category: "state" },
  Jotai: { aliases: [], category: "state" },
  MobX: { aliases: ["mobx-state-tree"], category: "state" },
  "React Query": {
    aliases: ["react-query", "tanstack query", "@tanstack/react-query", "tanstack-query"],
    category: "state",
  },
  Recoil: { aliases: [], category: "state" },
  SWR: { aliases: ["stale-while-revalidate"], category: "state" },
  XState: { aliases: ["finite state machine"], category: "state" },

  // Testing
  Jest: { aliases: [], category: "testing" },
  Vitest: { aliases: [], category: "testing" },
  Cypress: { aliases: [], category: "testing" },
  Playwright: { aliases: [], category: "testing" },
  "Testing Library": {
    aliases: ["@testing-library", "react testing library", "rtl"],
    category: "testing",
  },
  Storybook: { aliases: [], category: "testing" },
  Selenium: { aliases: [], category: "testing" },
  Puppeteer: { aliases: [], category: "testing" },

  // Tooling & Build
  Vite: { aliases: [], category: "tooling" },
  Webpack: { aliases: [], category: "tooling" },
  Turbopack: { aliases: [], category: "tooling" },
  Turborepo: { aliases: ["turbo.build"], category: "tooling" },
  Rollup: { aliases: [], category: "tooling" },
  Babel: { aliases: [], category: "tooling" },
  ESLint: { aliases: [], category: "tooling" },
  Prettier: { aliases: [], category: "tooling" },

  // Backend & API
  "Node.js": { aliases: ["nodejs", "node js"], category: "backend" },
  GraphQL: { aliases: ["gql", "apollo", "relay"], category: "backend" },
  REST: { aliases: ["restful", "rest api", "json api"], category: "backend" },
  tRPC: { aliases: [], category: "backend" },
  NestJS: { aliases: ["nest.js"], category: "backend" },
  Express: { aliases: ["express.js"], category: "backend" },
  Prisma: { aliases: ["orm"], category: "backend" },
  Supabase: { aliases: [], category: "backend" },
  Firebase: { aliases: ["firestore"], category: "backend" },
  Postman: { aliases: ["swagger"], category: "backend" },

  // Cloud & DevOps
  AWS: { aliases: ["amazon web services", "s3", "lambda", "ec2"], category: "cloud" },
  GCP: { aliases: ["google cloud", "google cloud platform"], category: "cloud" },
  Azure: { aliases: ["microsoft azure"], category: "cloud" },
  Docker: { aliases: ["containerization"], category: "cloud" },
  Kubernetes: { aliases: ["k8s", "helm"], category: "cloud" },
  "CI/CD": {
    aliases: ["github actions", "gitlab ci", "jenkins", "circleci", "vercel"],
    category: "cloud",
  },
  Terraform: { aliases: ["infrastructure as code"], category: "cloud" },
  Netlify: { aliases: [], category: "cloud" },

  // Database
  PostgreSQL: { aliases: ["postgres", "postgresql.org"], category: "database" },
  MongoDB: { aliases: ["mongo", "mongoose"], category: "database" },
  Redis: { aliases: [], category: "database" },
  MySQL: { aliases: [], category: "database" },
  SQLite: { aliases: [], category: "database" },
  DynamoDB: { aliases: [], category: "database" },

  // Concepts & Architecture
  Accessibility: { aliases: ["a11y", "wcag", "aria", "screen readers"], category: "concept" },
  i18n: {
    aliases: ["internationalization", "l10n", "localization", "react-i1next"],
    category: "concept",
  },
  "Micro-frontends": {
    aliases: ["microfrontend", "micro frontend", "module federation"],
    category: "concept",
  },
  "Web Performance": {
    aliases: ["core web vitals", "cwv", "lighthouse", "optimization", "ssr", "ssg", "isr"],
    category: "concept",
  },
  WebSockets: { aliases: ["websocket", "ws", "socket.io"], category: "concept" },
  PWA: { aliases: ["progressive web app"], category: "concept" },
  OAuth: { aliases: ["auth0", "jwt", "authentication", "clerk"], category: "concept" },
  Serverless: { aliases: ["lambda", "edge functions"], category: "concept" },

  // Tools & Process
  Figma: { aliases: ["adobe xd", "sketch"], category: "design" },
  Agile: { aliases: ["scrum", "kanban", "sprint", "jira"], category: "process" },
  Git: { aliases: ["github", "gitlab", "bitbucket"], category: "process" },
  Linux: { aliases: ["unix", "bash", "shell"], category: "process" },
};

export const CATEGORY_COLORS: Record<string, string> = {
  frontend: "#6366f1",
  language: "#3b82f6",
  mobile: "#a855f7",
  styling: "#ec4899",
  state: "#8b5cf6",
  testing: "#f97316",
  tooling: "#64748b",
  backend: "#10b981",
  cloud: "#0ea5e9",
  database: "#f43f5e",
  concept: "#14b8a6",
  design: "#eab308",
  process: "#84cc16",
};

// ── Personal Skill Set ───────────────────────────────────────────────────
export const PERSONAL_SKILLS = new Set([
  "React",
  "TypeScript",
  "JavaScript",
  "HTML",
  "CSS",
  "Redux",
  "React Query",
  "Zustand",
  "MobX",
  "Tailwind",
  "Material UI",
  "Sass",
  "Next.js",
  "Vite",
  "Webpack",
  "Jest",
  "Vitest",
  "Testing Library",
  "React Native",
  "GraphQL",
  "WebSockets",
  "Storybook",
  "Node.js",
  "Express",
  "MongoDB",
  "PostgreSQL",
  "AWS",
  "Docker",
  "Git",
  "Redis",
  "Kubernetes",
]);

// ── Skill Tiers for Scoring ──────────────────────────────────────────────
export const EXPERT_SKILLS = [
  "React",
  "TypeScript",
  "JavaScript",
  "HTML",
  "CSS",
  "Redux",
  "React Query",
  "Zustand",
  "MobX",
  "Tailwind",
  "Material UI",
  "Sass",
  "Next.js",
  "Vite",
  "Webpack",
];

export const SECONDARY_SKILLS = [
  "Jest",
  "Vitest",
  "Testing Library",
  "React Native",
  "GraphQL",
  "WebSockets",
  "Storybook",
];

export const BONUS_SKILLS = [
  "Node.js",
  "Express",
  "MongoDB",
  "PostgreSQL",
  "AWS",
  "Docker",
  "Git",
  "Redis",
  "Kubernetes",
];

// ── Seniority Logic ──────────────────────────────────────────────────────
export const SENIOR_KEYWORDS = /\bsenior|sr\b|principal|staff|lead/i;
export const JUNIOR_KEYWORDS = /\bjunior|jr|intern|entry|trainee|associate/i;

export function getSeniority(title: string): "Senior" | "Mid" | "Junior/Other" {
  const t = title.toLowerCase();
  if (SENIOR_KEYWORDS.test(t)) return "Senior";
  if (JUNIOR_KEYWORDS.test(t)) return "Junior/Other";
  return "Mid";
}

// ── Shared Constants ─────────────────────────────────────────────────────
export const COUNTRY_MAP: Record<string, { name: string; flag: string }> = {
  ireland: { name: "Ireland", flag: "🇮🇪" },
  germany: { name: "Germany", flag: "🇩🇪" },
  netherlands: { name: "Netherlands", flag: "🇳🇱" },
  "united kingdom": { name: "UK", flag: "🇬🇧" },
  uk: { name: "UK", flag: "🇬🇧" },
  london: { name: "UK", flag: "🇬🇧" },
  berlin: { name: "Germany", flag: "🇩🇪" },
  amsterdam: { name: "Netherlands", flag: "🇳🇱" },
  dublin: { name: "Ireland", flag: "🇮🇪" },
  spain: { name: "Spain", flag: "🇪🇸" },
  barcelona: { name: "Spain", flag: "🇪🇸" },
  madrid: { name: "Spain", flag: "🇪🇸" },
  portugal: { name: "Portugal", flag: "🇵🇹" },
  lisbon: { name: "Portugal", flag: "🇵🇹" },
  france: { name: "France", flag: "🇫🇷" },
  paris: { name: "France", flag: "🇫🇷" },
  sweden: { name: "Sweden", flag: "🇸🇪" },
  stockholm: { name: "Sweden", flag: "🇸🇪" },
  denmark: { name: "Denmark", flag: "🇩🇰" },
  copenhagen: { name: "Denmark", flag: "🇩🇰" },
  finland: { name: "Finland", flag: "🇫🇮" },
  helsinki: { name: "Finland", flag: "🇫🇮" },
  poland: { name: "Poland", flag: "🇵🇱" },
  warsaw: { name: "Poland", flag: "🇵🇱" },
  usa: { name: "USA", flag: "🇺🇸" },
  "united states": { name: "USA", flag: "🇺🇸" },
  egypt: { name: "Egypt", flag: "🇪🇬" },
  cairo: { name: "Egypt", flag: "🇪🇬" },
  "saudi arabia": { name: "Saudi Arabia", flag: "🇸🇦" },
  "united arab emirates": { name: "UAE", flag: "🇦🇪" },
  uae: { name: "UAE", flag: "🇦🇪" },
  dubai: { name: "UAE", flag: "🇦🇪" },
  riyadh: { name: "Saudi Arabia", flag: "🇸🇦" },
  remote: { name: "Remote", flag: "🌍" },
};

export function computeRecencyScore(postedAt: string): number {
  const ms = Date.parse(postedAt);
  if (isNaN(ms)) return 50;
  return Math.max(0, Math.round(100 - ((Date.now() - ms) / 864e5 / 7) * 100));
}

export const STATUS_COLORS: Record<string, string> = {
  error: "#fb7185",
  healthy: "#4ade80",
  warning: "#fbbf24",
  nomatch: "#dde1f0",
  skipped: "#93c5fd",
};

export const STATUS_LABELS: Record<string, string> = {
  error: "Failed",
  healthy: "Active",
  warning: "Empty",
  nomatch: "Filtered",
  skipped: "Skipped",
};
