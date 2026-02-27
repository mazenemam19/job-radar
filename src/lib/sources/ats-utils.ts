// src/lib/sources/ats-utils.ts
import type { Job, JobMode } from "../types";
import { isClearlyNonFrontend, isTooSenior, isGenericTitleButBackendRole, requiresCitizenshipOrClearance, scoreJob } from "../scoring";

// ── Shared Types ────────────────────────────────────────────────────────────

export interface BaseCompany { name: string; country: string; countryFlag: string; city?: string; }
export interface ATSConfig extends BaseCompany { ats: "greenhouse" | "lever" | "ashby" | "workable" | "teamtailor" | "breezy" | "smartrecruiters" | "bamboohr"; slug: string; }

// ── Helpers ────────────────────────────────────────────────────────────────

export function stripHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/\s{2,}/g, " ").trim();
}

export async function safeFetch(url: string, timeout = 30_000): Promise<Response | null> {
  try {
    return await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
      signal: AbortSignal.timeout(timeout),
    });
  } catch { return null; }
}

// ── Shared Pipeline ────────────────────────────────────────────────────────

export interface RawJob { id: string; title: string; location: string; url: string; postedAt: string; description: string; }

export const MAX_JOB_AGE_DAYS = 30;

export function processJobs(raw: RawJob[], company: BaseCompany, mode: JobMode, visaSponsorship: boolean): Job[] {
  const now = new Date().toISOString();
  const cutoff = Date.now() - MAX_JOB_AGE_DAYS * 864e5; // 30 days ago
  const out: Job[] = [];

  for (const r of raw) {
    const title = r.title.trim();
    if (isClearlyNonFrontend(title)) continue;
    if (isTooSenior(title)) continue;
    if (isGenericTitleButBackendRole(title, r.description)) continue;

    // ── 30-day age cap ──
    const postedMs = Date.parse(r.postedAt);
    if (!isNaN(postedMs) && postedMs < cutoff) continue;

    const loc = (r.location || "").toLowerCase();
    // For local mode, strictly require Egypt-related keywords
    if (mode === "local") {
      const isEgypt = loc.includes("egypt") || loc.includes("cairo") || loc.includes("alexandria") || loc.includes("giza");
      if (company.country === "Egypt" && !isEgypt && !loc.includes("remote")) continue;
      if (company.name === "Speechify" && !isEgypt) continue;
    }

    // Only check citizenship/clearance for visa mode (known international companies)
    if (mode === "visa" && requiresCitizenshipOrClearance(r.description)) continue;

    // For global mode — reject timezone-incompatible listings
    if (mode === "global" && isTimezoneIncompatible(r.description + " " + r.location)) continue;

    const scored = scoreJob({ title, description: r.description, location: r.location, postedAt: r.postedAt });
    if (scored.skillMatchScore === 0) continue;

    // Sponsorship logic
    const explicitlyDenied = requiresCitizenshipOrClearance(r.description);
    const explicitlyOffered = /visa\s+sponsorship|relocation\s+assistance/i.test(r.description);
    const actualSponsorship = !explicitlyDenied && (explicitlyOffered || (mode === "visa" && visaSponsorship));

    const isRemote = /remote|work\s+from\s+home|anywhere/i.test(title) ||
      /remote|work\s+from\s+home|anywhere/i.test(r.location) ||
      /100%\s+remote|fully\s+remote/i.test(r.description);

    out.push({
      id: r.id, source: "company", mode,
      title, company: company.name, location: r.location,
      country: company.country, countryFlag: company.countryFlag,
      url: r.url, description: r.description,
      isRemote,
      postedAt: r.postedAt ?? now, visaSponsorship: actualSponsorship,
      ...scored, fetchedAt: now,
    });
  }

  console.log(`[${mode}] ${company.name}: ${raw.length} total → ${out.length} matches`);
  return out;
}

// ── Greenhouse ─────────────────────────────────────────────────────────────

interface GHJob { id: number; title: string; location: { name: string }; absolute_url: string; updated_at: string; content?: string; }

export async function fetchGreenhouse(c: ATSConfig, mode: JobMode, visaSponsorship: boolean): Promise<Job[]> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${c.slug}/jobs?content=true`;
  const res = await safeFetch(url);
  if (!res || !res.ok) return [];
  const { jobs } = await res.json() as { jobs: GHJob[] };
  return processJobs(jobs.map(r => ({
    id: `${mode}_gh_${c.slug}_${r.id}`, title: r.title, location: r.location?.name ?? c.city ?? c.country,
    url: r.absolute_url, postedAt: r.updated_at, description: r.content ? stripHtml(r.content) : "",
  })), c, mode, visaSponsorship);
}

// ── Lever ──────────────────────────────────────────────────────────────────

interface LeverJob { id: string; text: string; hostedUrl: string; createdAt: number; descriptionPlain?: string; description?: string; categories?: { location?: string }; }

export async function fetchLever(c: ATSConfig, mode: JobMode, visaSponsorship: boolean): Promise<Job[]> {
  const url = `https://api.lever.co/v0/postings/${c.slug}?mode=json`;
  const res = await safeFetch(url);
  if (!res || !res.ok) return [];
  const jobs = await res.json() as LeverJob[];
  return processJobs(jobs.map(r => ({
    id: `${mode}_lever_${c.slug}_${r.id}`, title: r.text, location: r.categories?.location ?? c.city ?? c.country,
    url: r.hostedUrl, postedAt: new Date(r.createdAt).toISOString(),
    description: r.descriptionPlain ?? (r.description ? stripHtml(r.description) : ""),
  })), c, mode, visaSponsorship);
}

