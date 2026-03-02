// src/lib/sources/wp-startup-jobs.ts
import { JobMode } from "../types";
import { safeFetch, stripHtml, processJobs, FetcherResult, BaseCompany } from "./ats-utils";

/**
 * Fetches jobs from WordPress-based startup job boards (Berlin, London).
 */
export async function fetchWPStartupJobs(
  baseUrl: string,
  city: string,
  country: string,
  flag: string,
  mode: JobMode,
): Promise<FetcherResult> {
  const t0 = Date.now();
  const url = `${baseUrl}/wp-json/wp/v2/posts?search=react&per_page=20`;
  const res = await safeFetch(url);

  if (!res) return { jobs: [], error: "Network/Timeout", durationMs: Date.now() - t0 };
  if (!res.ok) return { jobs: [], error: `HTTP ${res.status}`, durationMs: Date.now() - t0 };

  try {
    const posts = (await res.json()) as any[];
    const company: BaseCompany = { name: `${city} Startup`, country, countryFlag: flag, city };

    const processed = processJobs(
      posts.map((p: any) => ({
        id: `${city.toLowerCase()}-startup-${p.id}`,
        title: stripHtml(p.title?.rendered || ""),
        location: `${city}, ${country}`,
        url: p.link,
        postedAt: p.date_gmt + "Z",
        description: stripHtml(p.content?.rendered || ""),
      })),
      company,
      mode,
      true, // These boards are highly likely to support visa/relocation
    );

    return { jobs: processed, durationMs: Date.now() - t0 };
  } catch (e) {
    return { jobs: [], error: `Parse Error: ${e}`, durationMs: Date.now() - t0 };
  }
}
