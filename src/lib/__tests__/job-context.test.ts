import { describe, expect, it } from "vitest";
import { getJobEligibilityClues } from "../job-context";

function makeJob(overrides: Record<string, unknown> = {}) {
  return {
    title: "Frontend Engineer",
    description: "React and TypeScript role.",
    visa_sponsorship: false,
    ...overrides,
  };
}

describe("getJobEligibilityClues", () => {
  it("preserves a positive sponsorship statement and its sentence", () => {
    const clues = getJobEligibilityClues(
      makeJob({ description: "We can sponsor a visa for the right candidate." }),
    );

    expect(clues.workAuthorizationStatus).toBe("sponsorship_available");
    expect(clues.workAuthorizationEvidence).toBe("We can sponsor a visa for the right candidate.");
  });

  it("keeps negative sponsorship wording negative and visible as evidence", () => {
    const clues = getJobEligibilityClues(
      makeJob({ description: "Visa sponsorship is not available for this role." }),
    );

    expect(clues.workAuthorizationStatus).toBe("sponsorship_unavailable");
    expect(clues.workAuthorizationEvidence).toBe(
      "Visa sponsorship is not available for this role.",
    );
  });

  it("leaves unclear authorization and language clues uncertain", () => {
    const clues = getJobEligibilityClues(makeJob());

    expect(clues.workAuthorizationStatus).toBe("unclear");
    expect(clues.workAuthorizationEvidence).toBeNull();
    expect(clues.languages).toEqual([]);
    expect(clues.languageEvidence).toBeNull();
  });

  it("shows language mentions without treating them as proven requirements", () => {
    const clues = getJobEligibilityClues(
      makeJob({ description: "English is our working language; German is a plus." }),
    );

    expect(clues.languages).toEqual(["German", "English"]);
    expect(clues.languageEvidence).toBe("English is our working language; German is a plus.");
  });

  it("keeps an ATS sponsorship flag when the description has no supporting sentence", () => {
    const clues = getJobEligibilityClues(makeJob({ visa_sponsorship: true }));

    expect(clues.workAuthorizationStatus).toBe("sponsorship_available");
    expect(clues.workAuthorizationEvidence).toBeNull();
    expect(clues.authorizationSourceFlag).toBe(true);
  });
});