// ── Ashby ──────────────────────────────────────────────────────────────────

interface AshbyJob { id: string; title: string; locationName?: string; jobUrl: string; publishedAt?: string; descriptionHtml?: string; descriptionPlain?: string; }
interface AshbyResp { jobs?: AshbyJob[]; jobPostings?: AshbyJob[]; }

export async function fetchAshby(c: ATSConfig, mode: JobMode, visaSponsorship: boolean): Promise<Job[]> {
  const url = `https://api.ashbyhq.com/posting-api/job-board/${c.slug}?includeCompensation=true`;
  const res = await safeFetch(url);
  if (!res || !res.ok) return [];
  const data = await res.json() as AshbyResp;
  const jobs = data.jobs ?? data.jobPostings ?? [];
  return processJobs(jobs.map(r => ({
    id: `${mode}_ashby_${c.slug}_${r.id}`, title: r.title, location: r.locationName ?? c.city ?? c.country,
    url: r.jobUrl, postedAt: r.publishedAt ?? new Date().toISOString(),
    description: r.descriptionPlain ?? (r.descriptionHtml ? stripHtml(r.descriptionHtml) : ""),
  })), c, mode, visaSponsorship);
}

// ── Workable ───────────────────────────────────────────────────────────────

interface WorkableJob { shortcode: string; title: string; city: string; country: string; url: string; published_on: string; description?: string; body?: string; }
interface WorkableResp { jobs: WorkableJob[]; }
interface WorkableDetail { full_description?: string; description?: string; }

/** Run promises in batches to avoid hammering APIs */
async function pLimit<T>(fns: (() => Promise<T>)[], concurrency = 5): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < fns.length; i += concurrency) {
    const batch = await Promise.allSettled(fns.slice(i, i + concurrency).map(f => f()));
    for (const r of batch) results.push(r.status === "fulfilled" ? r.value : null as T);
  }
  return results;
}

export async function fetchWorkable(c: ATSConfig, mode: JobMode, visaSponsorship: boolean): Promise<Job[]> {
  // Step 1: get job list (titles + shortcodes, descriptions usually empty)
  const listUrl = `https://apply.workable.com/api/v1/widget/accounts/${c.slug}?details=true`;
  const res = await safeFetch(listUrl);
  if (!res || !res.ok) return [];
  const data = await res.json() as WorkableResp;
  const jobs = data.jobs ?? [];

  // Step 2: pre-filter by title before fetching descriptions (saves requests)
  const candidates = jobs.filter(r => {
    const t = r.title.toLowerCase();
    return !isClearlyNonFrontend(r.title) && !isTooSenior(r.title);
  });

  // Step 3: fetch full description for each candidate (concurrency=5)
  const withDesc = await pLimit(candidates.map(r => async () => {
    const detailUrl = `https://apply.workable.com/api/v1/widget/accounts/${c.slug}/jobs/${r.shortcode}`;
    const dr = await safeFetch(detailUrl);
    let desc = "";
    if (dr && dr.ok) {
      const detail = await dr.json() as WorkableDetail;
      desc = stripHtml(detail.full_description ?? detail.description ?? "");
    }
    return {
      id: `${mode}_workable_${c.slug}_${r.shortcode}`,
      title: r.title,
      location: r.city ? `${r.city}, ${r.country}` : c.city ?? c.country,
      url: r.url,
      postedAt: r.published_on,
      description: desc,
    };
  }), 5);

  return processJobs(withDesc.filter(Boolean), c, mode, visaSponsorship);
}

// ── Teamtailor ─────────────────────────────────────────────────────────────

interface TTJob { id: string; attributes: { title: string; "external-url": string; "published-at": string; "body-html": string; "location-name": string; } }
interface TTResp { data: TTJob[]; }

export async function fetchTeamtailor(c: ATSConfig, mode: JobMode, visaSponsorship: boolean): Promise<Job[]> {
  const url = `https://${c.slug}.teamtailor.com/jobs.json`;
  const res = await safeFetch(url);
  if (!res || !res.ok) return [];
  const { data } = await res.json() as TTResp;
  return processJobs(data.map(r => ({
    id: `${mode}_tt_${c.slug}_${r.id}`, title: r.attributes.title, location: r.attributes["location-name"] ?? c.city ?? c.country,
    url: r.attributes["external-url"] || `https://${c.slug}.teamtailor.com/jobs/${r.id}`,
    postedAt: r.attributes["published-at"],
    description: stripHtml(r.attributes["body-html"]),
  })), c, mode, visaSponsorship);
}

