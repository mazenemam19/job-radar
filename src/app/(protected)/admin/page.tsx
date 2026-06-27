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
    db
      .from("app_config")
      .select("workable_blocked, workable_budget, domain_counts")
      .eq("id", 1)
      .single(),
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
    <div className="p-8">
      <h1 className="m-0 mb-7 text-[22px] font-bold text-slate-200">Admin Dashboard</h1>

      {/* Stats grid */}
      <div className="mb-8 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      {/* Last cron run */}
      {lastCron && (
        <div className="mb-7 rounded-xl border border-[#1e1e30] bg-[#0d0d1a] p-5">
          <h2 className="m-0 mb-3 text-sm text-slate-400">Last cron run</h2>
          <div className="flex flex-wrap gap-6">
            <Stat label="Ran at" value={new Date(lastCron.run_at).toLocaleString()} />
            <Stat label="Trigger" value={lastCron.trigger ?? "—"} />
            <Stat label="Jobs fetched" value={String(lastCron.total_fetched ?? 0)} />
            <Stat label="Duration" value={`${((lastCron.duration_ms ?? 0) / 1000).toFixed(1)}s`} />
          </div>
        </div>
      )}

      {/* Workable rate-limit status */}
      <div className="mb-7 rounded-xl border border-[#1e1e30] bg-[#0d0d1a] p-5">
        <h2 className="m-0 mb-3 text-sm text-slate-400">Workable rate-limit status</h2>
        {workableBudget && (
          <div className={`flex flex-wrap gap-6 ${activeBlocks.length ? "mb-3.5" : ""}`}>
            <Stat label="Visa budget" value={String(workableBudget.visa)} />
            <Stat label="Local budget" value={String(workableBudget.local)} />
            <Stat label="Global budget" value={String(workableBudget.global)} />
          </div>
        )}
        {activeBlocks.length === 0 ? (
          <div className="text-[13px] text-slate-500">
            No companies currently blocked from rate limiting.
          </div>
        ) : (
          <div>
            <div className="mb-1.5 text-xs text-slate-500">
              {activeBlocks.length} compan{activeBlocks.length === 1 ? "y" : "ies"} blocked until
              429 cooldown clears:
            </div>
            <div className="flex flex-wrap gap-1.5">
              {activeBlocks.map((b) => (
                <span
                  key={b.slug}
                  title={`Blocked until ${new Date(b.until).toLocaleString()}`}
                  className="rounded-full bg-rose-400/10 px-2.5 py-0.5 text-xs text-rose-400"
                >
                  {b.slug}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Domain request counts */}
      {appConfig?.domain_counts && Object.keys(appConfig.domain_counts as object).length > 0 && (
        <div className="mb-7 rounded-xl border border-[#1e1e30] bg-[#0d0d1a] p-5">
          <h2 className="m-0 mb-3 text-sm text-slate-400">Domain request counts (rate limiting)</h2>
          <div className="flex flex-wrap gap-4">
            {Object.entries(appConfig.domain_counts as Record<string, number>)
              .sort(([, a], [, b]) => b - a)
              .map(([domain, count]) => (
                <div
                  key={domain}
                  className="flex items-center gap-2 rounded-lg border border-[#1e1e30] bg-[#08080f] px-3 py-1.5"
                >
                  <span className="text-[13px] text-slate-300">{domain}</span>
                  <span className="rounded-full bg-indigo-500/15 px-2 py-0.5 text-xs font-medium text-indigo-400">
                    {count}
                  </span>
                </div>
              ))}
          </div>
          <div className="mt-2 text-[11px] text-slate-600">
            Tracks requests per host for rate limiting. Persisted to Supabase.
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
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
            className="block rounded-[10px] border border-[#1e1e30] bg-[#0d0d1a] px-5 py-4.5 no-underline"
          >
            <div className="mb-1 text-[15px] font-semibold text-slate-200">{link.label}</div>
            <div className="text-xs leading-relaxed text-slate-500">{link.desc}</div>
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
    <div className="rounded-xl border border-[#1e1e30] bg-[#0d0d1a] px-6 py-5">
      <div className="mb-2 text-2xl">{icon}</div>
      <div className="text-[28px] font-bold text-slate-200">{value.toLocaleString()}</div>
      <div className="mt-0.5 text-[13px] text-slate-500">{label}</div>
    </div>
  );

  return href ? (
    <Link href={href} className="no-underline">
      {inner}
    </Link>
  ) : (
    inner
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="mt-0.5 text-sm font-medium text-slate-200">{value}</div>
    </div>
  );
}
