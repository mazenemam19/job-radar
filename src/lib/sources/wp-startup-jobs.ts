// src/lib/sources/wp-startup-jobs.ts
import { JobMode, FetcherResult, BaseCompany, WordPressPost } from "../types";
import { safeFetch, stripHtml, processJobs } from "./ats-utils";

/**
 * Fetches jobs from WordPress-based startup job boards (Berlin, London).
 */
export async function fetchWPStartupJobs(
  baseUrl: string,
  city: string,
  country: string,
  flag: string,
  mode: JobMode,
  sourceName: string,
): Promise<FetcherResult> {
  const t0 = Date.now();
  // Using 'search=react' is the most efficient way to query WP-based boards
  const url = `${baseUrl}/wp-json/wp/v2/posts?search=react&per_page=30`;
  const res = await safeFetch(url);

  if (!res)
    return {
      jobs: [],
      rawCount: 0,
      error: "Network/Timeout",
      durationMs: Date.now() - t0,
      ok: false,
    };
  if (!res.ok)
    return {
      jobs: [],
      rawCount: 0,
      error: `HTTP ${res.status}`,
      durationMs: Date.now() - t0,
      ok: false,
    };

  try {
    const posts = (await res.json()) as WordPressPost[];
    const rawCount = posts.length;
    const company: BaseCompany = { name: sourceName, country, countryFlag: flag, city };

    const processed = processJobs(
      posts.map((p) => ({
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

    return { jobs: processed, rawCount, durationMs: Date.now() - t0, ok: true };
  } catch (e) {
    return {
      jobs: [],
      rawCount: 0,
      error: `Parse Error: ${e}`,
      durationMs: Date.now() - t0,
      ok: false,
    };
  }
}
