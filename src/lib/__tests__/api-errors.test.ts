// src/lib/__tests__/api-errors.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock NextResponse before importing the module under test
vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init: { status: number }) => ({
      body,
      status: init.status,
      json: async () => body,
    }),
  },
}));

import { dbErrorResponse, catchErrorResponse } from "../api-errors";

describe("dbErrorResponse", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns status 500", () => {
    const res = dbErrorResponse("tracker:GET", { message: "connection refused" });
    expect(res.status).toBe(500);
  });

  it("returns an actionable development diagnostic to the client", async () => {
    const res = dbErrorResponse("tracker:GET", { message: "raw supabase detail" });
    const body = await res.json();
    expect(body).toEqual({
      ok: false,
      code: "tracker:GET",
      error: "Request failed in tracker:GET: raw supabase detail",
      detail: "raw supabase detail",
    });
  });

  it("keeps raw diagnostics out of production responses", async () => {
    vi.stubEnv("NODE_ENV", "production");

    try {
      const res = dbErrorResponse("tracker:GET", { message: "raw supabase detail" });
      const body = await res.json();

      expect(body).toEqual({
        ok: false,
        code: "tracker:GET",
        error: "Request failed in tracker:GET. Please try again.",
      });
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("logs the real error message with the context tag", () => {
    const spy = vi.spyOn(console, "error");
    dbErrorResponse("admin/companies:DELETE", { message: "row not found" });
    expect(spy).toHaveBeenCalledWith("[admin/companies:DELETE]", "row not found");
  });
});

describe("catchErrorResponse", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns status 500", () => {
    const res = catchErrorResponse("strategy:POST", new Error("Gemini quota exceeded"));
    expect(res.status).toBe(500);
  });

  it("returns the caught error with operation context in development", async () => {
    const res = catchErrorResponse("settings:PATCH", new Error("invalid SSL cert"));
    const body = await res.json();
    expect(body).toEqual({
      ok: false,
      code: "settings:PATCH",
      error: "Request failed in settings:PATCH: invalid SSL cert",
      detail: "invalid SSL cert",
    });
  });

  it("handles Error instances — logs err.message", () => {
    const spy = vi.spyOn(console, "error");
    catchErrorResponse("cron", new Error("timeout"));
    expect(spy).toHaveBeenCalledWith("[cron]", "timeout");
  });

  it("handles non-Error thrown values (string)", () => {
    const spy = vi.spyOn(console, "error");
    catchErrorResponse("cron", "string thrown");
    expect(spy).toHaveBeenCalledWith("[cron]", "string thrown");
  });

  it("handles null/undefined thrown values", () => {
    const spy = vi.spyOn(console, "error");
    catchErrorResponse("cron", null);
    expect(spy).toHaveBeenCalledWith("[cron]", "null");

    catchErrorResponse("cron", undefined);
    expect(spy).toHaveBeenCalledWith("[cron]", "undefined");
  });
});
