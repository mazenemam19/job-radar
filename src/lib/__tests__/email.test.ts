/**
 * email.test.ts — Tier 1, Test 5
 *
 * WHY this test exists:
 *   The nodemailer major bump (6.x → 9.x, Tier 2a) is a semver-major jump
 *   with API changes (isSemVerMajor: true from npm audit). This is the only
 *   thing that stands between that bump and "the build succeeded" being the
 *   sole signal that emails still send. email.ts had zero existing coverage.
 *
 * Approach:
 *   Mock nodemailer.createTransport before the module loads (vi.hoisted
 *   ensures the mock factory runs before any import). Capture the mock
 *   sendMail function and assert it is called with the right shape.
 *   No real SMTP server required.
 *
 * The mock must be in place before email.ts is imported because email.ts
 * likely calls createTransport() at module level to create a long-lived
 * transporter. vi.hoisted() is the vitest-native way to declare variables
 * that are available inside vi.mock() factories (which are hoisted above
 * imports by the transform).
 */

import { vi, describe, beforeEach, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Hoist the mock sendMail fn so it's available inside the vi.mock factory.
// ---------------------------------------------------------------------------
const mockSendMail = vi.hoisted(() =>
  vi
    .fn<(mailOptions: Record<string, unknown>) => Promise<{ messageId: string }>>()
    .mockResolvedValue({ messageId: "mock-message-id" }),
);

vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn().mockReturnValue({ sendMail: mockSendMail, verify: vi.fn() }),
  },
}));

// Import AFTER vi.mock so the mocked transport is used at module initialisation.
// Adjust the import path if email.ts lives elsewhere.
// eslint-disable-next-line import/order
import { sendJobAlertEmail } from "../email";
import type { ScoredJob } from "../types";

// ---------------------------------------------------------------------------
// Minimal job shape — only the fields the email template actually reads.
// Keep this in sync if the ProcessedJob type gains required fields.
// ---------------------------------------------------------------------------
const MOCK_JOB = {
  id: "test-job-001",
  title: "Software Engineer",
  company: "Acme Corp",
  location: "Remote",
  country_flag: "🌍",
  mode: "global",
  url: "https://example.com/jobs/001",
  total_score: 85,
  matched_skills: ["TypeScript", "React"],
  gemini_reviewed: true,
  gemini_quota_exhausted: false,
  posted_at: new Date().toISOString(),
} as unknown as ScoredJob;

const RECIPIENT = "user@example.com";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("sendJobAlertEmail", () => {
  beforeEach(() => {
    mockSendMail.mockClear();
  });

  it("calls sendMail exactly once per invocation", async () => {
    await sendJobAlertEmail([MOCK_JOB], RECIPIENT);
    expect(mockSendMail).toHaveBeenCalledOnce();
  });

  it("sends to the correct recipient address", async () => {
    await sendJobAlertEmail([MOCK_JOB], RECIPIENT);
    const [mailOptions] = mockSendMail.mock.calls[0];
    expect(mailOptions.to).toBe(RECIPIENT);
  });

  it("includes a non-empty subject", async () => {
    await sendJobAlertEmail([MOCK_JOB], RECIPIENT);
    const [mailOptions] = mockSendMail.mock.calls[0];
    expect(typeof mailOptions.subject).toBe("string");
    expect((mailOptions.subject as string).length).toBeGreaterThan(0);
  });

  it("includes HTML content referencing the job", async () => {
    await sendJobAlertEmail([MOCK_JOB], RECIPIENT);
    const [mailOptions] = mockSendMail.mock.calls[0];
    const html = mailOptions.html as string;
    expect(typeof html).toBe("string");
    expect(html.length).toBeGreaterThan(0);
    // The email body should mention the job or company somewhere.
    expect(html).toMatch(/acme|software engineer|example\.com/i);
  });

  it("does not send when jobs array is empty", async () => {
    // Sending an alert with no jobs is a no-op — nothing to report.
    await sendJobAlertEmail([], RECIPIENT);
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it("includes gemini_quota_exhausted warning in HTML when quota is exhausted", async () => {
    // Added in the 2026-06-25 truncation-fix commit (6d2d68c).
    // The email now shows a quota-exhausted badge to recipients.
    await sendJobAlertEmail(
      [{ ...MOCK_JOB, gemini_reviewed: false, gemini_quota_exhausted: true }],
      RECIPIENT,
    );
    const [mailOptions] = mockSendMail.mock.calls[0];
    const html = mailOptions.html as string;
    // "quota" or "exhausted" must appear somewhere in the body.
    expect(html).toMatch(/quota|exhausted/i);
  });

  it("sends successfully when multiple jobs are provided", async () => {
    const jobs = [MOCK_JOB, { ...MOCK_JOB, id: "test-job-002", title: "Staff Engineer" }];
    await sendJobAlertEmail(jobs, RECIPIENT);
    expect(mockSendMail).toHaveBeenCalledOnce();
    const [mailOptions] = mockSendMail.mock.calls[0];
    // Both jobs should appear in the HTML.
    expect(mailOptions.html as string).toMatch(/software engineer/i);
    expect(mailOptions.html as string).toMatch(/staff engineer/i);
  });
});
