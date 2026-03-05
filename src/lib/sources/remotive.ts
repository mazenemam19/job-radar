// src/lib/sources/remotive.ts
import { Job, JobMode, FetcherResult, RemotiveJob } from "../types";
import { safeFetch, stripHtml } from "./ats-utils";
import { scoreJob } from "../scoring";
import { trackApiCall } from "../health-store";

/**
 * Fetches jobs from Remotive.com API.
 * Filtered by category 'software-dev'.
 */
export async function fetchRemotive(mode: JobMode): Promise<FetcherResult> {
  const t0 = Date.now();
  const url = "https://remotive.com/api/remote-jobs?category=software-dev";
  const res = await safeFetch(url);

  const healthStat = await trackApiCall("Remotive", res?.ok ?? false);

  if (!res)
    return { jobs: [], error: "Network/Timeout", durationMs: Date.now() - t0, ...healthStat };
  if (!res.ok)
    return { jobs: [], error: `HTTP ${res.status}`, durationMs: Date.now() - t0, ...healthStat };

  try {
    const data = (await res.json()) as { jobs: RemotiveJob[] };
    const rawJobs = data.jobs || [];
    const rawCount = rawJobs.length;
    const out: Job[] = [];
    const now = new Date().toISOString();

    for (const r of rawJobs) {
      const title = r.title || "";
      const description = stripHtml(r.description || "");

      // Tech Gate + Level Gate via scoreJob
      const scored = scoreJob({
        title,
        description,
        location: r.candidate_required_location || "Remote",
        postedAt: r.publication_date,
      });

      if (scored.skillMatchScore === 0) continue;

      out.push({
        id: `global_remotive_${r.id}`,
        source: "company",
        mode,
        sourceName: "Remotive",
        title,
        company: r.company_name || "Remotive",
        location: r.candidate_required_location || "Remote 🌐",
        country: "Global",
        countryFlag: "🌍",
        url: r.url,
        description: description.slice(0, 1000),
        isRemote: true,
        postedAt: r.publication_date,
        dateUnknown: false,
        visaSponsorship: false,
        ...scored,
        fetchedAt: now,
      });
    }

    console.log(`[global] Remotive: collected ${out.length} matches`);
    return { jobs: out, rawCount, durationMs: Date.now() - t0, ...healthStat };
  } catch (e) {
    const healthStat = await trackApiCall("Remotive", false);
    return {
      jobs: [],
      rawCount: 0,
      error: `Parse Error: ${e}`,
      durationMs: Date.now() - t0,
      ...healthStat,
    };
  }
}
