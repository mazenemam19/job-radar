// src/lib/__tests__/cron-upsert-raw-jobs.test.ts
import { describe, it, expect, vi } from "vitest";
import { upsertRawJobs } from "../cron/upsert-raw-jobs";
import type { RawJob } from "../types";

function makeRawJob(id: string): RawJob {
  return {
    id,
    title: "Senior Engineer",
    company: "Test Corp",
    location: "London",
    country: "GB",
    country_flag: "🇬🇧",
    url: `https://example.com/${id}`,
    description: "React TypeScript",
    posted_at: new Date().toISOString(),
    fetched_at: new Date().toISOString(),
    date_unknown: false,
    is_remote: false,
    salary: null,
    mode: "global",
    visa_sponsorship: false,
    source_name: "Test Corp",
    ats_type: "greenhouse",
    created_at: new Date().toISOString(),
  };
}

// Minimal admin-client stub: only `.from("raw_jobs").upsert(...)` is exercised.
function makeDb(upsertImpl: (rows: unknown[]) => { error: { message: string } | null }) {
  const upsert = vi.fn().mockImplementation(async (rows: unknown[]) => upsertImpl(rows));
  return { from: vi.fn().mockReturnValue({ upsert }), upsert };
}

describe("upsertRawJobs", () => {
  it("returns no errors and makes no DB call for an empty job list", async () => {
    const db = makeDb(() => ({ error: null }));
    const errors = await upsertRawJobs(db as never, []);

    expect(errors).toEqual([]);
    expect(db.from).not.toHaveBeenCalled();
  });

  it("deduplicates jobs with the same id within a chunk", async () => {
    const db = makeDb(() => ({ error: null }));
    const jobs = [makeRawJob("dup"), makeRawJob("dup"), makeRawJob("unique")];

    await upsertRawJobs(db as never, jobs);

    const upserted = db.upsert.mock.calls[0][0] as { id: string }[];
    expect(upserted).toHaveLength(2);
    expect(upserted.map((r) => r.id).sort()).toEqual(["dup", "unique"]);
  });

  it("splits more than 500 jobs into multiple chunks", async () => {
    const db = makeDb(() => ({ error: null }));
    const jobs = Array.from({ length: 750 }, (_, i) => makeRawJob(`job-${i}`));

    await upsertRawJobs(db as never, jobs);

    expect(db.upsert).toHaveBeenCalledTimes(2);
    expect((db.upsert.mock.calls[0][0] as unknown[]).length).toBe(500);
    expect((db.upsert.mock.calls[1][0] as unknown[]).length).toBe(250);
  });

  it("collects one error message per failed chunk without throwing", async () => {
    const db = makeDb(() => ({ error: { message: "boom" } }));
    const errors = await upsertRawJobs(db as never, [makeRawJob("a")]);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/boom/);
  });
});
