// ─── Your CV Profile ─────────────────────────────────────────────────────────
// This file is generated from your CV. Edit as needed to tune matching.

export interface SkillEntry {
  name: string;
  weight: number; // 1 (familiar) | 2 (proficient) | 3 (core/expert)
  aliases: string[]; // alternate names used in job descriptions
}

export const CV_PROFILE = {
  name: "Frontend Software Engineer",
  yearsOfExperience: 5,

  // ─── Job titles to search for ───────────────────────────────────────────────
  searchTitles: [
    "Frontend Engineer",
    "Frontend Developer",
    "React Developer",
    "Software Engineer Frontend",
    "UI Engineer",
    "React TypeScript Developer",
  ],

  // ─── Target countries ────────────────────────────────────────────────────────
  // Adzuna country codes: gb, us, ca, au, de, nl, fr, at, be, ch, se, no, dk
  targetCountries: [
    { code: "gb", name: "United Kingdom" },
    { code: "us", name: "United States" },
    { code: "ca", name: "Canada" },
    { code: "au", name: "Australia" },
    { code: "de", name: "Germany" },
    { code: "nl", name: "Netherlands" },
    { code: "fr", name: "France" },
    { code: "at", name: "Austria" },
    { code: "ch", name: "Switzerland" },
    { code: "pl", name: "Poland" },
    { code: "nz", name: "New Zealand" },
  ],

  // ─── Skills with weights and aliases ─────────────────────────────────────────
  // weight 3 = core/expert, 2 = proficient, 1 = familiar
  skills: [
    // ── Core (weight: 3) ──────────────────────────────────────────────────────
    { name: "React", weight: 3, aliases: ["react.js", "reactjs", "react js", "react 18"] },
    { name: "TypeScript", weight: 3, aliases: ["ts", "tsx"] },
    { name: "JavaScript", weight: 3, aliases: ["js", "es6", "es2022", "ecmascript", "vanilla js"] },
    { name: "Redux", weight: 3, aliases: ["redux toolkit", "rtk", "redux/toolkit", "@reduxjs/toolkit"] },
    {
      name: "React Query",
      weight: 3,
      aliases: ["tanstack query", "react-query", "tanstack", "@tanstack/react-query"],
    },
    { name: "Material UI", weight: 3, aliases: ["mui", "material-ui", "@mui"] },
    { name: "Vite", weight: 3, aliases: [] },
    { name: "HTML", weight: 3, aliases: ["html5"] },
    { name: "CSS", weight: 3, aliases: ["css3", "css-in-js"] },
    { name: "SASS", weight: 3, aliases: ["scss", "sass/scss"] },
    { name: "Bootstrap", weight: 3, aliases: [] },
    { name: "Git", weight: 3, aliases: ["github", "gitlab", "version control"] },

    // ── Proficient (weight: 2) ────────────────────────────────────────────────
    { name: "Next.js", weight: 2, aliases: ["nextjs", "next js"] },
    { name: "Node.js", weight: 2, aliases: ["nodejs", "node js"] },
    { name: "Express", weight: 2, aliases: ["express.js", "expressjs"] },
    { name: "MongoDB", weight: 2, aliases: ["mongoose"] },
    { name: "GraphQL", weight: 2, aliases: ["apollo", "apollo client"] },
    { name: "WebSocket", weight: 2, aliases: ["websockets", "stomp", "sockjs", "socket.io", "ws"] },
    { name: "MobX", weight: 2, aliases: [] },
    { name: "Sentry", weight: 2, aliases: [] },
    { name: "Jest", weight: 2, aliases: [] },
    { name: "Vitest", weight: 2, aliases: [] },
    { name: "React Testing Library", weight: 2, aliases: ["@testing-library/react", "rtl"] },
    { name: "AWS", weight: 2, aliases: ["amazon web services", "s3", "lambda", "ec2"] },
    { name: "Docker", weight: 2, aliases: ["containerization", "containers"] },
    { name: "Webpack", weight: 2, aliases: [] },

    // ── Bonus soft-skills / practices frequently in JDs ──────────────────────
    { name: "i18n", weight: 1, aliases: ["internationalization", "localization", "l10n"] },
    { name: "ESLint", weight: 1, aliases: ["eslint", "linting"] },
    { name: "CI/CD", weight: 1, aliases: ["continuous integration", "pipelines", "github actions"] },
    { name: "Agile", weight: 1, aliases: ["scrum", "kanban", "sprint"] },
    { name: "REST API", weight: 1, aliases: ["rest", "restful", "api integration"] },
  ] as SkillEntry[],

  // ─── Keywords that indicate visa/relocation support ───────────────────────────
  visaKeywords: [
    "visa sponsorship",
    "visa sponsor",
    "work permit",
    "tier 2",
    "skilled worker visa",
    "sponsorship available",
    "we sponsor",
    "relocation package",
    "relocation support",
    "relocation assistance",
    "relocation budget",
    "relocation allowance",
    "willing to relocate",
    "global mobility",
    "international candidates",
    "open to relocation",
  ],

  relocationKeywords: [
    "relocation package",
    "relocation support",
    "relocation assistance",
    "relocation budget",
    "relocation allowance",
    "relocation provided",
    "help you relocate",
    "open to relocation",
  ],
};

export type CVProfile = typeof CV_PROFILE;