// src/scripts/verify-domain-counts-coverage.ts
// Entry point: pnpm tsx src/scripts/verify-domain-counts-coverage.ts
//
// Runs the real fetch step against every active company in public.ats_companies
// — same fetchCompany() dispatch runner.ts uses — but does NOT upsert into
// raw_jobs and does NOT send any emails. The only side effect on Supabase is
// the same domain_counts flush a normal cron run would do.

import { config } from "dotenv";
import path from "path";

config({ path: path.resolve(process.cwd(), ".env.local") });

import { createAdminClient } from "../lib/supabase/admin";
import { fetchCompany } from "../lib/ats-bridge";
import { loadWorkableStateFromDB, flushDomainCountsToDB } from "../lib/sources/ats-utils";
import { withConcurrencyLimit } from "../lib/cron/fetch-jobs";
import type { ATSCompanyRow } from "../lib/types";

const CONCURRENCY_LIMIT = 8;

type FetchTaskResult = { company: string; ats: string; error: string | null };

function printAtsStats(companies: ATSCompanyRow[]): void {
  const byAts = new Map<string, number>();
  for (const row of companies) {
    byAts.set(row.ats, (byAts.get(row.ats) ?? 0) + 1);
  }
  console.log("[verify-coverage] Active companies by ATS:");
  for (const [ats, count] of byAts) {
    console.log(`  ${ats}: ${count}`);
  }
}

function buildFetchTasks(companies: ATSCompanyRow[]): Array<() => Promise<FetchTaskResult>> {
  return companies.map((row) => {
    const mode: "local" | "global" = row.pipeline_local ? "local" : "global";
    return async () => {
      const result = await fetchCompany(row, mode);
      return { company: row.name, ats: row.ats, error: result.error };
    };
  });
}

function printDeltaReport(baseline: Record<string, number>, updated: Record<string, number>): void {
  const allHosts = new Set([...Object.keys(baseline), ...Object.keys(updated)]);
  let trackedAny = false;

  console.log("\n[verify-coverage] Hosts tracked this run (delta since baseline):");
  for (const host of Array.from(allHosts).sort()) {
    const delta = (updated[host] ?? 0) - (baseline[host] ?? 0);
    if (delta > 0) {
      trackedAny = true;
      console.log(`  ${host}: +${delta} (total ${updated[host]})`);
    }
  }

  if (!trackedAny) {
    console.log("  (none — nothing was tracked this run)");
  }
}

function printTeamtailorBreezyStatus(
  companies: ATSCompanyRow[],
  baseline: Record<string, number>,
  updated: Record<string, number>,
): void {
  const allHosts = new Set([...Object.keys(baseline), ...Object.keys(updated)]);
  const teamtailorActive = companies.some((c) => c.ats === "teamtailor");
  const breezyActive = companies.some((c) => c.ats === "breezy");

  const teamtailorTracked = Array.from(allHosts).some(
    (h) => h.endsWith(".teamtailor.com") && (updated[h] ?? 0) - (baseline[h] ?? 0) > 0,
  );
  const breezyTracked = Array.from(allHosts).some(
    (h) => h.endsWith(".breezy.hr") && (updated[h] ?? 0) - (baseline[h] ?? 0) > 0,
  );

  console.log("\n[verify-coverage] Teamtailor/Breezy check:");
  console.log(
    `  Teamtailor: ${teamtailorActive ? "active companies present" : "no active companies"} — ${teamtailorTracked ? "TRACKED ✓" : "not tracked"}`,
  );
  console.log(
    `  Breezy:     ${breezyActive ? "active companies present" : "no active companies"} — ${breezyTracked ? "TRACKED ✓" : "not tracked"}`,
  );
}

(async () => {
  const db = createAdminClient();

  console.log("[verify-coverage] Reading domain_counts baseline...");
  const { data: before } = await db.from("app_config").select("domain_counts").eq("id", 1).single();
  const baseline = (before?.domain_counts as Record<string, number> | null) ?? {};

  console.log("[verify-coverage] Loading active companies...");
  const { data: companies, error } = await db
    .from("ats_companies")
    .select("*")
    .eq("is_active", true);

  if (error || !companies?.length) {
    console.error(
      "[verify-coverage] Could not load active companies:",
      error?.message ?? "none found",
    );
    process.exit(1);
  }

  await loadWorkableStateFromDB();

  const companyRows = companies as ATSCompanyRow[];
  printAtsStats(companyRows);

  const tasks = buildFetchTasks(companyRows);
  console.log(`\n[verify-coverage] Fetching ${tasks.length} companies (no upserts, no emails)...`);
  const results = await withConcurrencyLimit(tasks, CONCURRENCY_LIMIT);
  const failed = results.filter((r) => r.error);
  console.log(`  done — ${results.length - failed.length} ok, ${failed.length} errored`);

  console.log("\n[verify-coverage] Flushing domain_counts...");
  await flushDomainCountsToDB();

  const { data: after } = await db.from("app_config").select("domain_counts").eq("id", 1).single();
  const updated = (after?.domain_counts as Record<string, number> | null) ?? {};

  printDeltaReport(baseline, updated);
  printTeamtailorBreezyStatus(companyRows, baseline, updated);

  process.exit(0);
})();
