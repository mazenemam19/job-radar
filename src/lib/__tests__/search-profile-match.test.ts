import { describe, expect, it } from "vitest";
import { GERMANY_PILOT_SEARCH_PROFILE } from "../search-profile";
import { explainSearchProfileMatch } from "../search-profile-match";

describe("explainSearchProfileMatch", () => {
  it("explains a city, workplace, and working-student match", () => {
    expect(
      explainSearchProfileMatch(
        {
          country_code: "DE",
          city: "Erlangen",
          workplace_type: "hybrid",
          employment_types: ["working_student"],
        },
        GERMANY_PILOT_SEARCH_PROFILE,
      ),
    ).toEqual({
      reasons: ["Erlangen, Germany", "Hybrid", "Working student"],
      uncertainties: [],
    });
  });

  it("explains Germany-wide remote roles", () => {
    expect(
      explainSearchProfileMatch(
        {
          country_code: "DE",
          city: null,
          workplace_type: "remote",
          employment_types: ["part_time"],
        },
        GERMANY_PILOT_SEARCH_PROFILE,
      ),
    ).toEqual({
      reasons: ["Remote across Germany", "Remote", "Part-time"],
      uncertainties: [],
    });
  });

  it("keeps unknown location and type evidence visible for review", () => {
    expect(
      explainSearchProfileMatch(
        { country_code: null, city: null, workplace_type: "unknown", employment_types: [] },
        GERMANY_PILOT_SEARCH_PROFILE,
      ),
    ).toEqual({
      reasons: [],
      uncertainties: [
        "The posting country could not be identified",
        "The workplace arrangement is unclear",
        "The employment type is unclear",
      ],
    });
  });
});
