import { JobMode, FetcherResult, HimalayasJob } from "../types";
import { safeFetch, stripHtml, processJobs } from "./ats-utils";
import { trackApiCall } from "../health-store";

const MAX_PAGES = 10; // Cap to prevent infinite loops

/**
 * Fetches jobs from Himalayas.app Public API.
 */
export async function fetchHimalayas(mode: JobMode): Promise<FetcherResult> {
  const t0 = Date.now();
  let allRawJobs: HimalayasJob[] = [];
  let reactJobsFound = false;
  let lastResOk = false;

  try {
    for (let i = 0; i < MAX_PAGES; i++) {
      const url = `https://himalayas.app/jobs/api?limit=20&offset=${i * 20}`;

      const response = await safeFetch(url);
      if (!response) break;

      lastResOk = response.ok;
      if (!response.ok) break;

      const data = (await response.json()) as { jobs: HimalayasJob[] };
      const rawPageJobs = data.jobs || [];
      if (rawPageJobs.length === 0) break;

      allRawJobs = allRawJobs.concat(rawPageJobs);

      const hasReact = rawPageJobs.some((rj) =>
        /\b(react|next\.?js)\b/i.test((rj.title || "") + " " + (rj.description || "")),
      );

      if (hasReact) {
        reactJobsFound = true;
        if (i > 2) break;
      }
    }

    const healthStat = await trackApiCall("Himalayas", lastResOk || allRawJobs.length > 0);

    if (!reactJobsFound && allRawJobs.length > 0) {
      return { jobs: [], rawCount: allRawJobs.length, durationMs: Date.now() - t0, ...healthStat };
    }

    const processed = processJobs(
      allRawJobs.map((rj) => {
        // GUIDs in Himalayas are often URLs. Extract the slug part for a safer ID.
        const guid = (rj.guid || "").replace(/\/$/, "");
        const slug = guid.split("/").pop() || guid;
        return {
          id: `himalayas-${slug}`,
          title: rj.title,
          company: rj.companyName,
          location: rj.locationRestrictions?.join(", ") || "Remote",
          url: rj.applicationLink,
          description: stripHtml(rj.description || ""),
          postedAt: new Date(rj.pubDate * 1000).toISOString(),
          locationRestrictions: rj.locationRestrictions,
        };
      }),
      { name: "Himalayas", country: "Global", countryFlag: "🌍" },
      mode,
      false,
    );
    // processJobs will set sourceName to "Himalayas"
    return {
      jobs: processed,
      rawCount: allRawJobs.length,
      durationMs: Date.now() - t0,
      ...healthStat,
    };
  } catch (e) {
    const healthStat = await trackApiCall("Himalayas", false);
    return { jobs: [], error: `Error: ${e}`, durationMs: Date.now() - t0, ...healthStat };
  }
}
