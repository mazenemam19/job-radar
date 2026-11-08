import { describe, expect, it } from "vitest";
import { processJobs } from "../sources/ats-utils";
import {
  extractLanguageClues,
  inferEmploymentTypes,
  inferWorkplaceType,
  normalizePostingLocation,
} from "../job-normalization";
import type { ATSRawInput, BaseCompany } from "@/types/api";

const company: BaseCompany = {
  name: "Acme",
  country: "Egypt",
  countryFlag: "🇪🇬",
  city: "Cairo",
};

function rawJob(location: string): ATSRawInput {
  return {
    id: "1",
    title: "Frontend Engineer",
    location,
    url: "https://example.com/job/1",
    postedAt: "2026-07-01T00:00:00.000Z",
    description: "",
  };
}

describe("posting location normalization", () => {
  it.each([
    ["Erlangen, Germany", "DE", "Erlangen"],
    ["Nürnberg, Deutschland", "DE", "Nürnberg"],
    ["Nuremberg, DE", "DE", "Nuremberg"],
    ["Cairo, Egypt", "EG", "Cairo"],
    ["Tokyo, Japan", "JP", "Tokyo"],
    ["Tokyo, JP", "JP", "Tokyo"],
    ["Johannesburg, South Africa", "ZA", "Johannesburg"],
    ["Gibraltar", "GI", null],
    ["Mexico City, Mexico", "MX", "Mexico City"],
    ["Buenos Aires, Argentina", "AR", "Buenos Aires"],
    ["São Paulo, Brazil", "BR", "São Paulo"],
    ["Mumbai, India", "IN", "Mumbai"],
    ["Jakarta, Indonesia", "ID", "Jakarta"],
    ["Paris, FR", "FR", "Paris"],
    ["Sofia, Bulgaria", "BG", "Sofia"],
    ["London Office", "GB", "London"],
    ["Office - San Francisco", "US", "San Francisco"],
    ["Remote - New York", "US", "New York"],
    ["Remote - California", "US", null],
    ["Office-Manila, Philippines", "PH", "Manila"],
  ])("normalizes %s", (location, countryCode, city) => {
    const result = normalizePostingLocation(location);
    expect(result.countryCode).toBe(countryCode);
    expect(result.city).toBe(city);
    expect(result.sourceLocation).toBe(location);
  });

  it("does not convert regional labels into a country", () => {
    expect(normalizePostingLocation("EMEA").countryCode).toBeNull();
    expect(normalizePostingLocation("Global").countryCode).toBeNull();
  });

  it("uses an explicit title country only when the ATS location is regional", () => {
    expect(normalizePostingLocation("EMEA", "Frontend Engineer — Germany").countryCode).toBe(
      "DE",
    );
    expect(normalizePostingLocation("San Francisco", "Germany Account Manager").countryCode).toBe(
      "US",
    );
  });

  it("keeps unknown locations uncertain instead of substituting the company city", () => {
    const result = processJobs([rawJob("Somewhere Else")], company, "local")[0];
    expect(result.location).toBe("Somewhere Else");
    expect(result.city).toBe("Somewhere Else");
    expect(result.countryCode).toBeNull();
    expect(result.country).toBe("Unknown");
  });

  it("preserves a Germany posting location in local fetch mode", () => {
    const result = processJobs([rawJob("Erlangen, Germany")], company, "local")[0];
    expect(result.location).toBe("Erlangen, Germany");
    expect(result.countryCode).toBe("DE");
    expect(result.city).toBe("Erlangen");
  });
});

describe("posting attributes", () => {
  it("detects German and English language clues with source evidence", () => {
    expect(extractLanguageClues("German is required. English is our team language.")).toEqual({
      requirements: ["German", "English"],
      evidence: "German is required.",
    });
  });

  it("recognizes common German employment categories", () => {
    expect(inferEmploymentTypes("Werkstudent Frontend Developer")).toContain("working_student");
    expect(inferEmploymentTypes("Teilzeit or Vollzeit")).toEqual(["part_time", "full_time"]);
  });

  it("retains unknown workplace type when the source is inconclusive", () => {
    expect(inferWorkplaceType("Erlangen, Germany", "Engineer", "Some responsibilities.")).toBe(
      "unknown",
    );
    expect(inferWorkplaceType("Remote, Germany", "Engineer", "")).toBe("remote");
    expect(inferWorkplaceType("Remote, Germany", "Engineer", "", "remote")).toBe("remote");
    expect(inferWorkplaceType("Berlin, Germany", "Engineer", "Hybrid work model.")).toBe("hybrid");
  });
});
