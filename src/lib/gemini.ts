// src/lib/gemini.ts
// Per-user Gemini filtering and strategy generation.
// Each user's API key is fetched from user_profiles.gemini_api_key.
// Falls back to the environment GEMINI_API_KEY for admin/default operations only.

import { GoogleGenAI } from "@google/genai";
import type { RawJob, ResolvedSettings } from "./types";

// Models tried in order; falls back to next on quota/error
const MODEL_QUEUE = [
  "gemini-3.1-pro-preview",
  "gemini-3.1-flash-lite-preview",
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
];

const BATCH_SIZE = 15; // jobs per Gemini call (halved from 30 to offset the larger per-job char window below)

// Fixed, code-owned response-format contract. Deliberately NOT part of
// gemini_filter_prompt (which is user-editable).
// A stored, user-editable JSON contract is how this broke in the first place.
// Index-based (not job.id) because asking a model to echo back long,
// opaque composite ID strings character-for-character is fragile; a short
// integer it can't mangle is not.
const RESPONSE_FORMAT_INSTRUCTIONS = `Respond with ONLY a JSON array, no markdown, no preamble. Each element must be:
{ "idx": <number>, "pass": true/false, "reason": "<one short sentence>" }
"idx" must exactly match the "idx" field given for that job below. Include a decision for every job listed — do not skip any.`;

interface GeminiDecision {
  idx: number;
  pass: boolean;
  reason: string;
}

// Recognizable shape of a Gemini quota/rate-limit error — shared by callGemini's
// quota tracking and generateApplicationStrategy's retry logic below.
function isQuotaError(msg: string): boolean {
  return msg.includes("429") || msg.includes("quota") || msg.includes("RESOURCE_EXHAUSTED");
}

// Thrown by callGemini only when every model in MODEL_QUEUE failed and every
// one of those failures was specifically a quota/rate-limit error — as
// opposed to a network error, bad response, or other transient failure.
// Lets filterBatch's catch block surface a distinct "quota exhausted" badge
// instead of the generic "not AI-reviewed" one.
class GeminiQuotaExhaustedError extends Error {
  constructor() {
    super("All Gemini models exhausted their quota");
    this.name = "GeminiQuotaExhaustedError";
  }
}

interface FilterResult {
  id: string;
  pass: boolean;
  reason: string | null;
  // true only when Gemini returned a real, matched decision for this job's
  // idx. false for both fail-open paths (missing idx in an otherwise-valid
  // response, or total batch failure).

  reviewed: boolean;
  // true only when the batch failed open specifically because every model
  // was quota-exhausted (see GeminiQuotaExhaustedError). Optional because
  // most FilterResult constructions never hit that path.
  quotaExhausted?: boolean;
}

// ── Core call with model fallback ────────────────────────────

async function callGemini(apiKey: string, prompt: string): Promise<string> {
  const genAI = new GoogleGenAI({ apiKey });
  let allFailuresWereQuota = true;

  for (const model of MODEL_QUEUE) {
    try {
      const response = await genAI.models.generateContent({
        model,
        contents: prompt,
        config: { temperature: 0 },
      });
      const text = response.text ?? "";
      if (text.trim()) return text;
      allFailuresWereQuota = false; // an empty response isn't a quota issue
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);

      // If the API key is completely invalid or unauthorized, fail immediately
      if (
        msg.includes("401") ||
        msg.includes("API_KEY_INVALID") ||
        msg.includes("INVALID_ARGUMENT")
      ) {
        throw err;
      }

      if (!isQuotaError(msg)) allFailuresWereQuota = false;

      // For any other errors (429 rate limit, 404 model unsupported, server error), try the next model
      console.warn(`[gemini] Model ${model} failed, trying next... Error:`, msg);
      continue;
    }
  }

  throw allFailuresWereQuota
    ? new GeminiQuotaExhaustedError()
    : new Error("All Gemini models exhausted");
}

// ── Parse Gemini JSON response ────────────────────────────────

function parseDecisions(text: string): GeminiDecision[] {
  // Strip markdown fences if present
  const clean = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  try {
    const parsed = JSON.parse(clean);
    if (Array.isArray(parsed)) return parsed as GeminiDecision[];
    return [];
  } catch {
    return [];
  }
}

// ── Batch filtering ───────────────────────────────────────────

/**
 * Filters a batch of raw jobs using Gemini with the user's custom prompt.
 * Called once per batch (BATCH_SIZE jobs).
 *
 * Returns a map of job.id → { pass, reason }.
 */
