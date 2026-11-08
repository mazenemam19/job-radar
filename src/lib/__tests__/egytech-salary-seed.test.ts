import { describe, expect, it } from "vitest";
import {
  EGYTECH_EGP_PER_USD_JUNE_2024,
  EGYTECH_USD_RATE_AS_OF,
  mapEgytechParticipants,
} from "../egytech-salary-seed";

const egpParticipant = {
  Timestamp: "4/10/2024 10:20:10",
  Title: "Frontend Engineer",
  Level: "Mid-level",
  Yoe: 3.5,
  TotalCompensationEgp: 47_709,
  IsEgp: "EGP",
  WorkSetting: "Hybrid",
  BusinessMarket: "Local",
  CompanyLocation: "Cairo",
};

describe("mapEgytechParticipants", () => {
  it("preserves an explicit EGP record and its source timestamp", () => {
    const { rows, skipped } = mapEgytechParticipants([egpParticipant]);

    expect(skipped).toEqual({ nonEgpOrHybrid: 0, invalid: 0 });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      source: "egytech",
      role_title: "Frontend Engineer",
      years_experience: 3,
      years_experience_exact: 3.5,
      original_amount: 47_709,
      original_currency: "EGP",
      usd_amount: 1_000,
      usd_rate_as_of: EGYTECH_USD_RATE_AS_OF,
      work_arrangement: "hybrid",
      reported_at: "2024-04-10T10:20:10.000Z",
    });
    expect(rows[0].usd_conversion_rate).toBe(
      Number((1 / EGYTECH_EGP_PER_USD_JUNE_2024).toFixed(10)),
    );
  });

  it("derives a stable source key from the documented source fields", () => {
    const first = mapEgytechParticipants([egpParticipant]).rows[0].source_record_key;
    const second = mapEgytechParticipants([{ ...egpParticipant, UnusedFutureField: "ignored" }])
      .rows[0].source_record_key;

    expect(first).toBe(second);
  });

  it("preserves a decimal source amount while rounding only the legacy integer field", () => {
    const { rows } = mapEgytechParticipants([
      { ...egpParticipant, TotalCompensationEgp: 18_583.3 },
    ]);

    expect(rows[0]).toMatchObject({
      salary_egp: 18_583,
      original_amount: 18_583.3,
      usd_amount: Number((18_583.3 / EGYTECH_EGP_PER_USD_JUNE_2024).toFixed(2)),
    });
  });

  it("skips foreign and hybrid records whose original currency is unknown", () => {
    const result = mapEgytechParticipants([
      { ...egpParticipant, IsEgp: "Another currency (e.g USD)" },
      { ...egpParticipant, IsEgp: "Hybrid (e.g: Base in EGP and Cost of Living Allowance in EUR)" },
    ]);

    expect(result.rows).toEqual([]);
    expect(result.skipped).toEqual({ nonEgpOrHybrid: 2, invalid: 0 });
  });

  it("skips malformed source records rather than creating an incomplete report", () => {
    const result = mapEgytechParticipants([
      { ...egpParticipant, TotalCompensationEgp: 0 },
      { ...egpParticipant, Timestamp: "13/40/2024 10:20:10" },
      null,
    ]);

    expect(result.rows).toEqual([]);
    expect(result.skipped).toEqual({ nonEgpOrHybrid: 0, invalid: 3 });
  });
});
