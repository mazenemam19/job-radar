// src/lib/gemini-model-fallback.ts
// Shared "try each model in MODEL_QUEUE, bail immediately on an invalid key,
// otherwise fall through to the next model, and report whether every failure
// was quota-related" loop. Used by both the batch-filtering pipeline
// (gemini-batch-filter.ts) and generateApplicationStrategy (gemini.ts) --
// this shape used to live duplicated in both, which pushed each over the
// complexity limit on its own.

import { GoogleGenAI } from "@google/genai";

// Models tried in order; falls back to next on quota/error.
// gemini-3.1-pro-preview was removed: this project's Gemini
// account is unbilled, and 3.1-pro sits in Google's zero-allocation
// "Free Tier" bucket (not the real "Free Usage Allowance" bucket) --
// every call returns 429 limit:0 regardless of usage, load, or pacing.
// It isn't rate-limited, it's structurally inaccessible on this billing
// tier, so keeping it in the queue only bought a guaranteed-failed round
// trip on every single batch before falling through to a model that works.
export const MODEL_QUEUE = [
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite-preview",
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
];

// Recognizable shape of a Gemini quota/rate-limit error.
function isQuotaError(msg: string): boolean {
  return msg.includes("429") || msg.includes("quota") || msg.includes("RESOURCE_EXHAUSTED");
}

// Thrown by callWithModelFallback only when every model in MODEL_QUEUE failed
// and every one of those failures was specifically a quota/rate-limit error —
// as opposed to a network error, bad response, or other transient failure.
// Lets callers surface a distinct "quota exhausted" badge instead of a
// generic failure.
export class GeminiQuotaExhaustedError extends Error {
  constructor() {
    super("All Gemini models exhausted their quota");
    this.name = "GeminiQuotaExhaustedError";
  }
}

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
export async function callWithModelFallback<T>(
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