async function filterBatch(
  apiKey: string,
  jobs: RawJob[],
  promptTemplate: string,
): Promise<Map<string, FilterResult>> {
  const jobSummaries = jobs.map((j, idx) => ({
    idx,
    title: j.title,
    company: j.company,
    location: j.location,
    // 10,000 chars (data-driven: 91% of jobs fully covered at 10k).
    // 10,000 chars (data-driven: 91% of jobs fully covered at 10k vs.
    // 48.8% at the previous 6000-char ceiling; pushing past 10k buys only
    // 8.2% more coverage for a disproportionate token-cost increase).
    // No ingestion ceiling — processJobs stores the full description.
    description: j.description.slice(0, 10000),
  }));

  const prompt = `${promptTemplate}

${RESPONSE_FORMAT_INSTRUCTIONS}

Jobs to evaluate:
${JSON.stringify(jobSummaries, null, 2)}`;

  const resultMap = new Map<string, FilterResult>();

  try {
    const raw = await callGemini(apiKey, prompt);
    const decisions = parseDecisions(raw);
    const seenIdx = new Set<number>();

    for (const d of decisions) {
      const idx = d.idx;
      const isValidIdx =
        typeof idx === "number" && Number.isInteger(idx) && idx >= 0 && idx < jobs.length;

      if (!isValidIdx) {
        console.error(
          `[gemini] Decision with invalid/out-of-range idx (${JSON.stringify(idx)}) for a batch of ${jobs.length}. Raw response:`,
          raw,
        );
        continue;
      }
      if (seenIdx.has(idx)) {
        console.error(
          `[gemini] Duplicate idx ${idx} in response, ignoring repeat. Raw response:`,
          raw,
        );
        continue;
      }
      seenIdx.add(idx);

      const job = jobs[idx];
      resultMap.set(job.id, {
        id: job.id,
        pass: Boolean(d.pass),
        reason: d.reason ?? null,
        reviewed: true,
      });
    }

    // Any job whose idx never appeared in a valid decision → fail open,
    // but loudly. This used to be silent.
    const missing = jobs.filter((j) => !resultMap.has(j.id));
    if (missing.length > 0) {
      console.error(
        `[gemini] ${missing.length}/${jobs.length} jobs had no matching decision in Gemini's response (failing open). Raw response:`,
        raw,
      );
    }
  } catch (err) {
    // If Gemini fails for this batch, pass all jobs through (fail-open)
    console.error("[gemini] Batch filter failed:", err);
    const quotaExhausted = err instanceof GeminiQuotaExhaustedError;
    for (const j of jobs) {
      resultMap.set(j.id, {
        id: j.id,
        pass: true,
        reason: quotaExhausted ? "gemini-quota-exhausted" : "gemini-unavailable",
        reviewed: false,
        quotaExhausted,
      });
    }
  }

  // Any job not in Gemini's response → default to pass (fail-open)
  for (const j of jobs) {
    if (!resultMap.has(j.id)) {
      resultMap.set(j.id, { id: j.id, pass: true, reason: null, reviewed: false });
    }
  }

  return resultMap;
}

// ── Main export: filter all jobs ─────────────────────────────

/**
 * Filters a list of raw jobs using the user's Gemini API key and custom prompt.
 * Processes jobs in batches to stay within context window limits.
 *
 * Returns the subset of jobs that passed, annotated with pass/reason.
 */
export async function filterJobsWithGemini(
  apiKey: string,
  jobs: RawJob[],
  settings: Pick<ResolvedSettings, "gemini_filter_prompt">,
): Promise<
  Array<
    RawJob & {
      gemini_pass: boolean;
      gemini_reason: string | null;
      gemini_reviewed: boolean;
      gemini_quota_exhausted: boolean;
    }
  >
> {
  if (!apiKey || !jobs.length) return [];

  const results: Array<
    RawJob & {
      gemini_pass: boolean;
      gemini_reason: string | null;
      gemini_reviewed: boolean;
      gemini_quota_exhausted: boolean;
    }
  > = [];
  const prompt = settings.gemini_filter_prompt;

  // Process in batches
  for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
    const batch = jobs.slice(i, i + BATCH_SIZE);
    const decisions = await filterBatch(apiKey, batch, prompt);

    for (const job of batch) {
      const d = decisions.get(job.id);
      if (d?.pass) {
        results.push({
          ...job,
          gemini_pass: true,
          gemini_reason: d.reason,
          gemini_reviewed: d.reviewed,
          gemini_quota_exhausted: d.quotaExhausted ?? false,
        });
      }
    }
  }

  return results;
}

// ── Strategy generation ───────────────────────────────────────

export interface StrategyResult {
  strategies: string[];
  model_used: string;
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

  const genAI = new GoogleGenAI({ apiKey });
  let allFailuresWereQuota = true;

  for (const model of MODEL_QUEUE) {
    try {
      const response = await genAI.models.generateContent({
        model,
        contents: prompt,
        config: { temperature: 0.3 },
      });
      const text = (response.text ?? "").replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return { strategies: parsed as string[], model_used: model };
      }
      // Non-array response — not a quota issue, try next model
      allFailuresWereQuota = false;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);

      // Invalid API key — fail immediately
      if (
        msg.includes("401") ||
        msg.includes("API_KEY_INVALID") ||
        msg.includes("INVALID_ARGUMENT")
      ) {
        throw err;
      }

      if (!isQuotaError(msg)) allFailuresWereQuota = false;

      // For any other error (429 rate limit, 404 model unsupported, server error, parse error), try next model
      console.warn(
        `[gemini] Strategy generation — model ${model} failed, trying next... Error:`,
        msg,
      );
      continue;
    }
  }

  throw allFailuresWereQuota
    ? new GeminiQuotaExhaustedError()
    : new Error("Failed to generate strategy: all models exhausted");
}
