// src/lib/__tests__/salary-route-helpers.test.ts
// Covers the pure helpers extracted from salary/route.ts into lib/salary-route.ts
// (audit row #19): pickAmount, bucketExperience, aggregateSalaries, validateSalaryPost.

import { describe, it, expect } from "vitest";
import {
  pickAmount,
  bucketExperience,
  aggregateSalaries,
  validateSalaryPost,
  VALID_CURRENCIES,
} from "../salary-route";
import type { RawSalaryRow } from "../salary-route";
import type { SalaryCurrency } from "@/lib/types";

// ── pickAmount ────────────────────────────────────────────────

describe("pickAmount", () => {
  it("returns salary_egp for EGP currency", () => {
    expect(pickAmount("EGP", 30000, null)).toBe(30000);
  });

  it("returns salary_usd for USD currency", () => {
    expect(pickAmount("USD", null, 1500)).toBe(1500);
  });

  it("falls back to salary_usd for EUR (old two-column schema)", () => {
    expect(pickAmount("EUR", null, 1200)).toBe(1200);
  });

  it("falls back to salary_egp when salary_usd is null for non-EGP/USD", () => {
    expect(pickAmount("GBP", 40000, null)).toBe(40000);
  });

  it("returns null when both columns are null", () => {
    expect(pickAmount("EUR", null, null)).toBeNull();
  });
});

// ── bucketExperience ──────────────────────────────────────────

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

// ── aggregateSalaries ─────────────────────────────────────────

function row(overrides: Partial<RawSalaryRow> = {}): RawSalaryRow {
  return {
    role_title: "Frontend Engineer",
    years_experience: 4,
    currency: "EGP",
    salary_egp: 30000,
    salary_usd: null,
    pipeline: "local",
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

  it("returns an aggregate for a bucket with 2+ entries", () => {
    const rows = [row({ salary_egp: 30000 }), row({ salary_egp: 40000 })];
    const result = aggregateSalaries(rows);
    expect(result).toHaveLength(1);
    expect(result[0].min).toBe(30000);
    expect(result[0].max).toBe(40000);
    expect(result[0].median).toBe(40000); // floor(2/2) = index 1
    expect(result[0].count).toBe(2);
  });

  it("skips rows where the resolved amount is null", () => {
    // EUR row with both columns null → amount is null → skipped
    const rows = [
      row({ currency: "EUR", salary_egp: null, salary_usd: null }),
      row({ currency: "EUR", salary_egp: null, salary_usd: null }),
    ];
    expect(aggregateSalaries(rows)).toEqual([]);
  });

  it("buckets rows with the same role into the same experience band", () => {
    const rows = [
      row({ years_experience: 3, salary_egp: 30000 }), // band 4
      row({ years_experience: 5, salary_egp: 40000 }), // band 4 → same key
    ];
    const result = aggregateSalaries(rows);
    expect(result).toHaveLength(1);
    expect(result[0].years_experience).toBe(4); // band representative
    expect(result[0].count).toBe(2);
  });

  it("keeps roles in separate buckets when currency differs", () => {
    const rows = [
      row({ currency: "EGP", salary_egp: 30000, salary_usd: null }),
      row({ currency: "EGP", salary_egp: 40000, salary_usd: null }),
      row({ currency: "USD", salary_egp: null, salary_usd: 1500 }),
      row({ currency: "USD", salary_egp: null, salary_usd: 2000 }),
    ];
    const result = aggregateSalaries(rows);
    expect(result).toHaveLength(2);
    const currencies = result.map((r) => r.currency).sort();
    expect(currencies).toEqual(["EGP", "USD"]);
  });

  it("returns results sorted alphabetically by role_title", () => {
    const make = (role: string) => [
      row({ role_title: role, salary_egp: 10000 }),
      row({ role_title: role, salary_egp: 20000 }),
    ];
    const rows = [...make("Zebra Role"), ...make("Alpha Role")];
    const result = aggregateSalaries(rows);
    expect(result[0].role_title).toBe("Alpha Role");
    expect(result[1].role_title).toBe("Zebra Role");
  });
});

// ── validateSalaryPost ────────────────────────────────────────

describe("validateSalaryPost", () => {
  it("returns ok for a complete valid body", () => {
    expect(validateSalaryPost({ role_title: "Dev", years_experience: 3, currency: "EGP" })).toEqual(
      { ok: true },
    );
  });

  it("rejects when role_title is missing", () => {
    const result = validateSalaryPost({ years_experience: 3, currency: "EGP" });
    expect(result.ok).toBe(false);
  });

  it("rejects when years_experience is null", () => {
    const result = validateSalaryPost({
      role_title: "Dev",
      years_experience: null as unknown as number,
      currency: "EGP",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects when currency is missing", () => {
    const result = validateSalaryPost({ role_title: "Dev", years_experience: 3 });
    expect(result.ok).toBe(false);
  });

  it("rejects an unrecognised currency", () => {
    const result = validateSalaryPost({
      role_title: "Dev",
      years_experience: 3,
      currency: "BTC" as unknown as SalaryCurrency,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("Invalid currency");
  });

  it("accepts all entries in VALID_CURRENCIES", () => {
    for (const c of VALID_CURRENCIES) {
      const result = validateSalaryPost({ role_title: "Dev", years_experience: 3, currency: c });
      expect(result.ok).toBe(true);
    }
  });
});
