// src/lib/v2/ats-bridge.ts
// Bridges DB-sourced company rows (from public.ats_companies) to the existing
// ATS fetcher functions in src/lib/sources/ats-utils.ts.
//
// IMPORTANT: We IMPORT from ats-utils.ts but NEVER MODIFY it.
// The fetchers expect a company config object that matches what ALL_COMPANIES
// currently provides. This file performs the structural translation.

import {
  fetchGreenhouse,
  fetchLever,
  fetchAshby,
  fetchWorkable,
  fetchTeamtailor,
  fetchBreezy,
  fetchSmartRecruiters,
} from "@/lib/sources/ats-utils";

import type { ATSCompanyRow, RawJob } from "./types";
import type { Job } from "@/types";

import type { ATSConfig } from "@/types";

/** Convert a DB row + pipeline mode to the ATSConfig shape. */
function toATSConfig(row: ATSCompanyRow): ATSConfig {
  return {
    name: row.name,
    ats: row.ats as ATSConfig["ats"],
    slug: row.slug,
    country: row.country,
    countryFlag: row.country_flag,
    city: row.city ?? undefined,
  };
}

/** Result from a single company fetch attempt. */
interface FetchResult {
  company: string;
  mode: "visa" | "local" | "global";
  jobs: RawJob[];
  error: string | null;
}

/**
 * Fetches jobs from a single company using the appropriate ATS fetcher.
 *
 * Jobs are tagged with the mode (visa/local/global) from the pipeline.
 * Returns raw jobs with date_unknown correctly set:
 *   FIX #5: when postedAt ≈ fetchedAt (fallback date), we set date_unknown=true
 *           and use fetchedAt as posted_at so the job decays normally.
 */
export async function fetchCompany(
  row: ATSCompanyRow,
  mode: "visa" | "local" | "global",
): Promise<FetchResult> {
  const config = toATSConfig(row);
  const fetchedAt = new Date().toISOString();
  const fetchedMs = Date.parse(fetchedAt);

  try {
    let rawJobs: Job[] = []; // Use the old Job type from types/job.ts

    const visaSponsorship = mode === "visa";

    switch (row.ats) {
      case "greenhouse": {
        const result = await fetchGreenhouse(config, mode, visaSponsorship);
        rawJobs = result.jobs;
        break;
      }
      case "lever": {
        const result = await fetchLever(config, mode, visaSponsorship);
        rawJobs = result.jobs;
        break;
      }
      case "ashby": {
        const result = await fetchAshby(config, mode, visaSponsorship);
        rawJobs = result.jobs;
        break;
      }
      case "workable": {
        const result = await fetchWorkable(config, mode, visaSponsorship);
        rawJobs = result.jobs;
        break;
      }
      case "teamtailor": {
        const result = await fetchTeamtailor(config, mode, visaSponsorship);
        rawJobs = result.jobs;
        break;
      }
      case "breezy": {
        const result = await fetchBreezy(config, mode, visaSponsorship);
        rawJobs = result.jobs;
        break;
      }
      case "smartrecruiters": {
        const result = await fetchSmartRecruiters(config, mode, visaSponsorship);
        rawJobs = result.jobs;
        break;
      }
      case "bamboohr":
      case "jazzhr":
        // These ATS types are in the DB schema but may not have fetcher
        // implementations yet. If the import fails at runtime, the error
        // is caught below and reported in source_health.
        throw new Error(`ATS type '${row.ats}' fetcher not yet implemented`);
      default:
        throw new Error(`Unknown ATS type: ${row.ats}`);
    }

    // Normalise and apply FIX #5 (date_unknown detection)
    const jobs: RawJob[] = rawJobs.map((j) => {
      const postedAt = (j.postedAt ?? fetchedAt) as string;
      const postedMs = Date.parse(postedAt);

      // If posted_at is within 30 seconds of fetchedAt, the original
      // parseRelativeDate returned "now" as a fallback — mark as unknown.
      const dateUnknown = Number.isNaN(postedMs) || Math.abs(postedMs - fetchedMs) < 30_000;

      return {
        id: j.id,
        title: j.title,
        company: j.company ?? row.name,
        location: j.location ?? "",
        country: row.country,
        country_flag: row.country_flag,
        url: j.url,
        description: j.description ?? "",
        posted_at: dateUnknown ? fetchedAt : postedAt,
        fetched_at: fetchedAt,
        date_unknown: dateUnknown,
        is_remote: Boolean(j.isRemote ?? false),
        salary: j.salary ?? null,
        mode,
        visa_sponsorship: Boolean(j.visaSponsorship ?? false),
        source_name: row.name,
        ats_type: row.ats,
        created_at: fetchedAt,
      };
    });

    return { company: row.name, mode, jobs, error: null };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { company: row.name, mode, jobs: [], error };
  }
}
