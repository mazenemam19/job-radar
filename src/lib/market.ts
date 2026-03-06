// src/lib/market.ts
import { readStore, readRawStore } from "@/lib/storage";
import { SKILL_REGISTRY, PERSONAL_SKILLS, getSeniority } from "./constants";

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

    const score = job.totalScore || 0;
    if (score <= 20) scoreBuckets["0-20"]++;
    else if (score <= 40) scoreBuckets["21-40"]++;
    else if (score <= 60) scoreBuckets["41-60"]++;
    else if (score <= 80) scoreBuckets["61-80"]++;
    else scoreBuckets["81-100"]++;

    // Unified Seniority Logic
    const level = getSeniority(job.title);
    seniority[level]++;

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
