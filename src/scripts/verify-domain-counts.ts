// src/scripts/verify-domain-counts.ts
// Entry point: npx ts-node -r tsconfig-paths/register --project tsconfig.scripts.json src/scripts/verify-domain-counts.ts
//
// Round-trips a handful of increments through Supabase's
// increment_domain_counts() RPC and confirms:
//   1. A flush actually persists the count (basic round-trip).
//   2. A second flush with nothing newly tracked does NOT change the value
//      again (regression check for Finding D: domain_counts must never be
//      double-counted by re-sending an already-flushed delta).
//   3. The increment is additive on top of whatever's already there, not a
//      blind overwrite (proves the atomic-increment fix actually works).
//
// Uses a sentinel host on the reserved `.invalid` TLD (RFC 2606) so this
// never makes a real network request and never pollutes the real per-ATS
// counts shown on the admin page. Cleans its own sentinel key back to its
// starting value when done, pass or fail.
//
// NOTE: this script was referenced in the original PR #28 review brief but
// was never committed to the repo — recreated here from that description.

import { config } from "dotenv";
import path from "path";

config({ path: path.resolve(process.cwd(), ".env.local") });

import { createAdminClient } from "../lib/supabase/admin";
import {
  loadWorkableStateFromDB,
  flushDomainCountsToDB,
  safeFetch,
} from "../lib/sources/ats-utils";

const SENTINEL_HOST = "job-radar-verify.invalid";
const SENTINEL_URL = `https://${SENTINEL_HOST}/ping`;

async function readSentinelCount(): Promise<number> {
  const db = createAdminClient();
  const { data, error } = await db.from("app_config").select("domain_counts").eq("id", 1).single();
  if (error) throw new Error(`Could not read app_config: ${error.message}`);
  const counts = (data?.domain_counts as Record<string, number> | null) ?? {};
  return counts[SENTINEL_HOST] ?? 0;
}

async function cleanup(totalAdded: number): Promise<void> {
  if (totalAdded === 0) return;
  const db = createAdminClient();
  const { error } = await db.rpc("increment_domain_counts", {
    increments: { [SENTINEL_HOST]: -totalAdded },
  });
  if (error) {
    console.warn(
      `[verify-domain-counts] cleanup failed — sentinel key "${SENTINEL_HOST}" left at +${totalAdded} in app_config.domain_counts. Safe to ignore or zero out manually.`,
      error.message,
    );
  }
}

(async () => {
  let added = 0;
  try {
    console.log("[verify-domain-counts] Reading baseline...");
    const baseline = await readSentinelCount();
    console.log(`  baseline domain_counts["${SENTINEL_HOST}"] = ${baseline}`);

    console.log("[verify-domain-counts] Loading Workable state (required before tracking)...");
    await loadWorkableStateFromDB();

    console.log("[verify-domain-counts] Tracking 3 sentinel requests + flushing...");
    await safeFetch(SENTINEL_URL);
    await safeFetch(SENTINEL_URL);
    await safeFetch(SENTINEL_URL);
    await flushDomainCountsToDB();
    added += 3;

    const afterFirstFlush = await readSentinelCount();
    const firstDelta = afterFirstFlush - baseline;
    if (firstDelta !== 3) {
      throw new Error(
        `Expected +3 after first flush, got +${firstDelta} (baseline ${baseline} -> ${afterFirstFlush}). ` +
          `If this is +6 or more, the flush is double-counting — domain_counts is being re-seeded from the DB ` +
          `as a baseline instead of staying delta-only.`,
      );
    }
    console.log(`  ✓ first flush: +${firstDelta} (expected +3)`);

    console.log("[verify-domain-counts] Flushing again with nothing newly tracked...");
    await flushDomainCountsToDB();
    const afterSecondFlush = await readSentinelCount();
    if (afterSecondFlush !== afterFirstFlush) {
      throw new Error(
        `Expected no change on a flush with nothing tracked, but went ${afterFirstFlush} -> ${afterSecondFlush}. ` +
          `The in-memory delta cache isn't being reset after a successful flush — a warm process would resend ` +
          `an already-persisted delta on every subsequent run.`,
      );
    }
    console.log(`  ✓ second flush: no change (still ${afterSecondFlush})`);

    console.log("\n[verify-domain-counts] PASS — atomic increment round-trips correctly.\n");
    await cleanup(added);
    process.exit(0);
  } catch (err) {
    console.error("\n[verify-domain-counts] FAIL:", err instanceof Error ? err.message : err);
    await cleanup(added);
    process.exit(1);
  }
})();
