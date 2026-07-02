// src/lib/__tests__/build-defaults-patch.test.ts
import { describe, it, expect } from "vitest";
import { buildDefaultsPatch } from "../admin/build-defaults-patch";

describe("buildDefaultsPatch", () => {
  it("filters non-string entries out of string-array fields", () => {
    const result = buildDefaultsPatch({
      expert_skills: ["react", 42, "typescript", null],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.patch.expert_skills).toEqual(["react", "typescript"]);
    }
  });

  it("ignores a string-array field if the value isn't an array", () => {
    const result = buildDefaultsPatch({ expert_skills: "not-an-array" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.patch.expert_skills).toBeUndefined();
    }
  });

  it("accepts number fields only when typeof number", () => {
    const result = buildDefaultsPatch({ job_age_days: 30, score_denominator: "bad" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.patch.job_age_days).toBe(30);
      expect(result.patch.score_denominator).toBeUndefined();
    }
  });

  it("accepts boolean fields only when typeof boolean", () => {
    const result = buildDefaultsPatch({ pipeline_local: true, pipeline_global: "yes" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.patch.pipeline_local).toBe(true);
      expect(result.patch.pipeline_global).toBeUndefined();
    }
  });

  it("nulls out gemini_filter_prompt when given a non-string", () => {
    const result = buildDefaultsPatch({ gemini_filter_prompt: 123 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.patch.gemini_filter_prompt).toBeNull();
    }
  });

  it("keeps gemini_filter_prompt string as-is", () => {
    const result = buildDefaultsPatch({ gemini_filter_prompt: "custom prompt" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.patch.gemini_filter_prompt).toBe("custom prompt");
    }
  });

  it("accepts scoring_weights that sum to 1", () => {
    const result = buildDefaultsPatch({
      scoring_weights: { skill: 0.5, recency: 0.3, relocation: 0.2 },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.patch.scoring_weights).toEqual({ skill: 0.5, recency: 0.3, relocation: 0.2 });
    }
  });

  it("rejects scoring_weights that don't sum to 1", () => {
    const result = buildDefaultsPatch({
      scoring_weights: { skill: 0.5, recency: 0.3, relocation: 0.5 },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("scoring_weights must sum to 1");
    }
  });

  it("treats missing scoring_weights fields as 0", () => {
    const result = buildDefaultsPatch({ scoring_weights: { skill: 1 } });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.patch.scoring_weights).toEqual({ skill: 1, recency: 0, relocation: 0 });
    }
  });

  it("ignores unknown keys entirely", () => {
    const result = buildDefaultsPatch({ made_up_field: "whatever" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.patch as Record<string, unknown>).made_up_field).toBeUndefined();
    }
  });

  it("always sets updated_at", () => {
    const result = buildDefaultsPatch({});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(typeof result.patch.updated_at).toBe("string");
    }
  });
});
