#!/usr/bin/env tsx
// scripts/seed-ats-companies.ts
//
// One-time migration: reads ALL_COMPANIES from the existing (read-only) companies.ts
// and inserts each entry into the new public.ats_companies table.
//
// Run with:
//   pnpm exec ts-node --project tsconfig.scripts.json scripts/seed-ats-companies.ts
//
// Reads credentials from .env.local automatically — no CLI env vars needed.

import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "..", ".env.local") });

import { createClient } from "@supabase/supabase-js";
import { ALL_COMPANIES, CompanyConfig } from "../src/lib/sources/companies";

// ── Supabase client ──────────────────────────────────────────

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Normalise ALL_COMPANIES into ats_companies rows ──────────

// ALL_COMPANIES entries may appear in multiple pipeline arrays.
// We deduplicate by slug+ats and merge pipeline flags.

const companyMap = new Map<
  string,
  {
    name: string;
    ats: string;
    slug: string;
    country: string;
    country_flag: string;
    city: string | null;
    pipeline_visa: boolean;
    pipeline_local: boolean;
    pipeline_global: boolean;
  }
>();

for (const entry of ALL_COMPANIES as CompanyConfig[]) {
  const key = `${entry.ats}::${entry.slug}`;
  const pipelines = entry.pipelines || [];

  if (companyMap.has(key)) {
    const existing = companyMap.get(key)!;
    if (pipelines.includes("visa")) existing.pipeline_visa = true;
    if (pipelines.includes("local")) existing.pipeline_local = true;
    if (pipelines.includes("global")) existing.pipeline_global = true;
  } else {
    companyMap.set(key, {
      name: entry.name,
      ats: entry.ats,
      slug: entry.slug,
      country: entry.country,
      country_flag: entry.countryFlag,
      city: entry.city ?? null,
      pipeline_visa: pipelines.includes("visa"),
      pipeline_local: pipelines.includes("local"),
      pipeline_global: pipelines.includes("global"),
    });
  }
}

const rows = Array.from(companyMap.values()).map((c) => ({
  ...c,
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}));

// ── Insert ───────────────────────────────────────────────────

async function seed() {
  console.log(`Seeding ${rows.length} companies into public.ats_companies...`);

  // Upsert in batches of 100 to avoid payload limits
  const BATCH = 100;
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await supabase
      .from("ats_companies")
      .upsert(batch, { onConflict: "ats,slug" });

    if (error) {
      console.error(`  Batch ${i}–${i + BATCH} error:`, error.message);
      errors += batch.length;
    } else {
      inserted += batch.length;
      console.log(`  ✓ ${inserted}/${rows.length} inserted`);
    }
  }

  console.log(`\nDone. ${inserted} companies seeded, ${errors} errors.`);

  if (errors > 0) process.exit(1);
}

seed().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
