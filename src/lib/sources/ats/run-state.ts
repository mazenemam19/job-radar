// src/lib/sources/ats/run-state.ts
// Run-scoped state shared by all ATS fetchers: per-host request counts and
// Workable's rate-limit cooldown/budget. Split out of ats-utils.ts (see
// AUDIT_STATUS.md row #2) — no behavior change, same exports.
import type { DomainCounts, WorkableCooldownEntry, WorkableBudgetConfig } from "@/types";
import type { JobMode } from "@/lib/types";
import type { Json } from "@/lib/database.types";

let workableBlockedCache: WorkableCooldownEntry[] = [];
// Holds ONLY this run's not-yet-flushed increments — NOT the full historical
// total. flushDomainCountsToDB() adds these onto the DB's existing value via
// an atomic Postgres function (increment_domain_counts), so this cache must
// never be seeded from the DB's current value, or every flush would
// double-count the baseline on top of itself. Reset to null after a
// successful flush so a warm/reused process doesn't resend an already-
// persisted delta on its next run.
let domainCountsCache: DomainCounts | null = null;
// Set by loadWorkableStateFromDB() once the app_config row has actually been
// read. loadDomainCounts() relies on call-order (runner.ts always loads state
// before any fetch happens) — this flag makes that ordering requirement
// visible instead of silently returning {} if it's ever violated.
let stateLoaded = false;

function loadDomainCounts(): DomainCounts {
  if (domainCountsCache) return domainCountsCache;
  if (!stateLoaded) {
    console.warn(
      "[ats-utils] loadDomainCounts() called before loadWorkableStateFromDB() — " +
        "starting this run's delta from zero. Harmless for domain_counts itself " +
        "(the flush is additive, not an overwrite), but it means Workable cooldown/" +
        "budget state wasn't loaded either, since both share this same load step.",
    );
  }
  return {};
}

export function trackDomainRequest(url: string): void {
  try {
    const host = new URL(url).host || "unknown";
    const counts = loadDomainCounts();
    counts[host] = (counts[host] ?? 0) + 1;
    domainCountsCache = counts;
  } catch {}
}

const DEFAULT_BUDGET: WorkableBudgetConfig = { global: 999, local: 999 };
let workableBudget: WorkableBudgetConfig = { ...DEFAULT_BUDGET };
const workableUsedByMode: Record<JobMode, number> = { global: 0, local: 0 };

export function resetWorkableUsed(mode?: JobMode): void {
  if (mode) workableUsedByMode[mode] = 0;
  else {
    workableUsedByMode.global = 0;
    workableUsedByMode.local = 0;
  }
}

export function setWorkableBudgetConfig(config: Partial<WorkableBudgetConfig>): void {
  workableBudget = { ...DEFAULT_BUDGET, ...config };
  resetWorkableUsed();
}

export function getWorkableBudget(): WorkableBudgetConfig {
  return workableBudget;
}

export function getWorkableUsed(mode: JobMode): number {
  return workableUsedByMode[mode];
}

export function incrementWorkableUsed(mode: JobMode): void {
  workableUsedByMode[mode] += 1;
}

// Workable rate-limit state (Supabase-backed).
// Persisted to app_config so the limiter survives across serverless invocations.
// GitHub Actions runs are both stateless per run) — meaning blocks and budget
// config silently reset to defaults on every single cron run. Persisting to
// app_config makes this actually work across runs.

export async function loadWorkableStateFromDB(): Promise<void> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const db = createAdminClient();
  const { data, error } = await db
    .from("app_config")
    .select("workable_blocked, workable_budget")
    .eq("id", 1)
    .single();
  if (error) {
    console.error("[ats-utils] loadWorkableStateFromDB select failed:", error.message);
    return;
  }
  stateLoaded = true;
  if (data?.workable_blocked) {
    workableBlockedCache = (data.workable_blocked as unknown as WorkableCooldownEntry[]).filter(
      (e) => new Date(e.until).getTime() > Date.now(),
    );
  }
  if (data?.workable_budget) {
    workableBudget = {
      ...DEFAULT_BUDGET,
      ...(data.workable_budget as Partial<WorkableBudgetConfig>),
    };
  }
}

export async function flushDomainCountsToDB(): Promise<void> {
  if (!domainCountsCache || Object.keys(domainCountsCache).length === 0) {
    console.log("[ats-utils] flushDomainCountsToDB: nothing to flush, skipping");
    return;
  }
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const db = createAdminClient();
  // Atomic server-side add via increment_domain_counts(increments) instead of
  // a read-modify-write .update() — see the function comment in the
  // migration SQL for why a blind overwrite loses updates when two cron runs
  // overlap. domainCountsCache here is ONLY this run's delta (see comment on
  // its declaration), which is exactly what an additive RPC needs.
  const { error } = await db.rpc("increment_domain_counts", {
    increments: domainCountsCache as unknown as Json,
  });
  if (error) {
    console.error("[ats-utils] flushDomainCountsToDB rpc failed:", error.message);
    return; // keep the unflushed delta around so a retry on a warm process can still send it
  }
  console.log(
    `[ats-utils] flushDomainCountsToDB: flushed ${Object.keys(domainCountsCache).length} hosts`,
  );
  domainCountsCache = null;
}

export async function flushWorkable429sToDB(): Promise<void> {
  const slugs = getWorkable429SlugsThisRun();
  if (slugs.length === 0) {
    console.log("[ats-utils] flushWorkable429sToDB: no 429s this run, skipping");
    return;
  }
  markWorkableSlugsBlocked24h(slugs);

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const db = createAdminClient();
  const { error } = await db
    .from("app_config")
    .update({
      workable_blocked: workableBlockedCache as unknown as Json,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  if (error) {
    console.error("[ats-utils] flushWorkable429sToDB update failed:", error.message);
  } else {
    console.log(`[ats-utils] flushWorkable429sToDB: blocked ${slugs.length} slug(s)`);
  }
}

function setWorkableBlocked(slug: string, until: Date): void {
  const iso = until.toISOString();
  const existing = workableBlockedCache.find((e) => e.slug === slug);
  if (existing) existing.until = iso;
  else workableBlockedCache.push({ slug, until: iso });
}

export function isWorkableBlocked(slug: string): boolean {
  const entry = workableBlockedCache.find((e) => e.slug === slug);
  if (!entry) return false;
  return new Date(entry.until).getTime() > Date.now();
}

const workable429SlugsThisRun = new Set<string>();
export function getWorkable429SlugsThisRun(): string[] {
  return Array.from(workable429SlugsThisRun);
}
export function markWorkableSlugsBlocked24h(slugs: string[]): void {
  const until = new Date(Date.now() + 864e5);
  for (const slug of slugs) setWorkableBlocked(slug, until);
}

export function markWorkable429(slug: string): void {
  workable429SlugsThisRun.add(slug);
  // Block for the remainder of THIS run too, not just future ones —
  // flushWorkable429sToDB only persists to the DB after the whole fetch
  // phase finishes, so without this, isWorkableBlocked() stays blind to a
  // slug that just 429'd until tomorrow's run. See
  // docs/solutions/bugs/issue-52-504-recurrence-part4.md.
  setWorkableBlocked(slug, new Date(Date.now() + 864e5));
}
