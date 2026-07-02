// src/lib/__tests__/ats-utils-egypt-city.test.ts
// Regression guard for AUDIT_STATUS.md row #2 (ats-utils.ts complexity 16).
// extractEgyptCity() was refactored from an 11-branch if-chain into a data
// table. It isn't exported, so these tests go through processJobs() in
// mode "local", which is the only caller. "New Cairo" now matches correctly
// — the "new cairo" pattern was moved ahead of the plain "cairo" pattern,
// which previously shadowed it (see ats/job-processing.ts for detail).
import { describe, it, expect } from "vitest";
import { processJobs } from "../sources/ats-utils";
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

function localCity(location: string): string {
  return processJobs([rawJob(location)], company, "local")[0].location;
}

describe("extractEgyptCity (via processJobs, mode=local)", () => {
  it.each([
    ["Remote, Egypt", "Remote 🌐"],
    ["Cairo, Egypt", "Cairo"],
    ["Giza, Egypt", "Giza"],
    ["Alexandria, Egypt", "Alexandria"],
    ["Maadi, Egypt", "Maadi, Cairo"],
    ["Nasr City, Egypt", "Nasr City, Cairo"],
    ["Nasr-City", "Nasr City, Cairo"],
    ["Heliopolis, Egypt", "Heliopolis, Cairo"],
    ["New Cairo, Egypt", "New Cairo"],
    ["New-Cairo", "New Cairo"],
    ["6th of October City", "6th of October"],
    ["Sheikh Zayed, Egypt", "6th of October"],
    ["Smart Village, Egypt", "Smart Village, Giza"],
  ])("maps %s -> %s", (location, expected) => {
    expect(localCity(location)).toBe(expected);
  });

  it("falls back to companyCity for an unrecognized location", () => {
    expect(localCity("Somewhere Else")).toBe("Cairo");
  });

  it("falls back to 'Cairo' when there's no companyCity and no match", () => {
    const jobs = processJobs([rawJob("Somewhere Else")], { ...company, city: undefined }, "local");
    expect(jobs[0].location).toBe("Cairo");
  });

  it("no longer lets 'cairo' shadow 'new cairo' (regression guard for the fixed bug)", () => {
    // "new cairo" contains "cairo" as a substring. Before this fix, "cairo"
    // was matched first and "New Cairo" jobs were mislabeled "Cairo". The
    // "new cairo" pattern now runs first, so this must stay "New Cairo".
    expect(localCity("New Cairo, Egypt")).toBe("New Cairo");
    expect(localCity("new cairo")).toBe("New Cairo");
  });
});
