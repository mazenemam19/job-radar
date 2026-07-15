// src/lib/gemini.ts
// Per-user Gemini filtering and strategy generation.
// Each user's API key is fetched from user_profiles.gemini_api_key.
// Falls back to the environment GEMINI_API_KEY for admin/default operations only.
//
// Split across a few files by concern:
//   gemini-model-fallback.ts  -- try-each-model-in-order infrastructure
//   gemini-batch-filter.ts    -- call Gemini for one batch, parse/validate response
//   gemini-review-cache.ts    -- persistent per-(user,job,prompt) decision cache
//   gemini.ts (this file)     -- public API: filterJobsWithGemini, generateApplicationStrategy

import type { SupabaseClient } from "@supabase/supabase-js";
import type { RawJob, ResolvedSettings } from "./types";
import type { Database } from "./database.types";
import { hashPrompt, loadCachedDecisions, persistDecisions } from "./gemini-review-cache";
import type { CachedDecision } from "./gemini-review-cache";
import { BATCH_SIZE, BATCH_DELAY_MS, delay, filterBatch } from "./gemini-batch-filter";
import { callWithModelFallback } from "./gemini-model-fallback";

type GeminiReviewedJob = RawJob & {
  gemini_pass: boolean;
  gemini_reason: string | null;
  gemini_reviewed: boolean;
  gemini_quota_exhausted: boolean;
};

// Splits jobs into ones with a usable cached decision (mapped straight to
// the final output shape) and ones that still need a real Gemini call.
function partitionByCache(
  jobs: RawJob[],
  cached: Map<string, CachedDecision>,
): { fromCache: GeminiReviewedJob[]; jobsNeedingReview: RawJob[] } {
  const fromCache: GeminiReviewedJob[] = [];
  const jobsNeedingReview: RawJob[] = [];

  for (const job of jobs) {
    const decision = cached.get(job.id);
    if (!decision) {
      jobsNeedingReview.push(job);
      continue;
    }
    // A cached "fail" means Gemini already rejected this job under this
    // exact prompt -- honor it without spending another call. A cached
    // "pass" gets included, same as a fresh pass would be.
    if (decision.pass) {
      fromCache.push({
        ...job,
        gemini_pass: true,
        gemini_reason: decision.reason,
        gemini_reviewed: true,
        gemini_quota_exhausted: false,
      });
    }
  }
  return { fromCache, jobsNeedingReview };
}

// Runs the uncached jobs through Gemini in paced batches, returning both the
// passing jobs (final shape) and the real decisions that should be persisted.
async function reviewUncachedJobs(
  apiKey: string,
  jobsNeedingReview: RawJob[],
  prompt: string,
): Promise<{
  reviewed: GeminiReviewedJob[];
  toPersist: Array<{ job_id: string; gemini_pass: boolean; gemini_reason: string | null }>;
}> {
  const reviewed: GeminiReviewedJob[] = [];
  const toPersist: Array<{ job_id: string; gemini_pass: boolean; gemini_reason: string | null }> =
    [];

  for (let i = 0; i < jobsNeedingReview.length; i += BATCH_SIZE) {
    if (i > 0) await delay(BATCH_DELAY_MS);
    const batch = jobsNeedingReview.slice(i, i + BATCH_SIZE);
    const decisions = await filterBatch(apiKey, batch, prompt);

    for (const job of batch) {
      const d = decisions.get(job.id);
      if (d?.reviewed) {
        toPersist.push({ job_id: job.id, gemini_pass: d.pass, gemini_reason: d.reason });
      }
      if (d?.pass) {
        reviewed.push({
          ...job,
          gemini_pass: true,
          gemini_reason: d.reason,
          gemini_reviewed: d.reviewed,
          gemini_quota_exhausted: d.quotaExhausted ?? false,
        });
      }
    }
  }
  return { reviewed, toPersist };
}

// ── Main export: filter all jobs ─────────────────────────────

/**
 * Filters a list of raw jobs using the user's Gemini API key and custom prompt.
 * Consults the persistent review cache first (gemini-review-cache.ts) so a job
 * already reviewed under this exact prompt doesn't cost another API call.
 * Processes only the remaining jobs in batches to stay within context limits.
 *
 * Returns the subset of jobs that passed, annotated with pass/reason.
 */
export async function filterJobsWithGemini(
  apiKey: string,
  jobs: RawJob[],
  settings: Pick<ResolvedSettings, "gemini_filter_prompt">,
  userId: string,
  db: SupabaseClient<Database>,
): Promise<GeminiReviewedJob[]> {
  if (!apiKey || !jobs.length) return [];

  const prompt = settings.gemini_filter_prompt;
  const promptHash = hashPrompt(prompt);
  const cached = await loadCachedDecisions(
    db,
    userId,
    jobs.map((j) => j.id),
    promptHash,
  );

  const { fromCache, jobsNeedingReview } = partitionByCache(jobs, cached);
  const { reviewed, toPersist } = await reviewUncachedJobs(apiKey, jobsNeedingReview, prompt);

  await persistDecisions(db, userId, promptHash, toPersist);

  return [...fromCache, ...reviewed];
}

// ── Strategy generation ───────────────────────────────────────

export interface StrategyResult {
  strategies: string[];
  model_used: string;
}

function parseStrategyResponse(text: string): string[] | null {
  const clean = text.replace(/```json|```/g, "").trim();
  try {
    const parsed = JSON.parse(clean);
    return Array.isArray(parsed) ? (parsed as string[]) : null;
  } catch {
    return null;
  }
}

/**
 * Generates a 4-6 bullet application strategy for a specific job.
 * Uses the user's own Gemini API key.
 *
 * Strategy generation is called on-demand from the dashboard UI.
 */
export async function generateApplicationStrategy(
  apiKey: string,
  job: { title: string; company: string; description: string },
  userSkills: string[],
): Promise<StrategyResult> {
  const prompt = `You are an expert career coach helping a Senior React/Next.js engineer.

Job: "${job.title}" at ${job.company}
Engineer's skills: ${userSkills.slice(0, 20).join(", ")}
Job description (first 1500 chars): ${job.description.slice(0, 1500)}

Write 4-6 short, specific, actionable bullet points for a cover letter / interview prep.
Focus on: skill alignment, how to position experience, what to emphasise, questions to ask.
Return ONLY a JSON array of strings (the bullet points). No markdown, no preamble.`;

  const { value: strategies, model } = await callWithModelFallback(
    apiKey,
    0.3,
    prompt,
    parseStrategyResponse,
    "strategy generation",
    "Failed to generate strategy: all models exhausted",
  );

  return { strategies, model_used: model };
}
