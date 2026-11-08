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
  usd_amount: number | null;
  pipeline: string | null;
  reported_at: string;
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
  amount?: number;
  /** Legacy fields are accepted during the client transition only. */
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
  if (typeof body.role_title !== "string" || !body.role_title.trim() || !body.currency) {
    return { ok: false, error: "role_title and currency are required" };
  }
  if (!isSalaryCurrency(body.currency)) {
    return { ok: false, error: "Invalid currency" };
  }
  if (
    typeof body.years_experience !== "number" ||
    !Number.isFinite(body.years_experience) ||
    body.years_experience < 0 ||
    body.years_experience > 80
  ) {
    return { ok: false, error: "years_experience must be between 0 and 80" };
  }
  if (getSubmittedAmount(body) == null) {
    return { ok: false, error: "A positive salary amount is required" };
  }
  return { ok: true };
}

/** Resolves the new amount field, with a short-lived fallback for older clients. */
export function getSubmittedAmount(body: SalaryPostBody): number | null {
  const amount = body.amount;
  if (typeof amount === "number" && Number.isFinite(amount) && amount > 0) return amount;

  const legacyAmount =
    body.currency === "EGP"
      ? body.salary_egp
      : body.currency === "USD"
        ? body.salary_usd
        : body.salary_usd ?? body.salary_egp;

  return typeof legacyAmount === "number" && Number.isFinite(legacyAmount) && legacyAmount > 0
    ? legacyAmount
    : null;
}

// ── Aggregation ───────────────────────────────────────────────

type AggKey = string;
type AggMeta = {
  role: string;
  exp: number;
  pipeline: string | null;
  earliestReportedAt: string;
  latestReportedAt: string;
};

/**
 * Returns only an auditable USD snapshot. Legacy rows without a recorded
 * conversion deliberately stay out of the combined USD aggregate.
 */
export function pickAmount(usdAmount: number | null): number | null {
  return typeof usdAmount === "number" && Number.isFinite(usdAmount) ? usdAmount : null;
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

/** Groups rows by (role × expBand × pipeline), all in normalized USD. */
function buildGroups(rows: RawSalaryRow[]): {
  groups: Map<AggKey, number[]>;
  meta: Map<AggKey, AggMeta>;
} {
  const groups = new Map<AggKey, number[]>();
  const meta = new Map<AggKey, AggMeta>();

  for (const row of rows) {
    const amount = pickAmount(row.usd_amount);
    if (amount == null) continue;

    const expBand = bucketExperience(row.years_experience);
    const key: AggKey = `${row.role_title}|${expBand}|${row.pipeline ?? "all"}`;

    if (!groups.has(key)) {
      groups.set(key, []);
      meta.set(key, {
        role: row.role_title,
        exp: expBand,
        pipeline: row.pipeline,
        earliestReportedAt: row.reported_at,
        latestReportedAt: row.reported_at,
      });
    } else {
      const existing = meta.get(key)!;
      if (row.reported_at < existing.earliestReportedAt) existing.earliestReportedAt = row.reported_at;
      if (row.reported_at > existing.latestReportedAt) existing.latestReportedAt = row.reported_at;
    }
    groups.get(key)!.push(amount);
  }

  return { groups, meta };
}

/**
 * Aggregates raw salary rows into USD buckets (role × expBand × pipeline).
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
      currency: "USD",
      min: sorted[0],
      max: sorted[sorted.length - 1],
      median: sorted[Math.floor(sorted.length / 2)],
      count: sorted.length,
      pipeline: m.pipeline as Pipeline | null,
      earliest_reported_at: m.earliestReportedAt,
      latest_reported_at: m.latestReportedAt,
    });
  }

  return results.sort((a, b) => a.role_title.localeCompare(b.role_title));
}
