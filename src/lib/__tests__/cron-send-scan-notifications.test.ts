// src/lib/__tests__/cron-send-scan-notifications.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/email", () => ({
  sendNewScanNotificationEmail: vi.fn().mockResolvedValue(undefined),
}));

import { sendNewScanNotificationEmail } from "@/lib/email";
import { sendScanNotifications } from "../cron/send-scan-notifications";

function makeDb(users: Array<Record<string, unknown>> | null) {
  const eq2 = vi.fn().mockResolvedValue({ data: users, error: null });
  const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
  const select = vi.fn().mockReturnValue({ eq: eq1 });
  return { from: vi.fn().mockReturnValue({ select }) };
}

describe("sendScanNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("is a no-op when no companies were scanned", async () => {
    const db = makeDb([{ email: "a@example.com", user_settings: null }]);
    const result = await sendScanNotifications(db as never, 0);

    expect(db.from).not.toHaveBeenCalled();
    expect(result.emailResults).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it("sends to eligible users and skips opted-out ones", async () => {
    const db = makeDb([
      { email: "in@example.com", user_settings: { email_alerts_enabled: true } },
      { email: "out@example.com", user_settings: { email_alerts_enabled: false } },
      { email: "default@example.com", user_settings: null },
    ]);

    const result = await sendScanNotifications(db as never, 3);

    expect(sendNewScanNotificationEmail).toHaveBeenCalledTimes(2);
    expect(sendNewScanNotificationEmail).toHaveBeenCalledWith(3, "in@example.com");
    expect(sendNewScanNotificationEmail).toHaveBeenCalledWith(3, "default@example.com");
    expect(result.emailResults.filter((r) => r.sent)).toHaveLength(2);
  });

  it("records a failed send as an error without stopping the rest", async () => {
    const db = makeDb([
      { email: "fails@example.com", user_settings: { email_alerts_enabled: true } },
      { email: "ok@example.com", user_settings: { email_alerts_enabled: true } },
    ]);

    vi.mocked(sendNewScanNotificationEmail)
      .mockRejectedValueOnce(new Error("smtp down"))
      .mockResolvedValueOnce(undefined);

    const result = await sendScanNotifications(db as never, 2);

    expect(result.errors).toEqual(["Email failed for fails@example.com: smtp down"]);
    expect(result.emailResults).toContainEqual({ email: "ok@example.com", sent: true });
  });

  it("returns empty results when there are no eligible users", async () => {
    const db = makeDb([]);
    const result = await sendScanNotifications(db as never, 5);

    expect(sendNewScanNotificationEmail).not.toHaveBeenCalled();
    expect(result.emailResults).toEqual([]);
  });
});
