import axios from "axios";
import { Job } from "@/types";
import { CV_PROFILE } from "./cv-profile";
import { scoreJob } from "./matcher";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId(source: string, externalId: string | number): string {
  return `${source}-${externalId}`;
}

function truncate(text: string, max = 2000): string {
  return text.length > max ? text.slice(0, max) + "…" : text;
}

// ─── Disqualifying keywords ───────────────────────────────────────────────────
// Jobs containing any of these are useless for someone relocating from abroad

const DISQUALIFY_KEYWORDS = [
  "uk citizenship required",
  "british citizenship required",
  "must be a uk citizen",
  "must hold uk citizenship",
  "us citizenship required",
  "citizenship required",
  "must be a us citizen",
  "security clearance required",
  "active security clearance",
  "sc clearance required",
  "dv clearance required",
  "highest level of government clearance",
  "nato secret",
  "eligible for uk security clearance",
  "no sponsorship",
  "no Relocation",
  "we do not sponsor",
  "unable to sponsor",
  "cannot sponsor",
  "sponsorship not available",
  "no visa sponsorship",
];

function isDisqualified(text: string): boolean {
  const lower = text.toLowerCase();
  return DISQUALIFY_KEYWORDS.some((kw) => lower.includes(kw));
}

// ─── Adzuna ───────────────────────────────────────────────────────────────────

interface AdzunaJob {
  id: string;
  title: string;
  company: { display_name: string };
  location: { display_name: string; area: string[] };
  description: string;
  redirect_url: string;
  created: string;
  salary_min?: number;
  salary_max?: number;
  currency?: string;
  category: { label: string };
}

async function fetchAdzunaCountry(
  countryCode: string,
  countryName: string,
  title: string
): Promise<Job[]> {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;

  if (!appId || !appKey) {
    console.warn("⚠️  ADZUNA_APP_ID / ADZUNA_APP_KEY not set — skipping Adzuna");
    return [];
  }

  const results: Job[] = [];

  try {
    for (let page = 1; page <= 2; page++) {
      const params = {
        app_id: appId,
        app_key: appKey,
        what: title,
        // what_and: "visa sponsorship",
        results_per_page: 50,
        max_days_old: 60,
        sort_by: "date",
      };

      const url = `https://api.adzuna.com/v1/api/jobs/${countryCode}/search/${page}`;
      const { data } = await axios.get(url, { params, timeout: 10000 });

      if (!data.results?.length) break;

      for (const raw of data.results as AdzunaJob[]) {
        const fullText = `${raw.title} ${raw.description}`;
        if (isDisqualified(fullText)) continue;

        const base = {
          id: generateId("adzuna", raw.id),
          title: raw.title,
          company: raw.company.display_name,
          location: raw.location.display_name,
          country: countryName,
          countryCode: countryCode.toUpperCase(),
          description: truncate(raw.description),
          url: raw.redirect_url,
          postedAt: raw.created,
          salary:
            raw.salary_min || raw.salary_max
              ? { min: raw.salary_min, max: raw.salary_max, currency: raw.currency ?? "GBP" }
              : undefined,
          source: "adzuna" as const,
          tags: [raw.category.label],
          fetchedAt: new Date().toISOString(),
          hasVisaSponsorship: false,
          hasRelocation: false,
        };

        const scores = scoreJob(base);
        // if (!scores.hasVisaSponsorship) continue;

        results.push({ ...base, ...scores });
      }

      await sleep(300);
    }
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      console.error(`Adzuna error [${countryCode}/${title}]:`, err.response?.data ?? err.message);
    } else {
      console.error(`Adzuna error [${countryCode}/${title}]:`, err);
    }
  }

  return results;
}

export async function fetchAdzunaJobs(): Promise<Job[]> {
  const allJobs: Job[] = [];
  const seen = new Set<string>();

  for (const country of CV_PROFILE.targetCountries) {
    for (const title of CV_PROFILE.searchTitles.slice(0, 3)) {
      const jobs = await fetchAdzunaCountry(country.code, country.name, title);
      for (const job of jobs) {
        if (!seen.has(job.id)) {
          seen.add(job.id);
          allJobs.push(job);
        }
      }
      await sleep(400);
    }
  }

  return allJobs;
}

// ─── Reed ─────────────────────────────────────────────────────────────────────

interface ReedJob {
  jobId: number;
  jobTitle: string;
  employerName: string;
  locationName: string;
  jobDescription: string;
  jobUrl: string;
  date: string;
  minimumSalary?: number;
  maximumSalary?: number;
  currency?: string;
}

export async function fetchReedJobs(): Promise<Job[]> {
  const apiKey = process.env.REED_API_KEY;

  if (!apiKey) {
    console.warn("⚠️  REED_API_KEY not set — skipping Reed");
    return [];
  }

  const results: Job[] = [];
  const seen = new Set<string>();

  const searchCombos = CV_PROFILE.searchTitles.slice(0, 3)

  for (const keywords of searchCombos) {
    try {
      const { data } = await axios.get("https://www.reed.co.uk/api/1.0/search", {
        params: {
          keywords,
          locationName: "UK",
          distancefromlocation: 999,
          resultsToTake: 100,
        },
        auth: { username: apiKey, password: "" },
        timeout: 10000,
      });

      for (const raw of data.results as ReedJob[]) {
        const id = generateId("reed", raw.jobId);
        if (seen.has(id)) continue;
        seen.add(id);

        const postedAt = (() => {
          const d = new Date(raw.date);
          return isNaN(d.getTime()) ? null : d.toISOString();
        })();
        if (!postedAt) continue;

        const fullText = `${raw.jobTitle} ${raw.jobDescription}`;
        if (isDisqualified(fullText)) continue;

        const base = {
          id,
          title: raw.jobTitle,
          company: raw.employerName,
          location: raw.locationName,
          country: "United Kingdom",
          countryCode: "GB",
          description: truncate(raw.jobDescription),
          url: raw.jobUrl,
          postedAt,
          salary:
            raw.minimumSalary || raw.maximumSalary
              ? { min: raw.minimumSalary, max: raw.maximumSalary, currency: raw.currency ?? "GBP" }
              : undefined,
          source: "reed" as const,
          tags: [],
          fetchedAt: new Date().toISOString(),
          hasVisaSponsorship: false,
          hasRelocation: false,
        };

        const scores = scoreJob(base);
        // if (!scores.hasVisaSponsorship) continue;
        if (scores.matchedSkills.length === 0) continue;
        results.push({ ...base, ...scores });
      }

      await sleep(600);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        console.error(`Reed error [${keywords}]:`, err.response?.data ?? err.message);
      } else {
        console.error(`Reed error [${keywords}]:`, err);
      }
    }
  }

  return results;
}

// ─── Combined Fetch ───────────────────────────────────────────────────────────

export async function fetchAllJobs(): Promise<Job[]> {
  console.log("🔍 Fetching from Adzuna…");
  const adzunaJobs = await fetchAdzunaJobs();
  console.log(`   ✓ Adzuna: ${adzunaJobs.length} jobs`);

  console.log("🔍 Fetching from Reed…");
  const reedJobs = await fetchReedJobs();
  console.log(`   ✓ Reed: ${reedJobs.length} jobs`);

  const combined = [...adzunaJobs, ...reedJobs];
  const unique = Array.from(new Map(combined.map((j) => [j.id, j])).values());

  console.log(`📦 Total unique jobs: ${unique.length}`);
  return unique;
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}