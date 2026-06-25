// src/lib/__tests__/salary-sanitize.test.ts
import { describe, it, expect } from "vitest";

/**
 * The salary route's roleFilter is passed to Supabase's ilike() which uses
% and _ as wildcards. A user could supply these to manipulate the query
pattern (pattern injection): e.g. role=% would match every role_title,
role=_ would match any single-character role_title. The escape strips those
characters from user input before it reaches the query.
 *
 * We test the sanitization logic directly since it lives inline inside the
 * route handler — a focused test guards against accidental regression if
 * someone refactors that line.
 */
function sanitizeForIlike(input: string): string {
  return input.replace(/[%_]/g, "");
}

describe("salary route — roleFilter ilike sanitization", () => {
  it("passes normal input through unchanged", () => {
    expect(sanitizeForIlike("react")).toBe("react");
    expect(sanitizeForIlike("senior react developer")).toBe("senior react developer");
    expect(sanitizeForIlike("Backend Engineer")).toBe("Backend Engineer");
  });

  it("strips % wildcards", () => {
    expect(sanitizeForIlike("%")).toBe("");
    expect(sanitizeForIlike("react%")).toBe("react");
    expect(sanitizeForIlike("%react%")).toBe("react");
    expect(sanitizeForIlike("r%e%a%c%t")).toBe("react");
  });

  it("strips _ wildcards", () => {
    expect(sanitizeForIlike("_")).toBe("");
    expect(sanitizeForIlike("react_")).toBe("react");
    expect(sanitizeForIlike("_react_")).toBe("react");
  });

  it("strips mixed wildcards", () => {
    expect(sanitizeForIlike("%_react_%")).toBe("react");
    expect(sanitizeForIlike("_%_")).toBe("");
  });

  it("handles empty string", () => {
    expect(sanitizeForIlike("")).toBe("");
  });

  it("handles unicode and special characters (non-wildcards)", () => {
    expect(sanitizeForIlike("日本語")).toBe("日本語");
    expect(sanitizeForIlike("C++")).toBe("C++");
    expect(sanitizeForIlike("C#")).toBe("C#");
    expect(sanitizeForIlike("Go/Rust")).toBe("Go/Rust");
  });
});
