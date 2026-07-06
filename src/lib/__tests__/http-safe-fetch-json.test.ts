// src/lib/__tests__/http-safe-fetch-json.test.ts
// Regression guard for issue #52 (200-status responses with an HTML body):
// a bot-challenge/WAF page served with HTTP 200 satisfies `res.ok`, so a
// bare `res.json()` call crashes with a misleading "Parse Error". These
// tests prove safeFetchJson() catches that case explicitly via content-type,
// on top of the ordinary network/HTTP-error/malformed-JSON cases.
import { describe, it, expect, vi, afterEach } from "vitest";

describe("safeFetchJson", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("returns parsed data on a real JSON response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json; charset=utf-8" }),
        text: async () => JSON.stringify([{ id: "1" }]),
      }),
    );

    const { safeFetchJson } = await import("../sources/ats/http");
    const result = await safeFetchJson<Array<{ id: string }>>("https://example.com/jobs");

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual([{ id: "1" }]);
  });

  it("fails with the response body's content-type on a 200 HTML/WAF challenge page", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "text/html; charset=utf-8" }),
        text: async () => "<!DOCTYPE html><html><body>Just a moment...</body></html>",
      }),
    );

    const { safeFetchJson } = await import("../sources/ats/http");
    const result = await safeFetchJson("https://example.com/jobs");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Non-JSON response");
      expect(result.error).toContain("text/html");
    }
  });

  it("fails with the HTTP status on a non-2xx response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 404, headers: new Headers() }),
    );

    const { safeFetchJson } = await import("../sources/ats/http");
    const result = await safeFetchJson("https://example.com/jobs");

    expect(result).toEqual({ ok: false, error: "HTTP 404" });
  });

  it("fails on network error/timeout (safeFetch returns null)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => Promise.reject(new Error("network down"))),
    );

    const { safeFetchJson } = await import("../sources/ats/http");
    const result = await safeFetchJson("https://example.com/jobs");

    expect(result).toEqual({ ok: false, error: "Network/Timeout" });
  });

  it("fails on a JSON content-type header with a malformed body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () => "{not valid json",
      }),
    );

    const { safeFetchJson } = await import("../sources/ats/http");
    const result = await safeFetchJson("https://example.com/jobs");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Parse Error");
  });
});
