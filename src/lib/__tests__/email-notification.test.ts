// src/lib/__tests__/email-notification.test.ts
import { describe, it, expect, vi } from "vitest";

const sendMailMock = vi.fn().mockResolvedValue({ messageId: "test-123" });

// Mock nodemailer before importing email module
vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: sendMailMock,
    })),
  },
}));

describe("sendNewScanNotificationEmail", () => {
  beforeEach(() => {
    sendMailMock.mockClear();
  });

  it("sends an email with the correct subject", async () => {
    const { sendNewScanNotificationEmail } = await import("../email");
    await sendNewScanNotificationEmail(42, "user@example.com");

    expect(sendMailMock).toHaveBeenCalledTimes(1);
    const call = sendMailMock.mock.calls[0][0];
    expect(call.to).toBe("user@example.com");
    expect(call.subject).toContain("New jobs available");
  });

  it("includes the company count in the email body", async () => {
    const { sendNewScanNotificationEmail } = await import("../email");
    await sendNewScanNotificationEmail(95, "user@example.com");

    const call = sendMailMock.mock.calls[0][0];
    expect(call.html).toContain("95 companies");
    expect(call.html).toContain("user@example.com");
  });

  it("includes a link to the dashboard", async () => {
    const { sendNewScanNotificationEmail } = await import("../email");
    await sendNewScanNotificationEmail(10, "user@example.com");

    const call = sendMailMock.mock.calls[0][0];
    expect(call.html).toContain("/dashboard");
  });

  it("does NOT include any job listings in the email", async () => {
    const { sendNewScanNotificationEmail } = await import("../email");
    await sendNewScanNotificationEmail(10, "user@example.com");

    const call = sendMailMock.mock.calls[0][0];

    // Should not contain job-specific data
    expect(call.html).not.toContain("Senior Frontend Engineer");
    expect(call.html).not.toContain("total_score");
    expect(call.html).not.toContain("matched_skills");
  });
});
