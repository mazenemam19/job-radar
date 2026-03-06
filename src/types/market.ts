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

export interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  color?: string;
}

export interface SkillFrequency {
  skill: string;
  category: string;
  count: number;
  percentage: number;
  inYourSkillSet: boolean;
}

export interface SkillGap {
  skill: string;
  category: string;
  count: number;
  percentage: number;
  trending: boolean;
}

export interface PipelineData {
  label: string;
  total: number;
  skills: { skill: string; count: number }[];
}

export interface CoOccur {
  skillA: string;
  skillB: string;
  count: number;
}
