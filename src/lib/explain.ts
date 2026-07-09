// src/lib/explain.ts
// Traces a single raw job through every pipeline gate, in production order,
// stopping at the first failure. This is the single source of truth for
// "why did/didn't this job make it" — used both by buildFeed's per-gate
// pipeline breakdown (buildFeed already has the Gemini decision from its own
// batch call, and passes it in) and by the job-trace search route (which
// fetches a live Gemini decision for the one searched job before calling
// this).
//
// Deliberately does NOT call Gemini itself — the caller supplies the result
// (or null if the job never reached that stage / hasn't been checked yet).
// That keeps this module gate-logic-only and keeps the cost of a full-pool
// breakdown at zero extra Gemini calls.

import {
  explainDateGate,
  explainSeniorityGate,
  explainExcludedKeywordsGate,
  explainRequiredKeywordsGate,
  explainBlacklistedLocationsGate,
  explainSkillMatchGate,
  explainGlobalModeGate,
  scoreJob,
} from "./scoring";
import type { RawJob, ResolvedSettings, JobMode } from "./types";

export type GateName =
  | "date"
  | "seniority"
  | "excluded_keywords"
  | "required_keywords"
  | "blacklisted_locations"
  | "skill_match"
  | "global_mode"
  | "gemini"
  | "scoring";

export interface GateOutcome {
  gate: GateName;
  pass: boolean;
  reason: string | null;
}

export interface JobExplanation {
  job: RawJob;
  /** One entry per gate actually evaluated, in pipeline order, up to and
   *  including the first failure. If the job passed everything, every
   *  applicable gate is present (global_mode only for mode === "global"). */
  gates: GateOutcome[];
  /** The gate that stopped this job, or null if it passed every stage
   *  (including scoring) and would appear on the dashboard. */
  stoppedAt: GateName | null;
  /** total_score if the job reached scoring, otherwise null. */
  finalScore: number | null;
}

/** The shape returned by GET /api/jobs/explain for one matched job — the
 *  single source of truth for both the route and JobTraceSearch's rendering. */
export interface JobTraceResult {
  id: string;
  title: string;
  company: string;
  mode: JobMode;
  pipeline_match: boolean;
  stopped_at: GateName | null;
  gates: GateOutcome[];
  final_score: number | null;
  gemini_pending: boolean;
}

/** The Gemini decision for this job, if already known. Pass null when the
 *  job hasn't been checked yet (e.g. explainJob will stop before needing it). */
export interface GeminiDecisionInput {
  pass: boolean;
  reason: string | null;
  reviewed: boolean;
  quotaExhausted?: boolean;
}

/**
 * Runs one job through every gate in production order (date → seniority →
 * excluded keywords → required keywords → blacklisted locations → skill
 * match → global-mode [global jobs only] → Gemini → scoring), stopping at
 * the first failure.
 *
 * geminiResult is required to continue past the pre-Gemini gates — pass the
 * decision from your own batch call (buildFeed) or a fresh single-job check
 * (job-trace search). If the job would reach Gemini but no result was
 * supplied, the trace stops early with stoppedAt: null (incomplete, not a
 * failure) rather than guessing.
 */
export function explainJob(
  job: RawJob,
  settings: ResolvedSettings,
  geminiResult: GeminiDecisionInput | null,
): JobExplanation {
  const gates: GateOutcome[] = [];

  const stopAt = (gate: GateName): JobExplanation => ({
    job,
    gates,
    stoppedAt: gate,
    finalScore: null,
  });

  const date = explainDateGate(job, settings.job_age_days);
  gates.push({ gate: "date", ...date });
  if (!date.pass) return stopAt("date");

  const seniority = explainSeniorityGate(job, settings);
  gates.push({ gate: "seniority", ...seniority });
  if (!seniority.pass) return stopAt("seniority");

  const excluded = explainExcludedKeywordsGate(job, settings);
  gates.push({ gate: "excluded_keywords", ...excluded });
  if (!excluded.pass) return stopAt("excluded_keywords");

  const required = explainRequiredKeywordsGate(job, settings);
  gates.push({ gate: "required_keywords", ...required });
  if (!required.pass) return stopAt("required_keywords");

  const blacklisted = explainBlacklistedLocationsGate(job, settings);
  gates.push({ gate: "blacklisted_locations", ...blacklisted });
  if (!blacklisted.pass) return stopAt("blacklisted_locations");

  const skillMatch = explainSkillMatchGate(job, settings);
  gates.push({ gate: "skill_match", ...skillMatch });
  if (!skillMatch.pass) return stopAt("skill_match");

  // Global-mode gate only applies to "global" pipeline jobs — matches
  // buildFeed's `job.mode === "global" ? passesGlobalModeGate(...) : true`.
  if (job.mode === "global") {
    const globalMode = explainGlobalModeGate(job, settings);
    gates.push({ gate: "global_mode", ...globalMode });
    if (!globalMode.pass) return stopAt("global_mode");
  }

  if (!geminiResult) {
    // Every gate above passed but we don't have a Gemini decision to
    // continue with. Not a failure — an incomplete trace. Caller's choice
    // whether to fetch one and re-call, or show "pending" in the UI.
    return { job, gates, stoppedAt: null, finalScore: null };
  }

  gates.push({ gate: "gemini", pass: geminiResult.pass, reason: geminiResult.reason });
  if (!geminiResult.pass) return stopAt("gemini");

  const scored = scoreJob(
    job,
    settings,
    geminiResult.pass,
    geminiResult.reason,
    geminiResult.reviewed,
    geminiResult.quotaExhausted ?? false,
  );
  if (!scored) {
    // Defensive only: scoreJob's internal seniority re-check can't fail here
    // — seniority already passed above. Treat as an incomplete trace rather
    // than assume which stage would be responsible.
    return { job, gates, stoppedAt: null, finalScore: null };
  }

  const scoringPass = scored.total_score > 0;
  gates.push({
    gate: "scoring",
    pass: scoringPass,
    reason: scoringPass ? null : `final score ${scored.total_score} is not above 0`,
  });

  return {
    job,
    gates,
    stoppedAt: scoringPass ? null : "scoring",
    finalScore: scored.total_score,
  };
}
