import type { SalaryCurrency } from "@/lib/types";

const FX_API_BASE_URL = "https://open.er-api.com/v6/latest";
export const FX_RATE_SOURCE = "exchangerate-api.com";

type FxPayload = {
  result?: unknown;
  rates?: { USD?: unknown };
  time_last_update_unix?: unknown;
};

type FetchLike = (input: string, init?: RequestInit) => Promise<Pick<Response, "json" | "ok">>;

export type UsdConversion = {
  usdAmount: number;
  usdConversionRate: number;
  usdRateAsOf: string;
  usdRateSource: string;
};

export class SalaryFxError extends Error {
  constructor(message = "A current USD conversion rate is unavailable") {
    super(message);
    this.name = "SalaryFxError";
  }
}

function roundUsd(amount: number): number {
  return Number(amount.toFixed(2));
}

function parseFxPayload(payload: FxPayload): { rate: number; asOf: string } {
  const rate = payload.rates?.USD;
  const updatedAt = payload.time_last_update_unix;

  if (
    payload.result !== "success" ||
    typeof rate !== "number" ||
    !Number.isFinite(rate) ||
    rate <= 0 ||
    typeof updatedAt !== "number" ||
    !Number.isFinite(updatedAt)
  ) {
    throw new SalaryFxError();
  }

  return { rate, asOf: new Date(updatedAt * 1_000).toISOString().slice(0, 10) };
}

/**
 * Captures a USD conversion once, at report ingestion. The dashboard reads the
 * stored snapshot and never calls an external currency service.
 */
export async function getUsdConversion(
  amount: number,
  currency: SalaryCurrency,
  fetcher: FetchLike = fetch,
): Promise<UsdConversion> {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new SalaryFxError("A positive salary amount is required for conversion");
  }

  if (currency === "USD") {
    return {
      usdAmount: roundUsd(amount),
      usdConversionRate: 1,
      usdRateAsOf: new Date().toISOString().slice(0, 10),
      usdRateSource: "original-usd",
    };
  }

  let response: Pick<Response, "json" | "ok">;
  try {
    response = await fetcher(`${FX_API_BASE_URL}/${currency}`, { cache: "no-store" });
  } catch {
    throw new SalaryFxError();
  }

  if (!response.ok) throw new SalaryFxError();

  let payload: FxPayload;
  try {
    payload = (await response.json()) as FxPayload;
  } catch {
    throw new SalaryFxError();
  }

  const { rate, asOf } = parseFxPayload(payload);
  return {
    usdAmount: roundUsd(amount * rate),
    usdConversionRate: rate,
    usdRateAsOf: asOf,
    usdRateSource: FX_RATE_SOURCE,
  };
}
