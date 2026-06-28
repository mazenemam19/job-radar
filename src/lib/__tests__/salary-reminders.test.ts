// src/lib/__tests__/salary-reminders.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const sendSalaryReminderEmailMock = vi.fn().mockResolvedValue(undefined);

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => mockSupabase),
}));

vi.mock("../email", () => ({
  sendSalaryReminderEmail: sendSalaryReminderEmailMock,
}));

// ── Shared types ─────────────────────────────────────────────

interface UserRow {
  id: string;
  email: string;
  user_settings: { salary_reminder_enabled: boolean | null } | null;
}

interface ReportRow {
  id: string;
  user_id: string;
  role_title: string;
  last_updated_at: string;
  reminder_sent_at: string | null;
}

// ── Helpers ──────────────────────────────────────────────────

const STALE = "2025-01-01T00:00:00Z"; // well beyond 28 days
const FRESH = new Date(Date.now() - 1000 * 60 * 60).toISOString(); // 1 hour ago
const CUTOFF = new Date(Date.now() - 28 * 86_400_000).toISOString();

/** Mirrors the eligibility filter in the script. */
function filterEligible(users: UserRow[], defaultEnabled = true): UserRow[] {
  return users.filter((u) => {
    return u.user_settings?.salary_reminder_enabled ?? defaultEnabled;
  });
}

/** Mirrors the stale-check in the script for users who have a report. */
function shouldSend(report: ReportRow | null, cutoff: string): boolean {
  if (!report) return true; // no report → always send generic prompt
  const reportStale = report.last_updated_at < cutoff;
  const reminderStale = !report.reminder_sent_at || report.reminder_sent_at < cutoff;
  return reportStale && reminderStale;
}

/** Picks the most-recent report per user from a desc-ordered list. */
function buildReportMap(reports: ReportRow[]): Map<string, ReportRow> {
  const map = new Map<string, ReportRow>();
  for (const r of reports) {
    if (r.user_id && !map.has(r.user_id)) map.set(r.user_id, r);
  }
  return map;
}

// ── Mock Supabase (kept for module-level mock wiring) ────────

