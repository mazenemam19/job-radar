export interface SourceHealth {
  count: number;
  rawCount?: number;
  geminiFiltered?: number;
  totalSurvivors?: number;
  error?: string;
  durationMs?: number;
  ats?: string;
  status?: "ok" | "error" | "zero" | "skipped";
  ok?: boolean; // Result of the CURRENT run
  // Lifetime stats
  success?: number;
  total?: number;
}

export interface CronLog {
  runAt: string;
  newJobs: number;
  totalJobs: number;
  sources: Record<string, number>; // Legacy: per-mode counts
  sourceDetails?: Record<string, SourceHealth>; // New: granular per-source health
  durationMs: number;
  errors: string[];
}

export interface HealthStat {
  success: number;
  total: number;
}

export type HealthStore = Record<string, HealthStat>;

export interface SourceSummary {
  name: string;
  totalRuns: number;
  successRate: number;
  lastCount: number;
  lastRawCount?: number;
  lastRegexFiltered?: number;
  lastGeminiFiltered?: number;
  totalSurvivors?: number;
  lastError?: string;
  avgDuration?: number;
  status: "healthy" | "nomatch" | "warning" | "error" | "skipped";
  success?: number;
  total?: number;
}
