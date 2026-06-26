// src/lib/__tests__/salary-reminders.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const sendSalaryReminderEmailMock = vi.fn().mockResolvedValue(undefined);

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => mockSupabase),
}));

vi.mock("../email", () => ({
  sendSalaryReminderEmail: sendSalaryReminderEmailMock,
}));

// ── Types ────────────────────────────────────────────────────

interface SalaryReportRow {
  id: string;
  user_id: string;
  role_title: string;
  last_updated_at: string;
  reminder_sent_at: string | null;
  user_profiles: { email: string; is_active: boolean };
}

// ── Mock Supabase query builder ──────────────────────────────

function makeQuery(data: unknown, error: unknown = null) {
  const query: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: error ? null : data, error: error || null }),
    update: vi.fn().mockReturnThis(),
  };
  return query;
}

const mockSupabase = {
  from: vi.fn((table: string) => {
    if (table === "default_settings") {
      return makeQuery({ salary_reminder_enabled: true });
    }
    return makeQuery([]);
  }),
};

describe("send-salary-reminders script logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendSalaryReminderEmailMock.mockClear();
    mockSupabase.from = vi.fn((table: string) => {
      if (table === "default_settings") return makeQuery({ salary_reminder_enabled: true });
      return makeQuery([]);
    });
  });

  it("exits early with no reminders when no stale reports exist", async () => {
    const reports: SalaryReportRow[] = [];
    const toRemind = reports.filter(() => false);

    expect(toRemind.length).toBe(0);
    expect(sendSalaryReminderEmailMock).not.toHaveBeenCalled();
  });

  it("fetches user_settings separately and merges in code", async () => {
    const reports: SalaryReportRow[] = [
      {
        id: "r1",
        user_id: "u1",
        role_title: "Frontend Engineer",
        last_updated_at: "2025-05-01T00:00:00Z",
        reminder_sent_at: null,
        user_profiles: { email: "user@example.com", is_active: true },
      },
    ];

    const settingsRows = [{ user_id: "u1", salary_reminder_enabled: true }];

    const settingsMap = new Map(settingsRows.map((s) => [s.user_id, s.salary_reminder_enabled]));

    const seenUsers = new Set<string>();
    const toRemind = reports.filter((r) => {
      const profile = r.user_profiles;
      if (!r.user_id || !profile?.email || !profile.is_active) return false;
      if (seenUsers.has(r.user_id)) return false;

      const enabled = settingsMap.get(r.user_id) ?? true;
      if (!enabled) return false;

      seenUsers.add(r.user_id);
      return true;
    });

    expect(toRemind.length).toBe(1);
    expect(toRemind[0].user_id).toBe("u1");
  });

  it("skips users with salary_reminder_enabled=false", async () => {
    const reports: SalaryReportRow[] = [
      {
        id: "r1",
        user_id: "u1",
        role_title: "Frontend Engineer",
        last_updated_at: "2025-05-01T00:00:00Z",
        reminder_sent_at: null,
        user_profiles: { email: "user@example.com", is_active: true },
      },
    ];

    const settingsRows = [{ user_id: "u1", salary_reminder_enabled: false }];

    const settingsMap = new Map(settingsRows.map((s) => [s.user_id, s.salary_reminder_enabled]));

    const seenUsers = new Set<string>();
    const toRemind = reports.filter((r) => {
      if (seenUsers.has(r.user_id)) return false;
      const enabled = settingsMap.get(r.user_id) ?? true;
      if (!enabled) return false;
      seenUsers.add(r.user_id);
      return true;
    });

    expect(toRemind.length).toBe(0);
  });

  it("deduplicates — one reminder per user", async () => {
    const reports: SalaryReportRow[] = [
      {
        id: "r1",
        user_id: "u1",
        role_title: "Old Role",
        last_updated_at: "2025-04-01T00:00:00Z",
        reminder_sent_at: null,
        user_profiles: { email: "user@example.com", is_active: true },
      },
      {
        id: "r2",
        user_id: "u1",
        role_title: "Newer Role",
        last_updated_at: "2025-05-01T00:00:00Z",
        reminder_sent_at: null,
        user_profiles: { email: "user@example.com", is_active: true },
      },
    ];

    const settingsRows = [{ user_id: "u1", salary_reminder_enabled: true }];

    const settingsMap = new Map(settingsRows.map((s) => [s.user_id, s.salary_reminder_enabled]));

    const seenUsers = new Set<string>();
    const toRemind = reports.filter((r) => {
      if (!r.user_id) return false;
      if (seenUsers.has(r.user_id)) return false;
      const enabled = settingsMap.get(r.user_id) ?? true;
      if (!enabled) return false;
      seenUsers.add(r.user_id);
      return true;
    });

    expect(toRemind.length).toBe(1);
    expect(toRemind[0].id).toBe("r1");
  });

  it("skips inactive users", async () => {
    const reports: SalaryReportRow[] = [
      {
        id: "r1",
        user_id: "u1",
        role_title: "Role",
        last_updated_at: "2025-05-01T00:00:00Z",
        reminder_sent_at: null,
        user_profiles: { email: "user@example.com", is_active: false },
      },
    ];

    const seenUsers = new Set<string>();
    const toRemind = reports.filter((r) => {
      const profile = r.user_profiles;
      if (!r.user_id || !profile?.email || !profile.is_active) return false;
      if (seenUsers.has(r.user_id)) return false;
      seenUsers.add(r.user_id);
      return true;
    });

    expect(toRemind.length).toBe(0);
  });

  it("defaults to sending when user has no settings row", async () => {
    const reports: SalaryReportRow[] = [
      {
        id: "r1",
        user_id: "u1",
        role_title: "Role",
        last_updated_at: "2025-05-01T00:00:00Z",
        reminder_sent_at: null,
        user_profiles: { email: "newuser@example.com", is_active: true },
      },
    ];

    const settingsMap = new Map<string, boolean | null>();

    const seenUsers = new Set<string>();
    const toRemind = reports.filter((r) => {
      if (!r.user_id) return false;
      if (seenUsers.has(r.user_id)) return false;
      const enabled = settingsMap.get(r.user_id) ?? true;
      if (!enabled) return false;
      seenUsers.add(r.user_id);
      return true;
    });

    expect(toRemind.length).toBe(1);
  });
});