// ── Breezy HR ──────────────────────────────────────────────────────────────

interface BreezyJob { id: string; name: string; location: { name: string }; url: string; updated_at: string; description: string; }

export async function fetchBreezy(c: ATSConfig, mode: JobMode, visaSponsorship: boolean): Promise<Job[]> {
  const url = `https://${c.slug}.breezy.hr/json`;
  const res = await safeFetch(url);
  if (!res || !res.ok) return [];
  const jobs = await res.json() as BreezyJob[];
  return processJobs(jobs.map(r => ({
    id: `${mode}_breezy_${c.slug}_${r.id}`, title: r.name, location: r.location?.name ?? c.city ?? c.country,
    url: r.url, postedAt: r.updated_at, description: stripHtml(r.description),
  })), c, mode, visaSponsorship);
}

// ── SmartRecruiters ───────────────────────────────────────────────────────

interface SRJob { id: string; name: string; releasedDate: string; location: { fullLocation: string }; ref: string; }
interface SRResp { content: SRJob[]; }

export async function fetchSmartRecruiters(c: ATSConfig, mode: JobMode, visaSponsorship: boolean): Promise<Job[]> {
  const url = `https://api.smartrecruiters.com/v1/companies/${c.slug}/postings`;
  const res = await safeFetch(url);
  if (!res || !res.ok) return [];
  const { content } = await res.json() as SRResp;

  const detailedJobs = await Promise.all(content.map(async (r) => {
    const detailRes = await safeFetch(r.ref);
    if (!detailRes || !detailRes.ok) return null;
    const detail = await detailRes.json() as { jobAd: { sections: { jobDescription: { content: string } } } };
    return {
      id: `${mode}_sr_${c.slug}_${r.id}`, title: r.name, location: r.location.fullLocation ?? c.city ?? c.country,
      url: `https://jobs.smartrecruiters.com/${c.slug}/${r.id}`,
      postedAt: r.releasedDate,
      description: stripHtml(detail.jobAd.sections.jobDescription.content),
    };
  }));

  return processJobs(detailedJobs.filter(Boolean) as RawJob[], c, mode, visaSponsorship);
}

// ── BambooHR ───────────────────────────────────────────────────────────────

interface BHJob { id: number; jobOpeningName: string; jobOpeningStatus: string; departmentLabel: string; city: string; country: string; datePosted: string; }
interface BHResp { result: BHJob[]; }

export async function fetchBambooHR(c: ATSConfig, mode: JobMode, visaSponsorship: boolean): Promise<Job[]> {
  const url = `https://${c.slug}.bamboohr.com/careers/list`;
  const res = await safeFetch(url);
  if (!res || !res.ok) return [];
  const data = await res.json() as BHResp;
  const jobs = data.result ?? [];
  return processJobs(jobs.map(r => ({
    id: `${mode}_bamboohr_${c.slug}_${r.id}`,
    title: r.jobOpeningName,
    location: r.city ? `${r.city}, ${r.country}` : c.city ?? c.country,
    url: `https://${c.slug}.bamboohr.com/careers/${r.id}`,
    postedAt: r.datePosted ?? new Date().toISOString(),
    description: "", // BambooHR list endpoint has no description; scoring will rely on title
  })), c, mode, visaSponsorship);
}

// ── GMT+2 / Egypt timezone restriction filter (for global pipeline) ─────────

/**
 * Returns true if the listing explicitly restricts timezone in a way
 * incompatible with GMT+2 (Egypt), or requires work authorization in a specific country.
 */
export function isTimezoneIncompatible(text: string): boolean {
  const t = text.toLowerCase();
  return [
    // Hard timezone restrictions incompatible with GMT+2
    /\b(us|usa|pst|mst|cst|est|pacific|mountain|central|eastern)\s*(time|timezone|tz|hours|based)\b/,
    /\bamerica(n)?\s+time(zone)?\b/,
    /\bmust\s+(be|work)\s+(in|within)\s+(us|usa|north\s+america|canada)\b/,
    /\b(pst|mst|cst|est|pt|mt|ct|et)\s*(±\d+|only|required|preferred)\b/,
    // Authorization / residency requirements
    /must\s+be\s+authorized\s+to\s+work\s+in/,
    /must\s+(be\s+a?\s*)?(us|uk|eu|canadian|australian)\s*(citizen|resident|national)/,
    /\b(eu|eea)\s+resident(s)?\s+(only|required|must)\b/,
    /right\s+to\s+work\s+in\s+(the\s+)?(uk|us|eu|canada|australia)\b/,
    /work\s+authorization\s+(in|for)\s+(the\s+)?(us|uk|eu)\b/,
  ].some(re => re.test(t));
}