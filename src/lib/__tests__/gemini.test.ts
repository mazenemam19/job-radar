// src/lib/__tests__/gemini.test.ts
//
// Regression coverage for Bug 1 (gemini-filter-audit.md): index-based
// matching replacing the fragile ID-echo contract. See
// docs/plans/2026-06-24-gemini-index-based-matching.md.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { filterJobsWithGemini } from "../gemini";
import type { RawJob } from "../types";

const { generateContentMock } = vi.hoisted(() => ({ generateContentMock: vi.fn() }));

vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn().mockImplementation(function GoogleGenAI() {
    return { models: { generateContent: generateContentMock } };
  }),
}));

function makeJob(overrides: Partial<RawJob> = {}): RawJob {
  return {
    id: "visa_gh_acme_1",
    title: "Senior Frontend Engineer",
    company: "Acme Corp",
    location: "London, UK",
    country: "GB",
    country_flag: "🇬🇧",
    url: "https://jobs.example.com/1",
    description: "We need a React and TypeScript expert",
    posted_at: new Date().toISOString(),
    fetched_at: new Date().toISOString(),
    date_unknown: false,
    is_remote: false,
    salary: null,
    mode: "visa",
    visa_sponsorship: false,
    source_name: "Acme",
    ats_type: "greenhouse",
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

const settings = { gemini_filter_prompt: "Evaluate for fit." };

describe("filterJobsWithGemini — index-based matching", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    generateContentMock.mockReset();
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("maps complete responses to the right jobs by idx, not id", async () => {
    const jobs = [
      makeJob({ id: "visa_gh_acme_1", title: "Frontend Engineer" }),
      makeJob({ id: "visa_lever_globex_2", title: "Sales Manager" }),
    ];
    generateContentMock.mockResolvedValue({
      text: JSON.stringify([
        { idx: 0, pass: true, reason: "Strong React match" },
        { idx: 1, pass: false, reason: "Not an engineering role" },
      ]),
    });

    const result = await filterJobsWithGemini("key", jobs, settings);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("visa_gh_acme_1");
    expect(result[0].gemini_reason).toBe("Strong React match");
    expect(result[0].gemini_reviewed).toBe(true);
  });

  it("fails open and logs loudly when some idx are missing from the response", async () => {
    const jobs = [makeJob({ id: "a" }), makeJob({ id: "b" })];
    generateContentMock.mockResolvedValue({
      text: JSON.stringify([{ idx: 0, pass: true, reason: "Good fit" }]),
      // idx 1 never comes back
    });

    const result = await filterJobsWithGemini("key", jobs, settings);

    // job "b" still fails open (passes), but it's now logged instead of silent
    expect(result.map((j) => j.id).sort()).toEqual(["a", "b"]);
    const bResult = result.find((j) => j.id === "b");
    expect(bResult?.gemini_reason).toBeNull();
    expect(bResult?.gemini_reviewed).toBe(false);
    expect(errorSpy).toHaveBeenCalled();
  });

  it("ignores out-of-range or duplicate idx without crashing, and logs them", async () => {
    const jobs = [makeJob({ id: "a" })];
    generateContentMock.mockResolvedValue({
      text: JSON.stringify([
        { idx: 5, pass: true, reason: "garbage idx" },
        { idx: 0, pass: true, reason: "real decision" },
        { idx: 0, pass: false, reason: "duplicate, should be ignored" },
      ]),
    });

    const result = await filterJobsWithGemini("key", jobs, settings);

    expect(result).toHaveLength(1);
    expect(result[0].gemini_reason).toBe("real decision");
    expect(result[0].gemini_reviewed).toBe(true);
    expect(errorSpy).toHaveBeenCalled();
  });

  it("falls back to gemini-unavailable when the SDK call throws", async () => {
    const jobs = [makeJob({ id: "a" })];
    generateContentMock.mockRejectedValue(new Error("API_KEY_INVALID"));

    const result = await filterJobsWithGemini("key", jobs, settings);

    expect(result).toHaveLength(1);
    expect(result[0].gemini_reason).toBe("gemini-unavailable");
    expect(result[0].gemini_reviewed).toBe(false);
    expect(result[0].gemini_quota_exhausted).toBe(false);
  });

  it("flags gemini_quota_exhausted when every model in the queue hits a 429/quota error", async () => {
    const jobs = [makeJob({ id: "a" })];
    generateContentMock.mockRejectedValue(new Error("429 RESOURCE_EXHAUSTED: quota exceeded"));

    const result = await filterJobsWithGemini("key", jobs, settings);

    expect(result).toHaveLength(1);
    expect(result[0].gemini_pass).toBe(true);
    expect(result[0].gemini_reason).toBe("gemini-quota-exhausted");
    expect(result[0].gemini_reviewed).toBe(false);
    expect(result[0].gemini_quota_exhausted).toBe(true);
  });

  it("does NOT flag gemini_quota_exhausted when failures are a mix of quota and other errors", async () => {
    const jobs = [makeJob({ id: "a" })];
    // Some models hit quota, but not all — the overall failure isn't purely quota-caused.
    generateContentMock
      .mockRejectedValueOnce(new Error("429 quota exceeded"))
      .mockRejectedValueOnce(new Error("500 internal server error"))
      .mockRejectedValueOnce(new Error("429 quota exceeded"))
      .mockRejectedValueOnce(new Error("500 internal server error"))
      .mockRejectedValueOnce(new Error("429 quota exceeded"));

    const result = await filterJobsWithGemini("key", jobs, settings);

    expect(result).toHaveLength(1);
    expect(result[0].gemini_reason).toBe("gemini-unavailable");
    expect(result[0].gemini_quota_exhausted).toBe(false);
  });

  it("handles malformed/non-JSON responses without crashing", async () => {
    const jobs = [makeJob({ id: "a" })];
    generateContentMock.mockResolvedValue({ text: "not json at all" });

    const result = await filterJobsWithGemini("key", jobs, settings);

    // fails open since no decisions parsed
    expect(result).toHaveLength(1);
    expect(result[0].gemini_pass).toBe(true);
    expect(result[0].gemini_reason).toBeNull();
    expect(result[0].gemini_reviewed).toBe(false);
  });
});
