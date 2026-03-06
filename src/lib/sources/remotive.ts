// src/lib/sources/remotive.ts
import { Job, JobMode, FetcherResult, RemotiveJob } from "../types";
import { safeFetch, stripHtml } from "./ats-utils";
import { scoreJob } from "../scoring";

/**
 * Fetches jobs from Remotive.com API.
 * Filtered by category 'software-dev'.
 */
export async function fetchRemotive(mode: JobMode): Promise<FetcherResult> {
  const t0 = Date.now();
  const url = "https://remotive.com/api/remote-jobs?category=software-dev";
  const res = await safeFetch(url);

  if (!res) return { jobs: [], error: "Network/Timeout", durationMs: Date.now() - t0, ok: false };
  if (!res.ok)
    return { jobs: [], error: `HTTP ${res.status}`, durationMs: Date.now() - t0, ok: false };

  try {
    const data = (await res.json()) as { jobs: RemotiveJob[] };
    const rawJobs = data.jobs || [];
    const rawCount = rawJobs.length;
    const out: Job[] = [];

    for (const r of rawJobs) {
      const title = r.title || "";
      if (!/react|next|native/i.test(title)) continue;

      const description = stripHtml(r.description || "");
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
        description: description.slice(0, 500),
        isRemote: true,
        postedAt: r.publication_date,
        dateUnknown: false,
        visaSponsorship: false,
        ...scored,
        fetchedAt: new Date().toISOString(),
      });
    }

    console.log(`[global] Remotive: collected ${out.length} matches`);
    return { jobs: out, rawCount, durationMs: Date.now() - t0, ok: true };
  } catch (e) {
    return { jobs: [], error: `Parse Error: ${e}`, durationMs: Date.now() - t0, ok: false };
  }
}
