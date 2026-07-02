// src/lib/__tests__/build-submission-patch.test.ts
import { describe, it, expect } from "vitest";
import { buildSubmissionPatch } from "../admin/build-submission-patch";

describe("buildSubmissionPatch", () => {
  it("always sets reviewed_at and reviewed_by", () => {
    const patch = buildSubmissionPatch({}, "admin-1", "2026-07-02T00:00:00.000Z");
    expect(patch.reviewed_at).toBe("2026-07-02T00:00:00.000Z");
    expect(patch.reviewed_by).toBe("admin-1");
  });

  it("copies status/slug/ats_type when present and typeof string", () => {
    const patch = buildSubmissionPatch(
      { status: "approved", slug: "acme", ats_type: "greenhouse" },
      "admin-1",
      "now",
    );
    expect(patch.status).toBe("approved");
    expect(patch.slug).toBe("acme");
    expect(patch.ats_type).toBe("greenhouse");
  });

  it("ignores non-string values for status/slug/ats_type", () => {
    const patch = buildSubmissionPatch(
      { status: 1, slug: null, ats_type: undefined },
      "admin-1",
      "now",
    );
    expect(patch.status).toBeUndefined();
    expect(patch.slug).toBeUndefined();
    expect(patch.ats_type).toBeUndefined();
  });

  it("ignores fields absent from the body", () => {
    const patch = buildSubmissionPatch({}, "admin-1", "now");
    expect(patch.status).toBeUndefined();
    expect(patch.slug).toBeUndefined();
    expect(patch.ats_type).toBeUndefined();
  });
});
