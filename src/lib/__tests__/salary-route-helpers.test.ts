// Covers pure salary-route helpers: USD-only aggregation, privacy suppression,
// and input validation before the server records conversion provenance.

import { describe, it, expect } from "vitest";
import {
  pickAmount,
  bucketExperience,
  aggregateSalaries,
  getSubmittedAmount,
  validateSalaryPost,
  VALID_CURRENCIES,
} from "../salary-route";
import type { RawSalaryRow } from "../salary-route";
import type { SalaryCurrency } from "@/lib/types";

describe("pickAmount", () => {
  it("returns an auditable USD snapshot", () => {
    expect(pickAmount(1_500)).toBe(1_500);
  });

  it("does not guess a conversion for legacy rows", () => {
    expect(pickAmount(null)).toBeNull();
  });
});

describe("bucketExperience", () => {
  it("buckets 0-2 years as band 1", () => {
    expect(bucketExperience(0)).toBe(1);
    expect(bucketExperience(2)).toBe(1);
  });

  it("buckets 3-5 years as band 4", () => {
    expect(bucketExperience(3)).toBe(4);
    expect(bucketExperience(5)).toBe(4);
  });

  it("buckets 6-9 years as band 7", () => {
    expect(bucketExperience(6)).toBe(7);
    expect(bucketExperience(9)).toBe(7);
  });

  it("buckets 10+ years as band 10", () => {
    expect(bucketExperience(10)).toBe(10);
    expect(bucketExperience(20)).toBe(10);
  });
});

function row(overrides: Partial<RawSalaryRow> = {}): RawSalaryRow {
  return {
    role_title: "Frontend Engineer",
    years_experience: 4,
    years_experience_exact: 4,
    usd_amount: 750,
    pipeline: "local",
    reported_at: "2024-06-15T00:00:00.000Z",
    ...overrides,
  };
}

describe("aggregateSalaries", () => {
  it("returns an empty array for no rows", () => {
    expect(aggregateSalaries([])).toEqual([]);
  });

  it("suppresses buckets with fewer than 2 entries (privacy floor)", () => {
    expect(aggregateSalaries([row()])).toEqual([]);
  });

  it("returns a USD aggregate for a bucket with 2+ entries", () => {
    const result = aggregateSalaries([row({ usd_amount: 600 }), row({ usd_amount: 800 })]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      min: 600,
      max: 800,
      median: 800,
      count: 2,
      currency: "USD",
    });
  });

  it("skips rows without a recorded USD conversion", () => {
    expect(aggregateSalaries([row({ usd_amount: null }), row({ usd_amount: null })])).toEqual([]);
  });

  it("buckets rows with the same role into the same experience band", () => {
    const result = aggregateSalaries([
      row({ years_experience: 3, usd_amount: 600 }),
      row({ years_experience: 5, usd_amount: 800 }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].years_experience).toBe(4);
    expect(result[0].count).toBe(2);
  });

  it("uses an exact source value for experience bands when present", () => {
    const result = aggregateSalaries([
      row({ years_experience: 3, years_experience_exact: 2.5, usd_amount: 600 }),
      row({ years_experience: 3, years_experience_exact: 2.5, usd_amount: 800 }),
    ]);

    expect(result[0].years_experience).toBe(1);
  });

  it("combines converted source currencies into the same USD bucket", () => {
    const result = aggregateSalaries([
      row({ usd_amount: 600 }),
      row({ usd_amount: 800 }),
      row({ usd_amount: 1_500 }),
      row({ usd_amount: 2_000 }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ currency: "USD", count: 4 });
  });

  it("keeps the report-date range without exposing individual reports", () => {
    const result = aggregateSalaries([
      row({ usd_amount: 600, reported_at: "2024-04-10T10:20:10.000Z" }),
      row({ usd_amount: 800, reported_at: "2024-07-01T08:06:54.000Z" }),
    ]);

    expect(result[0]).toMatchObject({
      earliest_reported_at: "2024-04-10T10:20:10.000Z",
      latest_reported_at: "2024-07-01T08:06:54.000Z",
    });
  });

  it("returns results sorted alphabetically by role_title", () => {
    const make = (role: string) => [
      row({ role_title: role, usd_amount: 100 }),
      row({ role_title: role, usd_amount: 200 }),
    ];
    const result = aggregateSalaries([...make("Zebra Role"), ...make("Alpha Role")]);

    expect(result[0].role_title).toBe("Alpha Role");
    expect(result[1].role_title).toBe("Zebra Role");
  });
});

describe("validateSalaryPost", () => {
  it("returns ok for a complete valid body", () => {
    expect(
      validateSalaryPost({ role_title: "Dev", years_experience: 3, amount: 30_000, currency: "EGP" }),
    ).toEqual({ ok: true });
  });

  it("rejects when role_title is missing", () => {
    expect(validateSalaryPost({ years_experience: 3, amount: 1, currency: "EGP" }).ok).toBe(false);
  });

  it("rejects when years_experience is invalid", () => {
    expect(
      validateSalaryPost({
        role_title: "Dev",
        years_experience: null as unknown as number,
        amount: 1,
        currency: "EGP",
      }).ok,
    ).toBe(false);
  });

  it("rejects when currency is missing or unrecognised", () => {
    expect(validateSalaryPost({ role_title: "Dev", years_experience: 3, amount: 1 }).ok).toBe(false);

    const result = validateSalaryPost({
      role_title: "Dev",
      years_experience: 3,
      amount: 1,
      currency: "BTC" as unknown as SalaryCurrency,
    });
    expect(result).toEqual({ ok: false, error: "Invalid currency" });
  });

  it("accepts all supported original currencies", () => {
    for (const currency of VALID_CURRENCIES) {
      expect(validateSalaryPost({ role_title: "Dev", years_experience: 3, amount: 1, currency })).toEqual({
        ok: true,
      });
    }
  });

  it("rejects missing, non-positive, and non-finite amounts", () => {
    expect(validateSalaryPost({ role_title: "Dev", years_experience: 3, currency: "USD" }).ok).toBe(false);
    expect(
      validateSalaryPost({ role_title: "Dev", years_experience: 3, amount: 0, currency: "USD" }).ok,
    ).toBe(false);
    expect(
      validateSalaryPost({ role_title: "Dev", years_experience: 3, amount: Number.NaN, currency: "USD" }).ok,
    ).toBe(false);
  });

  it("temporarily accepts a valid legacy amount from older clients", () => {
    const body = {
      role_title: "Dev",
      years_experience: 3,
      salary_egp: 30_000,
      currency: "EGP" as const,
    };
    expect(validateSalaryPost(body)).toEqual({ ok: true });
    expect(getSubmittedAmount(body)).toBe(30_000);
  });
});
