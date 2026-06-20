// src/lib/v2/gemini.ts
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

const BATCH_SIZE = 30; // jobs per Gemini call (avoids exceeding context window)

interface GeminiDecision {
  id: string;
  pass: boolean;
  reason: string;
}

interface FilterResult {
  id: string;
  pass: boolean;
  reason: string | null;
}

// ── Core call with model fallback ────────────────────────────

async function callGemini(apiKey: string, prompt: string): Promise<string> {
  const genAI = new GoogleGenAI({ apiKey });

  for (const model of MODEL_QUEUE) {
    try {
      const response = await genAI.models.generateContent({
        model,
        contents: prompt,
        config: { temperature: 0 },
      });
      const text = response.text ?? "";
      if (text.trim()) return text;
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

      // For any other errors (429 rate limit, 404 model unsupported, server error), try the next model
      console.warn(`[gemini-v2] Model ${model} failed, trying next... Error:`, msg);
      continue;
    }
  }

  throw new Error("All Gemini models exhausted");
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
  const jobSummaries = jobs.map((j) => ({
    id: j.id,
    title: j.title,
    company: j.company,
    location: j.location,
    description: j.description.slice(0, 1200), // truncate for token limit
  }));

  const prompt = `${promptTemplate}

Jobs to evaluate:
${JSON.stringify(jobSummaries, null, 2)}`;

  const resultMap = new Map<string, FilterResult>();

  try {
    const raw = await callGemini(apiKey, prompt);
    const decisions = parseDecisions(raw);

    for (const d of decisions) {
      if (d.id) {
        resultMap.set(d.id, {
          id: d.id,
          pass: Boolean(d.pass),
          reason: d.reason ?? null,
        });
      }
    }
  } catch (err) {
    // If Gemini fails for this batch, pass all jobs through (fail-open)
    console.error("[gemini-v2] Batch filter failed:", err);
    for (const j of jobs) {
      resultMap.set(j.id, { id: j.id, pass: true, reason: "gemini-unavailable" });
    }
  }

  // Any job not in Gemini's response → default to pass (fail-open)
  for (const j of jobs) {
    if (!resultMap.has(j.id)) {
      resultMap.set(j.id, { id: j.id, pass: true, reason: null });
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
): Promise<Array<RawJob & { gemini_pass: boolean; gemini_reason: string | null }>> {
  if (!apiKey || !jobs.length) return [];

  const results: Array<RawJob & { gemini_pass: boolean; gemini_reason: string | null }> = [];
  const prompt = settings.gemini_filter_prompt;

  // Process in batches
  for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
    const batch = jobs.slice(i, i + BATCH_SIZE);
    const decisions = await filterBatch(apiKey, batch, prompt);

    for (const job of batch) {
      const d = decisions.get(job.id);
      if (d?.pass) {
        results.push({ ...job, gemini_pass: true, gemini_reason: d.reason });
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
 * FIX #4: (Email) – strategy generation is not tied to email; this is
 * called on-demand from the dashboard UI.
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
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("429") || msg.includes("quota") || msg.includes("RESOURCE_EXHAUSTED")) {
        continue;
      }
      throw err;
    }
  }

  throw new Error("Failed to generate strategy: all models exhausted");
}
