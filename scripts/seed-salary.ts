#!/usr/bin/env ts-node
// Imports only explicit-EGP anonymous Egytech records. Run dry by default:
//   pnpm salary-seed
// Apply only after reviewing the printed count:
//   pnpm salary-seed --apply

import { config } from "dotenv";
import path from "path";

config({ path: path.resolve(process.cwd(), ".env.local") });

import { createClient } from "@supabase/supabase-js";
import {
  EGYTECH_PARTICIPANTS_URL,
  mapEgytechParticipants,
} from "../src/lib/egytech-salary-seed";
import type { Database } from "../src/lib/database.types";

const APPLY = process.argv.includes("--apply");
const BATCH_SIZE = 250;

type EgytechResponse = { results?: unknown };

async function fetchSourceRecords(): Promise<unknown[]> {
  const response = await fetch(EGYTECH_PARTICIPANTS_URL);
  if (!response.ok) throw new Error(`Egytech source returned HTTP ${response.status}`);

  const payload = (await response.json()) as EgytechResponse;
  if (!Array.isArray(payload.results)) throw new Error("Egytech source response did not contain a results array");
  return payload.results;
}

async function run() {
  const records = await fetchSourceRecords();
  const { rows, skipped } = mapEgytechParticipants(records);

  console.log(
    JSON.stringify(
      {
        source_records: records.length,
        eligible_egp_rows: rows.length,
        skipped_non_egp_or_hybrid: skipped.nonEgpOrHybrid,
        skipped_invalid: skipped.invalid,
        mode: APPLY ? "apply" : "dry-run",
      },
      null,
      2,
    ),
  );

  if (!APPLY) {
    console.log("Dry run only. Re-run with --apply after reviewing these counts.");
    return;
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for --apply");
  }

  const supabase = createClient<Database>(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  for (let index = 0; index < rows.length; index += BATCH_SIZE) {
    const batch = rows.slice(index, index + BATCH_SIZE);
    const { error } = await supabase
      .from("salary_reports")
      .upsert(batch, { onConflict: "source,source_record_key", ignoreDuplicates: true });

    if (error) throw new Error(`Batch ${index / BATCH_SIZE + 1} failed: ${error.message}`);
  }

  console.log(`Applied ${rows.length} idempotent source rows in ${Math.ceil(rows.length / BATCH_SIZE)} batches.`);
}

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
