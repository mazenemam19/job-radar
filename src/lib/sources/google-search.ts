// src/lib/sources/google-search.ts
import type { Job, JobMode, FetcherResult, SerpApiResponse, SerpResult } from "@/types";
import { scoreJob } from "../scoring";
import { stripHtml } from "./ats-utils";
import crypto from "crypto";

/**
 * Google Search Job Discovery via SerpApi.
 *
 * Optimized for:
 * 1. Stable Hex IDs (Fixes 404s and Duplicates).
 * 2. Forced Sequential Pagination (Fixes 10-result limit).
 */

async function fetchPage(
  query: string,
  location: string,
  apiKey: string,
  start: number = 0,
): Promise<SerpResult[]> {
  const url = new URL("https://serpapi.com/search");
  url.searchParams.append("engine", "google");
  url.searchParams.append("q", query);
  url.searchParams.append("google_domain", "google.com.eg");
  url.searchParams.append("gl", "eg");
  url.searchParams.append("hl", "en");
  url.searchParams.append("tbs", "qdr:w");
  url.searchParams.append("start", String(start));
  url.searchParams.append("api_key", apiKey);

  try {
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) return [];
    const data = (await res.json()) as SerpApiResponse;
    const results = data.organic_results || [];
    return results;
  } catch (e) {
    console.error(`[google-discovery] Page fetch error at start=${start}:`, e);
    return [];
  }
}

export async function fetchGoogleJobs(
  mode: JobMode,
  keywords: string,
  location: string,
): Promise<FetcherResult> {
  const t0 = Date.now();
  const apiKey = process.env.SERPAPI_KEY;

  if (!apiKey) {
    return { jobs: [], rawCount: 0, error: "Missing SERPAPI_KEY", durationMs: 0, ok: false };
  }

  const query = `site:linkedin.com/jobs/view "${keywords.split(",")[0].trim()}" "${location}" -intitle:intern -intitle:junior`;

  // 🚀 SEQUENTIAL FETCH: To ensure Google doesn't consolidate results
  const p1 = await fetchPage(query, location, apiKey, 0);
  const p2 = p1.length >= 10 ? await fetchPage(query, location, apiKey, 10) : [];

  const flattenedResults = [...p1, ...p2];
  const rawCount = flattenedResults.length;

  console.log(`[google-discovery] Found ${rawCount} raw results for ${location}.`);

  const now = new Date().toISOString();
  const processed: Job[] = [];

  for (const r of flattenedResults) {
    if (!r.link) continue;

    const title = r.title.split("|")[0].split("-")[0].trim();
    const description = r.snippet;
    const company = r.source || "Found via Google";

    const scored = scoreJob({
      title,
      description,
      location,
      postedAt: now,
    });

    if (scored.skillMatchScore > 0) {
      // 🛡️ STABLE HEX ID: Guaranteed URL-safe and duplicate-proof
      const stableId = crypto.createHash("md5").update(r.link).digest("hex").slice(0, 16);

      processed.push({
        id: `google_${stableId}`,
        source: "local",
        mode,
        sourceName: "Google Discovery",
        title,
        company,
        location,
        country: location.includes("Egypt") ? "Egypt" : "EMEA",
        countryFlag: location.includes("Egypt") ? "🇪🇬" : "🌍",
        url: r.link,
        description: stripHtml(description),
        isRemote: /remote/i.test(title + description + location),
        postedAt: now,
        dateUnknown: true,
        visaSponsorship: /visa|relocation/i.test(description),
        ...scored,
        fetchedAt: now,
      });
    }
  }

  return { jobs: processed, rawCount, durationMs: Date.now() - t0, ok: true };
}
