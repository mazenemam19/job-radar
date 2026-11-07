import { describe, expect, it } from "vitest";
import {
  EMPTY_SEARCH_PROFILE,
  GERMANY_PILOT_SEARCH_PROFILE,
  normalizeSearchProfile,
} from "../search-profile";

describe("normalizeSearchProfile", () => {
  it("returns an isolated empty profile for the non-country-specific default", () => {
    const normalized = normalizeSearchProfile(EMPTY_SEARCH_PROFILE);

    expect(normalized).toEqual(EMPTY_SEARCH_PROFILE);
    expect(normalized).not.toBe(EMPTY_SEARCH_PROFILE);
  });

  it("normalizes a country code and duplicate cities", () => {
    const normalized = normalizeSearchProfile({
      locations: [
        {
          country_code: "de",
          country_name: " Germany ",
          cities: ["Erlangen", " erlangen ", "Nürnberg"],
          country_wide: false,
          remote_countrywide: true,
        },
      ],
      workplace_types: ["hybrid", "remote", "remote"],
      employment_types: ["working_student", "part_time"],
    });

    expect(normalized).toEqual({
      locations: [
        {
          country_code: "DE",
          country_name: "Germany",
          cities: ["Erlangen", "Nürnberg"],
          country_wide: false,
          remote_countrywide: true,
        },
      ],
      workplace_types: ["hybrid", "remote"],
      employment_types: ["working_student", "part_time"],
    });
  });

  it("rejects malformed countries and unsupported job categories", () => {
    const invalidCountry = normalizeSearchProfile({
      ...EMPTY_SEARCH_PROFILE,
      locations: [
        {
          country_code: "Germany",
          country_name: "Germany",
          cities: [],
          country_wide: false,
          remote_countrywide: false,
        },
      ],
    });
    const invalidType = normalizeSearchProfile({
      ...EMPTY_SEARCH_PROFILE,
      employment_types: ["unknown-type"],
    });

    expect(invalidCountry).toBeNull();
    expect(invalidType).toBeNull();
  });

  it("keeps the Germany pilot data separate from the empty global profile", () => {
    expect(GERMANY_PILOT_SEARCH_PROFILE).toMatchObject({
      locations: [
        {
          country_code: "DE",
          country_name: "Germany",
          cities: ["Buckenhof", "Erlangen", "Nürnberg"],
          country_wide: false,
          remote_countrywide: true,
        },
      ],
      workplace_types: ["on_site", "hybrid", "remote"],
    });
    expect(EMPTY_SEARCH_PROFILE).toEqual({
      locations: [],
      workplace_types: [],
      employment_types: [],
    });
  });
});
