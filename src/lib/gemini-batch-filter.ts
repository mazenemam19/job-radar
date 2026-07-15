// src/lib/gemini-batch-filter.ts
// Filters one batch of jobs (BATCH_SIZE at a time) through Gemini: builds the
// prompt, calls the model-fallback loop, parses and validates the response,
// and fails open (loudly) on any job that didn't get a real decision.
// Split out of gemini.ts to keep that file focused on orchestration + the
// public API, and under the project's line limit.

import type { RawJob } from "./types";
import { callWithModelFallback, GeminiQuotaExhaustedError } from "./gemini-model-fallback";

export const BATCH_SIZE = 15; // jobs per Gemini call (halved from 30 to offset the larger per-job char window below)

// Spacing between sequential batch calls. Firing dozens/hundreds of batches
// back-to-back with zero pacing is what let a single cache rebuild burn
// through a model's per-minute quota partway through (see gemini-review-cache.ts,
// which reduces how many batches are needed in the first place -- the two
// fixes compound).
export const BATCH_DELAY_MS = 300;

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

export interface FilterResult {
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
export async function filterBatch(
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
