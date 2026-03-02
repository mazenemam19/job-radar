import { Job, JobMode } from "../types";
import { safeFetch, stripHtml, processJobs } from "./ats-utils";

const MAX_PAGES = 10; // Cap to prevent infinite loops

/**
 * Fetches jobs from Himalayas.app Public API.
 * Paginates through results to find React/Next.js jobs.
 *
 * Mandates:
 * - Tech Gate: React/Next.js (handled via processJobs/scoring)
 * - Level Gate: Exclude Junior/Intern (handled via processJobs)
 */
export async function fetchHimalayas(mode: JobMode): Promise<Job[]> {
  let allRawJobs: any[] = [];
  let reactJobsFound = false;

  for (let i = 0; i < MAX_PAGES; i++) {
    const url = `https://himalayas.app/jobs/api?limit=20&offset=${i * 20}`;

    const response = await safeFetch(url);
    if (!response) continue;

    const data = (await response.json()) as any;
    const rawPageJobs = data.jobs || [];
    if (rawPageJobs.length === 0) break; // Stop if no more jobs

    allRawJobs = allRawJobs.concat(rawPageJobs);

    // Check if any job on this page contains React keywords
    const hasReact = rawPageJobs.some((rj: any) =>
      /\b(react|next\.?js)\b/i.test((rj.title || "") + " " + (rj.description || "")),
    );

    if (hasReact) {
      reactJobsFound = true;
      // Continue fetching a few more pages to ensure a good sample
      if (i > 2) break;
    }
  }

  if (!reactJobsFound) {
    console.warn("[himalayas] No React jobs found after checking " + allRawJobs.length + " jobs.");
    return [];
  }

  return processJobs(
    allRawJobs.map((rj: any) => ({
      id: `himalayas-${rj.guid}`,
      title: rj.title,
      company: rj.companyName,
      location: rj.locationRestrictions?.join(", ") || "Remote",
      url: rj.applicationLink,
      description: stripHtml(rj.description || ""),
      postedAt: new Date(rj.pubDate * 1000).toISOString(),
    })),
    { name: "Himalayas", country: "Global", countryFlag: "🌍" },
    mode,
    false,
  );
}
