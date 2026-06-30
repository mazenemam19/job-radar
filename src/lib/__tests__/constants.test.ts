// src/lib/__tests__/constants.test.ts
import { describe, it, expect } from "vitest";
import { VALID_ATS, VALID_STATUSES, COUNTRY_MAP, COUNTRY_FLAGS } from "../constants";
import type { ATSType, TrackerStatus } from "../types";

describe("VALID_ATS", () => {
  it("contains all 9 supported ATS types", () => {
    expect(VALID_ATS).toHaveLength(9);
  });

  it.each([
    "greenhouse",
    "lever",
    "ashby",
    "workable",
    "teamtailor",
    "breezy",
    "smartrecruiters",
    "bamboohr",
    "jazzhr",
  ])("includes %s as a valid ATS type", (ats) => {
    expect(VALID_ATS).toContain(ats as ATSType);
  });

  it("contains no duplicate entries", () => {
    expect(new Set(VALID_ATS)).toHaveLength(VALID_ATS.length);
  });
});

describe("VALID_STATUSES", () => {
  it("contains all 6 tracker statuses", () => {
    expect(VALID_STATUSES).toHaveLength(6);
  });

  it.each([
    "applied",
    "interviewing",
    "offer",
    "rejected",
    "ghosted",
    "saved",
  ])("includes %s as a valid status", (status) => {
    expect(VALID_STATUSES).toContain(status as TrackerStatus);
  });
});

describe("COUNTRY_MAP", () => {
  it("resolves Egypt to correct name and flag", () => {
    expect(COUNTRY_MAP["egypt"]).toEqual({ name: "Egypt", flag: expect.any(String) });
  });

  it("resolves Saudi Arabia to correct name", () => {
    expect(COUNTRY_MAP["saudi arabia"]).toEqual(expect.objectContaining({ name: "Saudi Arabia" }));
  });

  it("resolves UAE", () => {
    expect(COUNTRY_MAP["uae"]).toEqual(expect.objectContaining({ name: "UAE" }));
  });

  it("resolves Dubai to UAE", () => {
    expect(COUNTRY_MAP["dubai"]).toEqual(expect.objectContaining({ name: "UAE" }));
  });

  it("is keyed by lowercase", () => {
    expect(COUNTRY_MAP["egypt"]).toBeDefined();
    expect(COUNTRY_MAP["EGYPT"]).toBeUndefined();
  });
});

describe("COUNTRY_FLAGS", () => {
  it("includes Egypt flag", () => {
    expect(Object.values(COUNTRY_FLAGS)).toContain("🇪🇬");
  });

  it("includes Saudi Arabia flag", () => {
    expect(Object.values(COUNTRY_FLAGS)).toContain("🇸🇦");
  });

  it("includes UAE flag", () => {
    const aeFlags = Object.entries(COUNTRY_FLAGS).filter(([k]) => k === "AE");
    expect(aeFlags.length).toBeGreaterThan(0);
    expect(aeFlags[0][1]).toBeTruthy();
  });

  it("is keyed by ISO country code", () => {
    expect(COUNTRY_FLAGS["EG"]).toBeDefined();
    expect(COUNTRY_FLAGS["SA"]).toBeDefined();
    expect(COUNTRY_FLAGS["AE"]).toBeDefined();
  });
});
