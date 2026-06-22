// src/app/admin/page.tsx
import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";

export default async function AdminIndexPage() {
  const db = createAdminClient();

  const [
    { count: userCount },
    { count: companyCount },
    { count: jobCount },
    { count: pendingCount },
    { data: lastCron },
    { data: appConfig },
  ] = await Promise.all([
    db.from("user_profiles").select("*", { count: "exact", head: true }),
    db.from("ats_companies").select("*", { count: "exact", head: true }).eq("is_active", true),
    db.from("raw_jobs").select("*", { count: "exact", head: true }),
    db.from("ats_submissions").select("*", { count: "exact", head: true }).eq("status", "pending"),
    db
      .from("cron_logs_v2")
      .select("run_at, total_fetched, duration_ms, trigger")
      .order("run_at", { ascending: false })
      .limit(1)
      .single(),
    db.from("app_config").select("workable_blocked, workable_budget").eq("id", 1).single(),
  ]);

  const workableBlocked =
    (appConfig?.workable_blocked as { slug: string; until: string }[] | null) ?? [];
  const activeBlocks = workableBlocked.filter((e) => new Date(e.until).getTime() > Date.now());
  const workableBudget = appConfig?.workable_budget as {
    visa: number;
    global: number;
    local: number;
  } | null;

  const stats = [
    { label: "Users", value: userCount ?? 0, href: "/admin/users", icon: "👥" },
    {
      label: "Active companies",
      value: companyCount ?? 0,
      href: "/admin/companies",
      icon: "🏢",
    },
    { label: "Raw jobs in pool", value: jobCount ?? 0, href: null, icon: "📦" },
    {
      label: "Pending submissions",
      value: pendingCount ?? 0,
      href: "/admin/submissions",
      icon: "📬",
    },
  ];

  return (
    <div style={{ padding: 32 }}>
      <h1 style={{ margin: "0 0 28px", fontSize: 22, color: "#e2e8f0", fontWeight: 700 }}>
        Admin Dashboard
      </h1>

      {/* Stats grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 16,
          marginBottom: 32,
        }}
      >
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      {/* Last cron run */}
      {lastCron && (
        <div
          style={{
            background: "#0d0d1a",
            border: "1px solid #1e1e30",
            borderRadius: 12,
            padding: 20,
            marginBottom: 28,
          }}
        >
          <h2 style={{ margin: "0 0 12px", fontSize: 14, color: "#94a3b8" }}>Last cron run</h2>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <Stat label="Ran at" value={new Date(lastCron.run_at).toLocaleString()} />
            <Stat label="Trigger" value={lastCron.trigger ?? "—"} />
            <Stat label="Jobs fetched" value={String(lastCron.total_fetched ?? 0)} />
            <Stat label="Duration" value={`${((lastCron.duration_ms ?? 0) / 1000).toFixed(1)}s`} />
          </div>
        </div>
      )}

      {/* Workable rate-limit status */}
      <div
        style={{
          background: "#0d0d1a",
          border: "1px solid #1e1e30",
          borderRadius: 12,
          padding: 20,
          marginBottom: 28,
        }}
      >
        <h2 style={{ margin: "0 0 12px", fontSize: 14, color: "#94a3b8" }}>
          Workable rate-limit status
        </h2>
        {workableBudget && (
          <div
            style={{
              display: "flex",
              gap: 24,
              flexWrap: "wrap",
              marginBottom: activeBlocks.length ? 14 : 0,
            }}
          >
            <Stat label="Visa budget" value={String(workableBudget.visa)} />
            <Stat label="Local budget" value={String(workableBudget.local)} />
            <Stat label="Global budget" value={String(workableBudget.global)} />
          </div>
        )}
        {activeBlocks.length === 0 ? (
          <div style={{ fontSize: 13, color: "#64748b" }}>
            No companies currently blocked from rate limiting.
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>
              {activeBlocks.length} compan{activeBlocks.length === 1 ? "y" : "ies"} blocked until
              429 cooldown clears:
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {activeBlocks.map((b) => (
                <span
                  key={b.slug}
                  title={`Blocked until ${new Date(b.until).toLocaleString()}`}
                  style={{
                    padding: "3px 10px",
                    borderRadius: 20,
                    background: "rgba(251,113,133,0.12)",
                    color: "#fb7185",
                    fontSize: 12,
                  }}
                >
                  {b.slug}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Quick links */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
        }}
      >
        {[
          {
            href: "/admin/users",
            label: "Manage users",
            desc: "View all users, activate / block accounts",
          },
          {
            href: "/admin/companies",
            label: "ATS Companies",
            desc: "Add, edit, remove companies from the scrape list",
          },
          {
            href: "/admin/defaults",
            label: "Default settings",
            desc: "Edit the default filter profile inherited by all users",
          },
          {
            href: "/admin/submissions",
            label: "ATS Submissions",
            desc: "Review HR-submitted companies, run tests, approve",
          },
        ].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            style={{
              display: "block",
              padding: "18px 20px",
              background: "#0d0d1a",
              border: "1px solid #1e1e30",
              borderRadius: 10,
              textDecoration: "none",
            }}
          >
            <div style={{ fontSize: 15, color: "#e2e8f0", fontWeight: 600, marginBottom: 4 }}>
              {link.label}
            </div>
            <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.4 }}>{link.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  href,
}: {
  icon: string;
  label: string;
  value: number;
  href: string | null;
}) {
  const inner = (
    <div
      style={{
        background: "#0d0d1a",
        border: "1px solid #1e1e30",
        borderRadius: 12,
        padding: "20px 24px",
      }}
    >
      <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: "#e2e8f0" }}>
        {value.toLocaleString()}
      </div>
      <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>{label}</div>
    </div>
  );

  return href ? (
    <Link href={href} style={{ textDecoration: "none" }}>
      {inner}
    </Link>
  ) : (
    inner
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "#64748b" }}>{label}</div>
      <div style={{ fontSize: 14, color: "#e2e8f0", fontWeight: 500, marginTop: 2 }}>{value}</div>
    </div>
  );
}
