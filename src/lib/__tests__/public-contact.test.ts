import { describe, expect, it } from "vitest";
import { COMPANY_DIRECTORY_SUPPORT_EMAIL, companyDirectoryRemovalMailto } from "../public-contact";

describe("companyDirectoryRemovalMailto", () => {
  it("opens the configured public support inbox with a neutral removal template", () => {
    const href = companyDirectoryRemovalMailto();
    const url = new URL(href);

    expect(COMPANY_DIRECTORY_SUPPORT_EMAIL).toBe("jobradarnoreply@gmail.com");
    expect(url.protocol).toBe("mailto:");
    expect(url.pathname).toBe(COMPANY_DIRECTORY_SUPPORT_EMAIL);
    expect(url.searchParams.get("subject")).toBe("Job Radar company directory removal request");
    expect(url.searchParams.get("body")).toContain("Company name:");
    expect(url.searchParams.get("body")).toContain("Reason (optional):");
  });
});
