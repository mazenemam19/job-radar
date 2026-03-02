// src/lib/sources/berlinstartupjobs.ts
import { JobMode } from "../types";
import { safeFetch, stripHtml, processJobs, FetcherResult, BaseCompany } from "./ats-utils";

/**
 * Fetches jobs from BerlinStartupJobs.com using the WordPress REST API.
 * Category 9: IT / Software Development (Engineering)
 */
export async function fetchBerlinStartupJobs(mode: JobMode): Promise<FetcherResult> {
  const t0 = Date.now();
  // Category 9 is 'IT / Software Development'
  const url = "https://berlinstartupjobs.com/wp-json/wp/v2/posts?categories=9&per_page=50";

  const res = await safeFetch(url);
  if (!res) return { jobs: [], error: "Network/Timeout", durationMs: Date.now() - t0 };
  if (!res.ok) return { jobs: [], error: `HTTP ${res.status}`, durationMs: Date.now() - t0 };

  try {
    const posts = (await res.json()) as any[];
    const rawCount = posts.length;

    const rawJobs = posts.map((post) => {
      const fullTitle = stripHtml(post.title?.rendered || "");

      // Extract company name: usually "Job Title // Company Name" or "Job Title | Company Name"
      let title = fullTitle;
      let companyName = "Berlin Startup";

      if (fullTitle.includes("//")) {
        const parts = fullTitle.split("//");
        title = parts[0].trim();
        companyName = parts[1].trim();
      } else if (fullTitle.includes("|")) {
        const parts = fullTitle.split("|");
        title = parts[0].trim();
        companyName = parts[1].trim();
      }

      return {
        id: `bsj_${post.id}`,
        title,
        company: companyName,
        location: "Berlin, Germany",
        url: post.link,
        postedAt: post.date_gmt ? `${post.date_gmt}Z` : new Date(post.date).toISOString(),
        description: stripHtml(post.content?.rendered || ""),
      };
    });

    // Use a generic base company for processing, but the actual company name is extracted per job
    const baseCompany: BaseCompany = {
      name: "BerlinStartupJobs",
      country: "Germany",
      countryFlag: "🇩🇪",
      city: "Berlin",
    };

    const processed = processJobs(
      rawJobs.map((rj) => ({
        id: rj.id,
        title: rj.title,
        location: rj.location,
        url: rj.url,
        postedAt: rj.postedAt,
        description: rj.description,
      })),
      baseCompany,
      mode,
      false,
    );

    // Overwrite the company name with the one we extracted
    const finalJobs = processed.map((job) => {
      const raw = rawJobs.find((rj) => rj.id === job.id);
      if (raw) {
        return { ...job, company: raw.company };
      }
      return job;
    });

    console.log(`[${mode}] BerlinStartupJobs: collected ${finalJobs.length} matches`);
    return { jobs: finalJobs, rawCount, durationMs: Date.now() - t0 };
  } catch (e) {
    return { jobs: [], error: `Parse Error: ${e}`, durationMs: Date.now() - t0 };
  }
}
