import { createHash } from "node:crypto";

export const EGYTECH_PARTICIPANTS_URL = "https://api.egytech.fyi/participants";
export const EGYTECH_SOURCE = "egytech";
export const EGYTECH_EGP_PER_USD_JUNE_2024 = 47.709;
export const EGYTECH_USD_RATE_AS_OF = "2024-06-30";
export const EGYTECH_USD_RATE_SOURCE = "CBE monthly average, June 2024 (47.709 EGP/USD)";

type UnknownRecord = Record<string, unknown>;

export type EgytechSeedRow = {
  source: typeof EGYTECH_SOURCE;
  source_record_key: string;
  role_title: string;
  years_experience: number;
  years_experience_exact: number;
  salary_egp: number;
  salary_usd: null;
  currency: "EGP";
  original_amount: number;
  original_currency: "EGP";
  usd_amount: number;
  usd_conversion_rate: number;
  usd_rate_as_of: typeof EGYTECH_USD_RATE_AS_OF;
  usd_rate_source: typeof EGYTECH_USD_RATE_SOURCE;
  employment_type: null;
  work_arrangement: "onsite" | "hybrid" | "remote" | null;
  pipeline: null;
  reported_at: string;
  last_updated_at: string;
};

export type EgytechSeedResult = {
  rows: EgytechSeedRow[];
  skipped: {
    nonEgpOrHybrid: number;
    invalid: number;
  };
};

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function positiveNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function experience(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 80 ? value : null;
}

/** Parses the source's date-without-time-zone format deterministically as UTC. */
function sourceTimestampToIso(value: unknown): string | null {
  const source = text(value);
  if (!source) return null;

  const match = source.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/);
  if (!match) return null;

  const [, month, day, year, hour, minute, second] = match;
  const date = new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)),
  );

  if (
    Number.isNaN(date.valueOf()) ||
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day) ||
    date.getUTCHours() !== Number(hour) ||
    date.getUTCMinutes() !== Number(minute) ||
    date.getUTCSeconds() !== Number(second)
  ) {
    return null;
  }

  return date.toISOString();
}

function workArrangement(value: unknown): EgytechSeedRow["work_arrangement"] {
  switch (value) {
    case "Office":
      return "onsite";
    case "Hybrid":
      return "hybrid";
    case "Remote/Egypt":
      return "remote";
    default:
      return null;
  }
}

function sourceRecordKey(record: UnknownRecord): string {
  // The upstream API intentionally does not expose an identifier. Hash only
  // documented, non-identifying response fields so reruns stay deterministic
  // even if the API changes response ordering or adds unrelated fields.
  const identity = {
    Timestamp: record.Timestamp,
    Title: record.Title,
    Level: record.Level,
    Yoe: record.Yoe,
    TotalCompensationEgp: record.TotalCompensationEgp,
    IsEgp: record.IsEgp,
    WorkSetting: record.WorkSetting,
    BusinessMarket: record.BusinessMarket,
    CompanyLocation: record.CompanyLocation,
  };
  return createHash("sha256").update(JSON.stringify(identity)).digest("hex");
}

export function mapEgytechParticipants(records: unknown[]): EgytechSeedResult {
  const rows: EgytechSeedRow[] = [];
  const skipped = { nonEgpOrHybrid: 0, invalid: 0 };

  for (const candidate of records) {
    if (!isRecord(candidate)) {
      skipped.invalid++;
      continue;
    }

    // The API's non-EGP/hybrid records do not include the original currency.
    // Never infer one from the EGP-named field or convert it incorrectly.
    if (candidate.IsEgp !== "EGP") {
      skipped.nonEgpOrHybrid++;
      continue;
    }

    const roleTitle = text(candidate.Title);
    const amount = positiveNumber(candidate.TotalCompensationEgp);
    const years = experience(candidate.Yoe);
    const reportedAt = sourceTimestampToIso(candidate.Timestamp);

    if (!roleTitle || amount == null || years == null || !reportedAt) {
      skipped.invalid++;
      continue;
    }

    rows.push({
      source: EGYTECH_SOURCE,
      source_record_key: sourceRecordKey(candidate),
      role_title: roleTitle,
      years_experience: Math.floor(years),
      years_experience_exact: years,
      salary_egp: amount,
      salary_usd: null,
      currency: "EGP",
      original_amount: amount,
      original_currency: "EGP",
      usd_amount: Number((amount / EGYTECH_EGP_PER_USD_JUNE_2024).toFixed(2)),
      usd_conversion_rate: Number((1 / EGYTECH_EGP_PER_USD_JUNE_2024).toFixed(10)),
      usd_rate_as_of: EGYTECH_USD_RATE_AS_OF,
      usd_rate_source: EGYTECH_USD_RATE_SOURCE,
      employment_type: null,
      work_arrangement: workArrangement(candidate.WorkSetting),
      pipeline: null,
      reported_at: reportedAt,
      last_updated_at: reportedAt,
    });
  }

  return { rows, skipped };
}
