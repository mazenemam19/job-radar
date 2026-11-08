import { describe, expect, it, vi } from "vitest";
import { FX_RATE_SOURCE, SalaryFxError, getUsdConversion } from "../salary-fx";

describe("getUsdConversion", () => {
  it("keeps an original USD report at a 1:1 audited conversion", async () => {
    const fetcher = vi.fn();

    const result = await getUsdConversion(1_234.567, "USD", fetcher);

    expect(result.usdAmount).toBe(1_234.57);
    expect(result.usdConversionRate).toBe(1);
    expect(result.usdRateSource).toBe("original-usd");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("stores a provider rate and its effective date for a non-USD report", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        result: "success",
        rates: { USD: 1.2 },
        time_last_update_unix: 1_719_792_000,
      }),
    });

    const result = await getUsdConversion(100, "EUR", fetcher);

    expect(fetcher).toHaveBeenCalledWith("https://open.er-api.com/v6/latest/EUR", {
      cache: "no-store",
    });
    expect(result).toEqual({
      usdAmount: 120,
      usdConversionRate: 1.2,
      usdRateAsOf: "2024-07-01",
      usdRateSource: FX_RATE_SOURCE,
    });
  });

  it("rejects malformed or unavailable FX data instead of guessing a rate", async () => {
    await expect(
      getUsdConversion(100, "GBP", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })),
    ).rejects.toBeInstanceOf(SalaryFxError);

    await expect(
      getUsdConversion(100, "EGP", vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) })),
    ).rejects.toBeInstanceOf(SalaryFxError);
  });
});
