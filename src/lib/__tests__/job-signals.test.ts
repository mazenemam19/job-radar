import { describe, expect, it } from "vitest";
import { detectWorkAuthorizationSignal, hasRelocationSupportEvidence } from "../job-signals";

describe("work authorization evidence", () => {
  it("recognizes explicit available sponsorship and keeps its sentence", () => {
    expect(detectWorkAuthorizationSignal("Visa sponsorship is available for this role.")).toEqual({
      status: "sponsorship_available",
      evidence: "Visa sponsorship is available for this role.",
    });
  });

  it("recognizes explicit unavailable sponsorship before positive wording", () => {
    const signal = detectWorkAuthorizationSignal(
      "We support international hires. No visa sponsorship is available.",
    );
    expect(signal.status).toBe("sponsorship_unavailable");
    expect(signal.evidence).toBe("No visa sponsorship is available.");
  });

  it("keeps an ambiguous work authorization requirement distinct from sponsorship", () => {
    expect(
      detectWorkAuthorizationSignal("Applicants must already be authorized to work.").status,
    ).toBe("authorization_required");
  });

  it("returns unclear when the posting says nothing about work authorization", () => {
    expect(detectWorkAuthorizationSignal("Build accessible React applications.")).toEqual({
      status: "unclear",
      evidence: null,
    });
  });

  it("does not count negated relocation language as support", () => {
    expect(hasRelocationSupportEvidence("No relocation support is available.")).toBe(false);
    expect(hasRelocationSupportEvidence("Relocation assistance is provided.")).toBe(true);
  });
});
