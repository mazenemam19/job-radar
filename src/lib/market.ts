// src/lib/market.ts
import { readStore, readRawStore } from "@/lib/storage";

// ── Skill Registry ──────────────────────────────────────────────────────────
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

// ── Your Personal Skill Set ──────────────────────────────────────────────────
const PERSONAL_SKILLS = new Set([
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
  "SASS",
  "Next.js",
  "Vite",
  "Webpack",
  "Jest",
  "Vitest",
  "React Testing Library",
  "React Native",
  "GraphQL",
  "WebSocket",
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

export interface MarketAnalysis {
  meta: {
    generatedAt: string;
    totalJobs: number;
    jobsPassingFilter: number;
    filterRate: number;
    uniqueSkillsFound: number;
  };
  skillFrequency: Array<{
    skill: string;
    category: string;
    count: number;
    percentage: number;
    inYourSkillSet: boolean;
  }>;
  yourSkillsMarketDemand: Array<{
    skill: string;
    count: number;
    percentage: number;
    marketStrength: "strong" | "moderate" | "weak";
  }>;
  marketSkillGaps: Array<{
    skill: string;
    category: string;
    count: number;
    percentage: number;
    trending: boolean;
  }>;
  pipelineBreakdown: {
    visa: { total: number; topSkills: Array<{ skill: string; count: number }> };
    local: { total: number; topSkills: Array<{ skill: string; count: number }> };
    global: { total: number; topSkills: Array<{ skill: string; count: number }> };
  };
  scoreDistribution: Array<{ bucket: string; count: number }>;
  seniorityBreakdown: Array<{ level: string; count: number }>;
  topCompanies: Array<{ company: string; count: number; pipeline: string }>;
  remoteSignals: { remote: number; hybrid: number; onSite: number; relocation: number };
  postingDayBreakdown: Array<{ day: string; count: number }>;
  coOccurrence: Array<{ skillA: string; skillB: string; count: number }>;
  insights: string[];
}

export async function computeMarketAnalysis(): Promise<MarketAnalysis | null> {
  const approvedStore = await readStore();
  const rawJobs = await readRawStore();

  if (rawJobs.length === 0) return null;

  const totalJobs = rawJobs.length;
  const approvedIds = new Set(approvedStore.jobs.map((j) => j.id));

  const skillCounts: Record<string, number> = {};
  const pipelineSkills: Record<string, Record<string, number>> = {
    visa: {},
    local: {},
    global: {},
  };
  const coOccur: Record<string, number> = {};
  const companyCounts: Record<string, { count: number; pipeline: string }> = {};
  const dayCounts: Record<string, number> = {
    Monday: 0,
    Tuesday: 0,
    Wednesday: 0,
    Thursday: 0,
    Friday: 0,
    Saturday: 0,
    Sunday: 0,
  };
  const buckets = ["0-20", "21-40", "41-60", "61-80", "81-100"];
  const scoreBuckets: Record<string, number> = Object.fromEntries(buckets.map((b) => [b, 0]));
  const remoteSignals = { remote: 0, hybrid: 0, onSite: 0, relocation: 0 };
  const seniority: Record<string, number> = { Senior: 0, Mid: 0, "Junior/Other": 0 };

  rawJobs.forEach((job) => {
    const text = (job.title + " " + job.description).toLowerCase();
    const skillsInJob: string[] = [];

    Object.entries(SKILL_REGISTRY).forEach(([skill, config]) => {
      const searchTerms = [skill, ...config.aliases];
      const found = searchTerms.some((term) => {
        const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
        return new RegExp(`\\b${escaped}\\b`, "i").test(text);
      });

      if (found) {
        skillCounts[skill] = (skillCounts[skill] || 0) + 1;
        pipelineSkills[job.mode][skill] = (pipelineSkills[job.mode][skill] || 0) + 1;
        skillsInJob.push(skill);
      }
    });

    skillsInJob.forEach((sA, i) => {
      skillsInJob.slice(i + 1).forEach((sB) => {
        const pair = [sA, sB].sort().join("|");
        coOccur[pair] = (coOccur[pair] || 0) + 1;
      });
    });

    // Score distribution (Use the score already in the raw job object if present)
    const score = job.totalScore || 0;
    if (score <= 20) scoreBuckets["0-20"]++;
    else if (score <= 40) scoreBuckets["21-40"]++;
    else if (score <= 60) scoreBuckets["41-60"]++;
    else if (score <= 80) scoreBuckets["61-80"]++;
    else scoreBuckets["81-100"]++;

    const title = job.title.toLowerCase();
    if (/\bsenior|sr\b|principal|staff|lead/i.test(title)) seniority["Senior"]++;
    else if (/\bjunior|jr|intern|entry|trainee|associate/i.test(title)) seniority["Junior/Other"]++;
    else seniority["Mid"]++;

    if (!companyCounts[job.company]) companyCounts[job.company] = { count: 0, pipeline: job.mode };
    companyCounts[job.company].count++;

    if (job.isRemote) remoteSignals.remote++;
    if (/\bhybrid\b/i.test(text)) remoteSignals.hybrid++;
    if (/\bonsite|on-site|in-office\b/i.test(text)) remoteSignals.onSite++;
    if (job.visaSponsorship || /\brelocation\b/i.test(text)) remoteSignals.relocation++;

    try {
      const day = new Date(job.postedAt).toLocaleDateString("en-US", { weekday: "long" });
      if (dayCounts[day] !== undefined) dayCounts[day]++;
    } catch {}
  });

  const skillFrequency = Object.entries(skillCounts)
    .map(([skill, count]) => ({
      skill,
      category: SKILL_REGISTRY[skill].category,
      count,
      percentage: Math.round((count / totalJobs) * 100),
      inYourSkillSet: PERSONAL_SKILLS.has(skill),
    }))
    .sort((a, b) => b.count - a.count);

  const yourSkillsMarketDemand = skillFrequency
    .filter((s) => s.inYourSkillSet)
    .map((s) => ({
      skill: s.skill,
      count: s.count,
      percentage: s.percentage,
      marketStrength: (s.percentage > 50 ? "strong" : s.percentage > 20 ? "moderate" : "weak") as
        | "strong"
        | "moderate"
        | "weak",
    }));

  const marketSkillGaps = skillFrequency
    .filter((s) => !s.inYourSkillSet)
    .map((s) => ({
      skill: s.skill,
      category: s.category,
      count: s.count,
      percentage: s.percentage,
      trending: s.percentage > 25,
    }));

  const getTopSkills = (mode: string) =>
    Object.entries(pipelineSkills[mode])
      .map(([skill, count]) => ({ skill, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

  const insights: string[] = [];
  const topSkill = skillFrequency[0];
  if (topSkill && topSkill.inYourSkillSet && topSkill.percentage > 60) {
    insights.push(
      `Strong market alignment: **${topSkill.skill}** is the #1 requirement, appearing in ${topSkill.percentage}% of jobs.`,
    );
  }
  const biggestGap = marketSkillGaps[0];
  if (biggestGap && biggestGap.percentage > 20) {
    insights.push(
      `Learning Opportunity: **${biggestGap.skill}** is a significant gap in your profile, appearing in ${biggestGap.percentage}% of market listings.`,
    );
  }
  if (totalJobs > 0) {
    const remotePct = Math.round((remoteSignals.remote / totalJobs) * 100);
    insights.push(
      `Remote Work Stability: **${remotePct}%** of all analyzed jobs explicitly mention remote flexibility.`,
    );
  }
  const topPair = Object.entries(coOccur).sort((a, b) => b[1] - a[1])[0];
  if (topPair) {
    const [sA, sB] = topPair[0].split("|");
    insights.push(
      `Skill Bundle: **${sA}** and **${sB}** are frequently listed together, appearing in ${topPair[1]} job descriptions.`,
    );
  }
  const seniorPct = Math.round((seniority["Senior"] / totalJobs) * 100);
  insights.push(
    `Seniority Demand: **${seniorPct}%** of roles are explicitly targeting Senior-level talent.`,
  );

  const jobsPassingFilter = rawJobs.filter((j) => approvedIds.has(j.id)).length;

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      totalJobs,
      jobsPassingFilter,
      filterRate: Math.round(((totalJobs - jobsPassingFilter) / totalJobs) * 100),
      uniqueSkillsFound: Object.keys(skillCounts).length,
    },
    skillFrequency,
    yourSkillsMarketDemand,
    marketSkillGaps,
    pipelineBreakdown: {
      visa: {
        total: rawJobs.filter((j) => j.mode === "visa").length,
        topSkills: getTopSkills("visa"),
      },
      local: {
        total: rawJobs.filter((j) => j.mode === "local").length,
        topSkills: getTopSkills("local"),
      },
      global: {
        total: rawJobs.filter((j) => j.mode === "global").length,
        topSkills: getTopSkills("global"),
      },
    },
    scoreDistribution: Object.entries(scoreBuckets).map(([bucket, count]) => ({ bucket, count })),
    seniorityBreakdown: Object.entries(seniority).map(([level, count]) => ({ level, count })),
    topCompanies: Object.entries(companyCounts)
      .map(([company, data]) => ({ company, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    remoteSignals,
    postingDayBreakdown: Object.entries(dayCounts).map(([day, count]) => ({ day, count })),
    coOccurrence: Object.entries(coOccur)
      .map(([pair, count]) => {
        const [skillA, skillB] = pair.split("|");
        return { skillA, skillB, count };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 50),
    insights,
  };
}
