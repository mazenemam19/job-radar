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

// Recognizable shape of a Gemini quota/rate-limit error — shared by the
// model-fallback loop's quota tracking below.
function isQuotaError(msg: string): boolean {
  return msg.includes("429") || msg.includes("quota") || msg.includes("RESOURCE_EXHAUSTED");
}

// Thrown by callWithModelFallback only when every model in MODEL_QUEUE failed
// and every one of those failures was specifically a quota/rate-limit error —
// as opposed to a network error, bad response, or other transient failure.
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

// ── Shared model-fallback loop ───────────────────────────────
// callGemini and generateApplicationStrategy both need "try each model in
// MODEL_QUEUE, bail immediately on an invalid key, otherwise fall through to
// the next model, and report whether every failure was quota-related" — that
// shared shape lived duplicated in both functions and pushed each over the
// complexity limit on its own. Extracted once here instead.

type ModelAttempt<T> = { value: T } | { retry: true; quota: boolean; msg: string };

async function tryModelCall<T>(
  genAI: GoogleGenAI,
  model: string,
  temperature: number,
  prompt: string,
  parse: (text: string) => T | null,
): Promise<ModelAttempt<T>> {
  try {
    const response = await genAI.models.generateContent({
      model,
      contents: prompt,
      config: { temperature },
    });
    const parsed = parse(response.text ?? "");
    if (parsed !== null) return { value: parsed };
    return { retry: true, quota: false, msg: "empty or invalid response" };
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

    return { retry: true, quota: isQuotaError(msg), msg };
  }
}

/**
 * Tries each model in MODEL_QUEUE in order against `prompt`, using `parse` to
 * validate/extract a result from the raw text. Returns the first successful
 * `{ value, model }` pair. Throws GeminiQuotaExhaustedError if every model
 * failed and every failure was quota-related, otherwise a generic Error with
 * `exhaustedMessage`.
 */
async function callWithModelFallback<T>(
  apiKey: string,
  temperature: number,
  prompt: string,
  parse: (text: string) => T | null,
  label: string,
  exhaustedMessage: string,
): Promise<{ value: T; model: string }> {
  const genAI = new GoogleGenAI({ apiKey });
  let allFailuresWereQuota = true;

  for (const model of MODEL_QUEUE) {
    const result = await tryModelCall(genAI, model, temperature, prompt, parse);
    if ("value" in result) return { value: result.value, model };

    if (!result.quota) allFailuresWereQuota = false;
    console.warn(`[gemini] ${label} — model ${model} failed, trying next... Error:`, result.msg);
  }

  throw allFailuresWereQuota ? new GeminiQuotaExhaustedError() : new Error(exhaustedMessage);
}

// ── Core call with model fallback ────────────────────────────

async function callGemini(apiKey: string, prompt: string): Promise<string> {
  const { value } = await callWithModelFallback(
    apiKey,
    0,
    prompt,
    (text) => (text.trim() ? text : null),
    "callGemini",
    "All Gemini models exhausted",
  );
  return value;
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

// Turns Gemini's raw decisions into a resultMap, validating/deduping idx and
// logging (loudly) any job that never got a matched decision. Split out of
// filterBatch so the batch-level try/catch stays simple.
function buildResultMap(
  jobs: RawJob[],
  decisions: GeminiDecision[],
  raw: string,
): Map<string, FilterResult> {
  const resultMap = new Map<string, FilterResult>();
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
  // but loudly (logged to console.error).
  const missing = jobs.filter((j) => !resultMap.has(j.id));
  if (missing.length > 0) {
    console.error(
      `[gemini] ${missing.length}/${jobs.length} jobs had no matching decision in Gemini's response (failing open). Raw response:`,
      raw,
    );
  }

  return resultMap;
}

// If Gemini fails for the whole batch, every job passes through (fail-open),
// tagged with why.
function failOpenResultMap(jobs: RawJob[], err: unknown): Map<string, FilterResult> {
  console.error("[gemini] Batch filter failed:", err);
  const quotaExhausted = err instanceof GeminiQuotaExhaustedError;
  const resultMap = new Map<string, FilterResult>();
  for (const j of jobs) {
    resultMap.set(j.id, {
      id: j.id,
      pass: true,
      reason: quotaExhausted ? "gemini-quota-exhausted" : "gemini-unavailable",
      reviewed: false,
      quotaExhausted,
    });
  }
  return resultMap;
}

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
    // 10,000 chars (data-driven: 91% of jobs fully covered at 10k vs. 48.8%
    // at the previous 6000-char ceiling; pushing past 10k buys only 8.2% more
    // coverage for a disproportionate token-cost increase). No ingestion
    // ceiling — processJobs stores the full description.
    description: j.description.slice(0, 10000),
  }));

  const prompt = `${promptTemplate}

${RESPONSE_FORMAT_INSTRUCTIONS}

Jobs to evaluate:
${JSON.stringify(jobSummaries, null, 2)}`;

  let resultMap: Map<string, FilterResult>;
  try {
    const raw = await callGemini(apiKey, prompt);
    resultMap = buildResultMap(jobs, parseDecisions(raw), raw);
  } catch (err) {
    resultMap = failOpenResultMap(jobs, err);
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

// Shared by filterJobsWithGemini and filterJobsWithGeminiVerbose: runs every
// job through filterBatch in BATCH_SIZE chunks and returns one decision per
// job (pass AND fail — filterBatch already fills in a fail-open entry for
// every job, this just doesn't throw failures away). One batching loop,
// two different assemblies of the same data — not two Gemini call sites.
async function filterAllJobs(
  apiKey: string,
  jobs: RawJob[],
  promptTemplate: string,
): Promise<Map<string, FilterResult>> {
  const allDecisions = new Map<string, FilterResult>();
  for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
    const batch = jobs.slice(i, i + BATCH_SIZE);
    const decisions = await filterBatch(apiKey, batch, promptTemplate);
    for (const [id, d] of decisions) allDecisions.set(id, d);
  }
  return allDecisions;
}

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

  const decisions = await filterAllJobs(apiKey, jobs, settings.gemini_filter_prompt);
  const results: Array<
    RawJob & {
      gemini_pass: boolean;
      gemini_reason: string | null;
      gemini_reviewed: boolean;
      gemini_quota_exhausted: boolean;
    }
  > = [];

  for (const job of jobs) {
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

  return results;
}

export interface GeminiJobResult {
  id: string;
  pass: boolean;
  reason: string | null;
  reviewed: boolean;
  quotaExhausted: boolean;
}

/**
 * Same Gemini batch calls as filterJobsWithGemini — zero extra API cost —
 * but returns a decision for EVERY job, pass or fail, instead of silently
 * dropping failures. Used by the pipeline breakdown (buildFeed) and the
 * job-trace search so the Gemini gate's drop reasons are visible, without
 * re-querying Gemini a second time for the same jobs.
 */
export async function filterJobsWithGeminiVerbose(
  apiKey: string,
  jobs: RawJob[],
  settings: Pick<ResolvedSettings, "gemini_filter_prompt">,
): Promise<GeminiJobResult[]> {
  if (!apiKey || !jobs.length) return [];

  const decisions = await filterAllJobs(apiKey, jobs, settings.gemini_filter_prompt);
  return jobs.map((job) => {
    const d = decisions.get(job.id);
    return {
      id: job.id,
      pass: d?.pass ?? true,
      reason: d?.reason ?? null,
      reviewed: d?.reviewed ?? false,
      quotaExhausted: d?.quotaExhausted ?? false,
    };
  });
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
