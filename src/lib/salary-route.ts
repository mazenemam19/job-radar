// src/lib/salary-route.ts
// Pure logic for GET + POST /api/salary — no Next.js, no Supabase calls.
// Kept separate so it's unit-testable without mocking the route layer.

import type {
  SalaryAggregate,
  SalaryCurrency,
  Pipeline,
  EmploymentType,
  WorkArrangement,
} from "@/lib/types";

// ── Types ─────────────────────────────────────────────────────

export type RawSalaryRow = {
  role_title: string;
  years_experience: number;
  currency: string;
  salary_egp: number | null;
  salary_usd: number | null;
  pipeline: string | null;
};

export const VALID_CURRENCIES: readonly SalaryCurrency[] = ["EGP", "USD", "EUR", "GBP"];

// ── POST validation ───────────────────────────────────────────

/**
 * The parsed JSON body of POST /api/salary.
 * Fields are typed to their expected domain types, matching the original
 * inline body type in the route handler so TypeScript can check usage
 * after validation narrows them.
 */
export type SalaryPostBody = {
  role_title?: string;
  years_experience?: number;
  salary_egp?: number;
  salary_usd?: number;
  currency?: SalaryCurrency;
  employment_type?: EmploymentType;
  work_arrangement?: WorkArrangement;
  pipeline?: Pipeline;
};

export type ValidationResult = { ok: true } | { ok: false; error: string };

/** Type guard: returns true when x is a recognised SalaryCurrency value. */
export function isSalaryCurrency(x: unknown): x is SalaryCurrency {
  return VALID_CURRENCIES.includes(x as SalaryCurrency);
}

/** Validates a POST /api/salary request body. Returns ok or an error message. */
export function validateSalaryPost(body: SalaryPostBody): ValidationResult {
  if (!body.role_title || body.years_experience == null || !body.currency) {
    return { ok: false, error: "role_title, years_experience and currency are required" };
  }
  if (!isSalaryCurrency(body.currency)) {
    return { ok: false, error: "Invalid currency" };
  }
  return { ok: true };
}

// ── Aggregation ───────────────────────────────────────────────

type AggKey = string;
type AggMeta = { role: string; exp: number; curr: string; pipeline: string | null };

/**
 * Picks the numeric salary amount from a row based on its currency.
 * EUR/GBP fall back to whichever column is non-null (old schema shape).
 */
export function pickAmount(
  currency: string,
  salary_egp: number | null,
  salary_usd: number | null,
): number | null {
  if (currency === "EGP") return salary_egp;
  if (currency === "USD") return salary_usd;
  return salary_usd ?? salary_egp;
}

/**
 * Buckets a years_experience value into the four display bands.
 * Returns the representative value for each band (1 / 4 / 7 / 10).
 */
export function bucketExperience(years: number): number {
  if (years < 3) return 1;
  if (years < 6) return 4;
  if (years < 10) return 7;
  return 10;
}

/** Groups rows by (role × expBand × currency × pipeline). */
function buildGroups(rows: RawSalaryRow[]): {
  groups: Map<AggKey, number[]>;
  meta: Map<AggKey, AggMeta>;
} {
  const groups = new Map<AggKey, number[]>();
  const meta = new Map<AggKey, AggMeta>();

  for (const row of rows) {
    const amount = pickAmount(row.currency, row.salary_egp, row.salary_usd);
    if (amount == null) continue;

    const expBand = bucketExperience(row.years_experience);
    const key: AggKey = `${row.role_title}|${expBand}|${row.currency}|${row.pipeline ?? "all"}`;

    if (!groups.has(key)) {
      groups.set(key, []);
      meta.set(key, {
        role: row.role_title,
        exp: expBand,
        curr: row.currency,
        pipeline: row.pipeline,
      });
    }
    groups.get(key)!.push(amount);
  }

  return { groups, meta };
}

/**
 * Aggregates raw salary rows into buckets (role × expBand × currency × pipeline).
 * Suppresses buckets with fewer than 2 entries (privacy floor).
 */
export function aggregateSalaries(rows: RawSalaryRow[]): SalaryAggregate[] {
  const { groups, meta } = buildGroups(rows);
  const results: SalaryAggregate[] = [];

  for (const [key, amounts] of groups) {
    if (amounts.length < 2) continue; // privacy floor: suppress micro-samples

    const sorted = [...amounts].sort((a, b) => a - b);
    const m = meta.get(key)!;

    results.push({
      role_title: m.role,
      years_experience: m.exp,
      currency: m.curr as SalaryCurrency,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      median: sorted[Math.floor(sorted.length / 2)],
      count: sorted.length,
      pipeline: m.pipeline as Pipeline | null,
    });
  }

  return results.sort((a, b) => a.role_title.localeCompare(b.role_title));
}
