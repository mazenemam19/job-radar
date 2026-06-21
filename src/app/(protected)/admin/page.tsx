// src/app/v2/admin/page.tsx
import { createAdminClient } from "@/lib/v2/supabase/admin";
import Link from "next/link";

export default async function AdminIndexPage() {
  const db = createAdminClient();

  const [
    { count: userCount },
    { count: companyCount },
    { count: jobCount },
    { count: pendingCount },
    { data: lastCron },
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
  ]);

  const stats = [
    { label: "Users", value: userCount ?? 0, href: "/v2/admin/users", icon: "👥" },
    {
      label: "Active companies",
      value: companyCount ?? 0,
      href: "/v2/admin/companies",
      icon: "🏢",
    },
    { label: "Raw jobs in pool", value: jobCount ?? 0, href: null, icon: "📦" },
    {
      label: "Pending submissions",
      value: pendingCount ?? 0,
      href: "/v2/admin/submissions",
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
            href: "/v2/admin/users",
            label: "Manage users",
            desc: "View all users, activate / block accounts",
          },
          {
            href: "/v2/admin/companies",
            label: "ATS Companies",
            desc: "Add, edit, remove companies from the scrape list",
          },
          {
            href: "/v2/admin/defaults",
            label: "Default settings",
            desc: "Edit the default filter profile inherited by all users",
          },
          {
            href: "/v2/admin/submissions",
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