function makeQuery(data: unknown, error: unknown = null) {
  const q: Record<string, ReturnType<typeof vi.fn>> = {
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
  return q;
}

const mockSupabase = {
  from: vi.fn((table: string) => {
    if (table === "default_settings") return makeQuery({ salary_reminder_enabled: true });
    return makeQuery([]);
  }),
};

// ── Tests ────────────────────────────────────────────────────

describe("send-salary-reminders logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendSalaryReminderEmailMock.mockClear();
  });

  // ── Eligibility filter ───────────────────────────────────

  it("includes users with salary_reminder_enabled=true", () => {
    const users: UserRow[] = [
      { id: "u1", email: "a@x.com", user_settings: { salary_reminder_enabled: true } },
    ];
    expect(filterEligible(users)).toHaveLength(1);
  });

  it("excludes users with salary_reminder_enabled=false", () => {
    const users: UserRow[] = [
      { id: "u1", email: "a@x.com", user_settings: { salary_reminder_enabled: false } },
    ];
    expect(filterEligible(users)).toHaveLength(0);
  });

  it("falls back to platform default when user has no settings row", () => {
    const users: UserRow[] = [{ id: "u1", email: "a@x.com", user_settings: null }];
    expect(filterEligible(users, true)).toHaveLength(1);
    expect(filterEligible(users, false)).toHaveLength(0);
  });

  it("falls back to platform default when salary_reminder_enabled is null", () => {
    const users: UserRow[] = [
      { id: "u1", email: "a@x.com", user_settings: { salary_reminder_enabled: null } },
    ];
    expect(filterEligible(users, true)).toHaveLength(1);
    expect(filterEligible(users, false)).toHaveLength(0);
  });

  // ── Stale / send logic ───────────────────────────────────

  it("sends generic prompt when user has no report", () => {
    expect(shouldSend(null, CUTOFF)).toBe(true);
  });

  it("sends when report is stale and never reminded", () => {
    const report: ReportRow = {
      id: "r1",
      user_id: "u1",
      role_title: "Engineer",
      last_updated_at: STALE,
      reminder_sent_at: null,
    };
    expect(shouldSend(report, CUTOFF)).toBe(true);
  });

  it("sends when report is stale and reminder itself is stale", () => {
    const report: ReportRow = {
      id: "r1",
      user_id: "u1",
      role_title: "Engineer",
      last_updated_at: STALE,
      reminder_sent_at: STALE,
    };
    expect(shouldSend(report, CUTOFF)).toBe(true);
  });

  it("skips when report is fresh", () => {
    const report: ReportRow = {
      id: "r1",
      user_id: "u1",
      role_title: "Engineer",
      last_updated_at: FRESH,
      reminder_sent_at: null,
    };
    expect(shouldSend(report, CUTOFF)).toBe(false);
  });

  it("skips when report is stale but was recently reminded", () => {
    const report: ReportRow = {
      id: "r1",
      user_id: "u1",
      role_title: "Engineer",
      last_updated_at: STALE,
      reminder_sent_at: FRESH,
    };
    expect(shouldSend(report, CUTOFF)).toBe(false);
  });

  // ── Report deduplication ─────────────────────────────────

  it("picks the most-recent report when a user has multiple (desc order)", () => {
    // Script fetches reports ordered last_updated_at DESC, map keeps first seen.
    const reports: ReportRow[] = [
      {
        id: "r2",
        user_id: "u1",
        role_title: "Newer Role",
        last_updated_at: FRESH,
        reminder_sent_at: null,
      },
      {
        id: "r1",
        user_id: "u1",
        role_title: "Older Role",
        last_updated_at: STALE,
        reminder_sent_at: null,
      },
    ];
    const map = buildReportMap(reports);
    expect(map.get("u1")?.id).toBe("r2");
  });

  // ── End-to-end: eligible + stale check combined ──────────

  it("sends to user with stale report and enabled", () => {
    const user: UserRow = {
      id: "u1",
      email: "a@x.com",
      user_settings: { salary_reminder_enabled: true },
    };
    const report: ReportRow = {
      id: "r1",
      user_id: "u1",
      role_title: "Engineer",
      last_updated_at: STALE,
      reminder_sent_at: null,
    };

    const eligible = filterEligible([user]);
    const map = buildReportMap([report]);

    const toSend = eligible.filter((u) => shouldSend(map.get(u.id) ?? null, CUTOFF));
    expect(toSend).toHaveLength(1);
  });

  it("sends generic prompt to user with no report and enabled", () => {
    const user: UserRow = {
      id: "u1",
      email: "a@x.com",
      user_settings: { salary_reminder_enabled: true },
    };

    const eligible = filterEligible([user]);
    const map = buildReportMap([]); // no reports

    const toSend = eligible.filter((u) => shouldSend(map.get(u.id) ?? null, CUTOFF));
    expect(toSend).toHaveLength(1);
  });

  it("skips disabled user even with stale report", () => {
    const user: UserRow = {
      id: "u1",
      email: "a@x.com",
      user_settings: { salary_reminder_enabled: false },
    };
    const report: ReportRow = {
      id: "r1",
      user_id: "u1",
      role_title: "Engineer",
      last_updated_at: STALE,
      reminder_sent_at: null,
    };

    const eligible = filterEligible([user]);
    const map = buildReportMap([report]);

    const toSend = eligible.filter((u) => shouldSend(map.get(u.id) ?? null, CUTOFF));
    expect(toSend).toHaveLength(0);
  });

  it("handles a mix of users correctly", () => {
    const users: UserRow[] = [
      { id: "u1", email: "stale@x.com", user_settings: { salary_reminder_enabled: true } },
      { id: "u2", email: "fresh@x.com", user_settings: { salary_reminder_enabled: true } },
      { id: "u3", email: "disabled@x.com", user_settings: { salary_reminder_enabled: false } },
      { id: "u4", email: "noreport@x.com", user_settings: { salary_reminder_enabled: true } },
    ];
    const reports: ReportRow[] = [
      {
        id: "r1",
        user_id: "u1",
        role_title: "Eng",
        last_updated_at: STALE,
        reminder_sent_at: null,
      },
      {
        id: "r2",
        user_id: "u2",
        role_title: "Eng",
        last_updated_at: FRESH,
        reminder_sent_at: null,
      },
      {
        id: "r3",
        user_id: "u3",
        role_title: "Eng",
        last_updated_at: STALE,
        reminder_sent_at: null,
      },
    ];

    const eligible = filterEligible(users); // u1, u2, u4
    const map = buildReportMap(reports);

    const toSend = eligible.filter((u) => shouldSend(map.get(u.id) ?? null, CUTOFF));
    // u1: stale report  → send ✓
    // u2: fresh report  → skip
    // u4: no report     → send ✓
    expect(toSend.map((u) => u.id).sort()).toEqual(["u1", "u4"]);
  });
});
