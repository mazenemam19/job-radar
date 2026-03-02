// src/lib/sources/berlin-startup-jobs.ts
import { JobMode } from "../types";
import { safeFetch, stripHtml, processJobs, FetcherResult, BaseCompany } from "./ats-utils";

/**
 * Fetches jobs from BerlinStartupJobs.com via WordPress REST API.
 */
export async function fetchBerlinStartupJobs(mode: JobMode): Promise<FetcherResult> {
  const t0 = Date.now();
  // Filter for 'Engineering' category if possible, or just search 'react'
  const url = "https://berlinstartupjobs.com/wp-json/wp/v2/posts?search=react&per_page=20";
  const res = await safeFetch(url);

  if (!res) return { jobs: [], error: "Network/Timeout", durationMs: Date.now() - t0 };
  if (!res.ok) return { jobs: [], error: `HTTP ${res.status}`, durationMs: Date.now() - t0 };

  try {
    const posts = (await res.json()) as any[];
    const company: BaseCompany = {
      name: "Berlin Startup",
      country: "Germany",
      countryFlag: "🇩🇪",
      city: "Berlin",
    };

    const processed = processJobs(
      posts.map((p: any) => ({
        id: `berlin-startup-${p.id}`,
        title: stripHtml(p.title?.rendered || ""),
        location: "Berlin, Germany",
        url: p.link,
        postedAt: p.date_gmt + "Z",
        description: stripHtml(p.content?.rendered || ""),
      })),
      company,
      mode,
      true, // Berlin Startup Jobs are highly likely to support visa/relocation
    );

    return { jobs: processed, durationMs: Date.now() - t0 };
  } catch (e) {
    return { jobs: [], error: `Parse Error: ${e}`, durationMs: Date.now() - t0 };
  }
}
