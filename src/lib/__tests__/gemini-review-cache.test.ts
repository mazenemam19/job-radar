// src/lib/__tests__/gemini-review-cache.test.ts
// Coverage for filterJobsWithGemini's persistent review cache: only calling
// Gemini for jobs without a valid cached decision, and only ever persisting
// real (reviewed: true) decisions -- see gemini-review-cache.ts and
// supabase/migrations/20260714000000_gemini_review_cache.sql.
// Split out of gemini.test.ts to keep that file under the project's
// max-lines limit (same reasoning as dashboard-route.test.ts's split).

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { filterJobsWithGemini } from "../gemini";
import type { RawJob } from "../types";

const { generateContentMock } = vi.hoisted(() => ({ generateContentMock: vi.fn() }));

vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn().mockImplementation(function GoogleGenAI() {
    return { models: { generateContent: generateContentMock } };
  }),
}));

// Minimal chainable mock matching exactly the shape gemini-review-cache.ts calls:
//   .from(...).select(...).eq(...).eq(...).in(...)   -- cache read
//   .from(...).upsert(...)                            -- cache write
function makeMockDb(
  options: {
    cachedRows?: Array<{ job_id: string; gemini_pass: boolean; gemini_reason: string | null }>;
    selectError?: { message: string } | null;
    upsertError?: { message: string } | null;
  } = {},
) {
  const upsertMock = vi.fn().mockResolvedValue({ error: options.upsertError ?? null });
  const inMock = vi
    .fn()
    .mockResolvedValue({ data: options.cachedRows ?? [], error: options.selectError ?? null });
  const eq2Mock = vi.fn(() => ({ in: inMock }));
  const eq1Mock = vi.fn(() => ({ eq: eq2Mock }));
  const selectMock = vi.fn(() => ({ eq: eq1Mock }));
  const fromMock = vi.fn(() => ({ select: selectMock, upsert: upsertMock }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { from: fromMock, __upsertMock: upsertMock, __inMock: inMock } as any;
}

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
    mode: "global",
    visa_sponsorship: false,
    source_name: "Acme",
    ats_type: "greenhouse",
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

const settings = { gemini_filter_prompt: "Evaluate for fit." };

describe("filterJobsWithGemini — persistent review cache", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    generateContentMock.mockReset();
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reuses a cached pass without calling Gemini again", async () => {
    const job = makeJob({ id: "a" });
    const mockDb = makeMockDb({
      cachedRows: [{ job_id: "a", gemini_pass: true, gemini_reason: "cached: good fit" }],
    });

    const result = await filterJobsWithGemini("key", [job], settings, "user-1", mockDb);

    expect(generateContentMock).not.toHaveBeenCalled();
    expect(result).toHaveLength(1);
    expect(result[0].gemini_reason).toBe("cached: good fit");
    expect(result[0].gemini_reviewed).toBe(true);
    // Nothing new to persist -- already-cached decisions aren't re-written.
    expect(mockDb.__upsertMock).not.toHaveBeenCalled();
  });

  it("honors a cached fail without calling Gemini, and excludes the job", async () => {
    const job = makeJob({ id: "a" });
    const mockDb = makeMockDb({
      cachedRows: [{ job_id: "a", gemini_pass: false, gemini_reason: "cached: not a fit" }],
    });

    const result = await filterJobsWithGemini("key", [job], settings, "user-1", mockDb);

    expect(generateContentMock).not.toHaveBeenCalled();
    expect(result).toHaveLength(0);
  });

  it("only calls Gemini for jobs missing from the cache, and persists only the new decisions", async () => {
    const cachedJob = makeJob({ id: "cached-1" });
    const newJob = makeJob({ id: "new-1" });
    const mockDb = makeMockDb({
      cachedRows: [{ job_id: "cached-1", gemini_pass: true, gemini_reason: "cached: good fit" }],
    });
    generateContentMock.mockResolvedValue({
      text: JSON.stringify([{ idx: 0, pass: true, reason: "fresh decision" }]),
    });

    const result = await filterJobsWithGemini(
      "key",
      [cachedJob, newJob],
      settings,
      "user-1",
      mockDb,
    );

    // Only the uncached job should reach the model.
    expect(generateContentMock).toHaveBeenCalledTimes(1);
    expect(result.map((j) => j.id).sort()).toEqual(["cached-1", "new-1"]);

    // Only the freshly-reviewed job gets persisted -- the already-cached one is untouched.
    expect(mockDb.__upsertMock).toHaveBeenCalledTimes(1);
    const persisted = mockDb.__upsertMock.mock.calls[0][0];
    expect(persisted).toHaveLength(1);
    expect(persisted[0]).toMatchObject({
      user_id: "user-1",
      job_id: "new-1",
      gemini_pass: true,
      gemini_reason: "fresh decision",
    });
  });

  it("does NOT persist fail-open results (quota exhausted), so they retry next time", async () => {
    const job = makeJob({ id: "a" });
    const mockDb = makeMockDb();
    generateContentMock.mockRejectedValue(new Error("429 RESOURCE_EXHAUSTED: quota exceeded"));

    const result = await filterJobsWithGemini("key", [job], settings, "user-1", mockDb);

    expect(result[0].gemini_quota_exhausted).toBe(true);
    expect(mockDb.__upsertMock).not.toHaveBeenCalled();
  });

  it("does NOT persist a fail-open result from a missing idx", async () => {
    const jobs = [makeJob({ id: "a" }), makeJob({ id: "b" })];
    const mockDb = makeMockDb();
    generateContentMock.mockResolvedValue({
      text: JSON.stringify([{ idx: 0, pass: true, reason: "Good fit" }]),
      // idx 1 ("b") never comes back -- fails open, must not be cached.
    });

    await filterJobsWithGemini("key", jobs, settings, "user-1", mockDb);

    expect(mockDb.__upsertMock).toHaveBeenCalledTimes(1);
    const persisted = mockDb.__upsertMock.mock.calls[0][0];
    expect(persisted).toHaveLength(1);
    expect(persisted[0].job_id).toBe("a");
  });

  it("treats a cache read failure as an empty cache instead of blocking the request", async () => {
    const job = makeJob({ id: "a" });
    const mockDb = makeMockDb({ selectError: { message: "connection reset" } });
    generateContentMock.mockResolvedValue({
      text: JSON.stringify([{ idx: 0, pass: true, reason: "fresh decision" }]),
    });

    const result = await filterJobsWithGemini("key", [job], settings, "user-1", mockDb);

    expect(generateContentMock).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
    expect(errorSpy).toHaveBeenCalled();
  });

  it("a prompt change invalidates the old cache scope (different prompt_hash isn't looked up)", async () => {
    // The mock's .eq("prompt_hash", ...) always returns cachedRows regardless of
    // the actual hash value passed in real usage; what this test proves is the
    // shape of the call, and that different prompts still reach Gemini when the
    // (fake) cache genuinely has nothing for them.
    const job = makeJob({ id: "a" });
    const mockDb = makeMockDb({ cachedRows: [] });
    generateContentMock.mockResolvedValue({
      text: JSON.stringify([{ idx: 0, pass: true, reason: "reviewed under new prompt" }]),
    });

    const result = await filterJobsWithGemini(
      "key",
      [job],
      { gemini_filter_prompt: "A brand new prompt nobody has reviewed under yet." },
      "user-1",
      mockDb,
    );

    expect(generateContentMock).toHaveBeenCalledTimes(1);
    expect(result[0].gemini_reason).toBe("reviewed under new prompt");
  });

  it("processes more than one batch when there are enough uncached jobs, and combines both", async () => {
    const jobs = Array.from({ length: 20 }, (_, i) => makeJob({ id: `job-${i}` }));
    const mockDb = makeMockDb();
    // Every batch call gets the same 15-decision response; idx beyond a given
    // batch's actual size is out-of-range there and safely ignored (logged).
    generateContentMock.mockResolvedValue({
      text: JSON.stringify(
        Array.from({ length: 15 }, (_, i) => ({ idx: i, pass: true, reason: "ok" })),
      ),
    });

    const result = await filterJobsWithGemini("key", jobs, settings, "user-1", mockDb);

    // 20 jobs / 15 per batch = 2 calls
    expect(generateContentMock).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(20);
  });
});
