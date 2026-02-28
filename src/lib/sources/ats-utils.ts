// src/lib/sources/ats-utils.ts
import type { Job, JobMode } from "../types";
import { isClearlyNonFrontend, isTooSenior, isGenericTitleButBackendRole, requiresCitizenshipOrClearance, scoreJob, BONUS_SKILLS } from "../scoring";

// ── Shared Types ────────────────────────────────────────────────────────────

export interface BaseCompany { name: string; country: string; countryFlag: string; city?: string; }
export interface ATSConfig extends BaseCompany { ats: "greenhouse" | "lever" | "ashby" | "workable" | "teamtailor" | "breezy" | "smartrecruiters" | "bamboohr"; slug: string; }

/** 
 * Maps common country names/codes found in ATS location strings to flags.
 */
const COUNTRY_MAP: Record<string, { name: string, flag: string }> = {
  "ireland": { name: "Ireland", flag: "🇮🇪" },
  "germany": { name: "Germany", flag: "🇩🇪" },
  "netherlands": { name: "Netherlands", flag: "🇳🇱" },
  "united kingdom": { name: "UK", flag: "🇬🇧" },
  "uk": { name: "UK", flag: "🇬🇧" },
  "london": { name: "UK", flag: "🇬🇧" },
  "berlin": { name: "Germany", flag: "🇩🇪" },
  "amsterdam": { name: "Netherlands", flag: "🇳🇱" },
  "dublin": { name: "Ireland", flag: "🇮🇪" },
  "spain": { name: "Spain", flag: "🇪🇸" },
  "barcelona": { name: "Spain", flag: "🇪🇸" },
  "madrid": { name: "Spain", flag: "🇪🇸" },
  "portugal": { name: "Portugal", flag: "🇵🇹" },
  "lisbon": { name: "Portugal", flag: "🇵🇹" },
  "france": { name: "France", flag: "🇫🇷" },
  "paris": { name: "France", flag: "🇫🇷" },
  "sweden": { name: "Sweden", flag: "🇸🇪" },
  "stockholm": { name: "Sweden", flag: "🇸🇪" },
  "denmark": { name: "Denmark", flag: "🇩🇰" },
  "copenhagen": { name: "Denmark", flag: "🇩🇰" },
  "finland": { name: "Finland", flag: "🇫🇮" },
  "helsinki": { name: "Finland", flag: "🇫🇮" },
  "poland": { name: "Poland", flag: "🇵🇱" },
  "warsaw": { name: "Poland", flag: "🇵🇱" },
  "usa": { name: "USA", flag: "🇺🇸" },
  "united states": { name: "USA", flag: "🇺🇸" },
  "egypt": { name: "Egypt", flag: "🇪🇬" },
  "cairo": { name: "Egypt", flag: "🇪🇬" },
  "remote": { name: "Remote", flag: "🌍" },
};

function detectCountry(location: string, fallback: { name: string, flag: string }): { name: string, flag: string } {
  const loc = (location || "").toLowerCase();
  for (const [key, val] of Object.entries(COUNTRY_MAP)) {
    if (loc.includes(key)) return val;
  }
  return fallback;
}

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

const AGE_CAP_DAYS = 7; // If it's older than 1 week, it's gone

/** Returns true if a job description contains too many bonus (backend/infra) skills,
 *  indicating it's likely a backend role despite a generic title. */
function isTooBackendForFrontend(description: string): boolean {
  const desc = description.toLowerCase();
  let bonusSkillCount = 0;
  for (const skill of BONUS_SKILLS) {
    if (new RegExp(`\\b${skill.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(desc)) {
      bonusSkillCount++;
    }
  }
  // If more than 3 bonus skills are mentioned, consider it too backend-heavy
  return bonusSkillCount >= 4;
}

/** For local jobs: extract a specific Egyptian city from the raw location string.
 *  Falls back to company.city (from ATSConfig), then "Cairo" as the safe default. */
function extractEgyptCity(rawLocation: string, companyCity?: string): string {
  const loc = (rawLocation || "").toLowerCase();
  if (loc.includes("remote"))     return "Remote 🌐";
  if (loc.includes("cairo"))      return "Cairo";
  if (loc.includes("giza"))       return "Giza";
  if (loc.includes("alexandria")) return "Alexandria";
  if (loc.includes("maadi"))      return "Maadi, Cairo";
  if (loc.includes("nasr city") || loc.includes("nasr-city")) return "Nasr City, Cairo";
  if (loc.includes("heliopolis")) return "Heliopolis, Cairo";
  if (loc.includes("new cairo") || loc.includes("new-cairo")) return "New Cairo";
  if (loc.includes("6th") || loc.includes("sheikh zayed")) return "6th of October";
  if (loc.includes("smart village")) return "Smart Village, Giza";
  // If location is just a country code or blank, use company default city
  return companyCity ?? "Cairo";
}

export function processJobs(raw: RawJob[], company: BaseCompany, mode: JobMode, visaSponsorship: boolean): Job[] {
  const now = new Date().toISOString();
  const cutoff = Date.now() - AGE_CAP_DAYS * 864e5;
  const out: Job[] = [];

  for (const r of raw) {
    const title = r.title.trim();
    if (isClearlyNonFrontend(title)) continue;
    if (isTooSenior(title)) continue;
    if (isGenericTitleButBackendRole(title, r.description)) continue;
    if (isTooBackendForFrontend(r.description)) continue; // New filter using BONUS_SKILLS

    // ── 14-day hard cap ──
    const postedMs = Date.parse(r.postedAt);
    if (!isNaN(postedMs) && postedMs < cutoff) continue;
    
    // For local mode: NO location filtering — we only ever scrape Egyptian company ATSs,
    // so every job that passes title/skill filters IS a Cairo/Egypt job by definition.
    // We do extract a display city below for the UI.

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

    // For local jobs: extract Egyptian city from location string, fallback to company city
    const displayLocation = mode === "local"
      ? extractEgyptCity(r.location, company.city)
      : r.location;

    const countryInfo = detectCountry(r.location, { name: company.country, flag: company.countryFlag });

    const hasDate = !!r.postedAt && r.postedAt.trim() !== "";
    out.push({
      id: r.id, source: "company", mode,
      title, company: company.name, location: displayLocation,
      country: countryInfo.name, countryFlag: countryInfo.flag,
      url: r.url, description: r.description, 
      isRemote,
      postedAt: hasDate ? r.postedAt : now,
      dateUnknown: !hasDate,           // true = API returned no date, UI shows "Date N/A"
      visaSponsorship: actualSponsorship,
      ...scored, fetchedAt: now,
    });
  }

  if (raw.length === 0) {
    console.warn(`[${mode}] ⚠️  ${company.name}: Returned 0 jobs (API might be broken or slug changed)`);
  } else {
    console.log(`[${mode}] ${company.name}: ${raw.length} total → ${out.length} matches`);
  }
  return out;
}

// ── Greenhouse ─────────────────────────────────────────────────────────────

interface GHJob { id: number; title: string; location: { name: string }; absolute_url: string; updated_at: string; content?: string; }

export async function fetchGreenhouse(c: ATSConfig, mode: JobMode, visaSponsorship: boolean): Promise<Job[]> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${c.slug}/jobs?content=true`;
  const res = await safeFetch(url);
  if (!res || !res.ok) {
    console.error(`[Greenhouse] ❌ ${c.name}: Fetch failed (Status: ${res?.status || "Timeout/Unknown"}) URL: ${url}`);
    return [];
  }
  try {
    const { jobs } = await res.json() as { jobs: GHJob[] };
    return processJobs(jobs.map(r => ({
      id: `${mode}_gh_${c.slug}_${r.id}`, title: r.title, location: r.location?.name ?? c.city ?? c.country,
      url: r.absolute_url, postedAt: r.updated_at, description: r.content ? stripHtml(r.content) : "",
    })), c, mode, visaSponsorship);
  } catch (err) {
    console.error(`[Greenhouse] Failed to parse JSON from ${url} for ${c.name}:`, err);
    return [];
  }
}

// ── Lever ──────────────────────────────────────────────────────────────────

interface LeverJob { id: string; text: string; hostedUrl: string; createdAt: number; descriptionPlain?: string; description?: string; categories?: { location?: string }; }

export async function fetchLever(c: ATSConfig, mode: JobMode, visaSponsorship: boolean): Promise<Job[]> {
  const url = `https://api.lever.co/v0/postings/${c.slug}?mode=json`;
  const res = await safeFetch(url);
  if (!res || !res.ok) {
    console.error(`[Lever] ❌ ${c.name}: Fetch failed (Status: ${res?.status || "Timeout/Unknown"}) URL: ${url}`);
    return [];
  }
  try {
    const jobs = await res.json() as LeverJob[];
    return processJobs(jobs.map(r => ({
      id: `${mode}_lever_${c.slug}_${r.id}`, title: r.text, location: r.categories?.location ?? c.city ?? c.country,
      url: r.hostedUrl, postedAt: new Date(r.createdAt).toISOString(),
      description: r.descriptionPlain ?? (r.description ? stripHtml(r.description) : ""),
    })), c, mode, visaSponsorship);
  } catch (err) {
    console.error(`[Lever] Failed to parse JSON from ${url} for ${c.name}:`, err);
    return [];
  }
}

// ── Ashby ──────────────────────────────────────────────────────────────────

interface AshbyJob { id: string; title: string; locationName?: string; jobUrl: string; publishedAt?: string; descriptionHtml?: string; descriptionPlain?: string; }
interface AshbyResp { jobs?: AshbyJob[]; jobPostings?: AshbyJob[]; }

export async function fetchAshby(c: ATSConfig, mode: JobMode, visaSponsorship: boolean): Promise<Job[]> {
  const url = `https://api.ashbyhq.com/posting-api/job-board/${c.slug}?includeCompensation=true`;
  const res = await safeFetch(url);
  if (!res || !res.ok) {
    console.error(`[Ashby] ❌ ${c.name}: Fetch failed (Status: ${res?.status || "Timeout/Unknown"}) URL: ${url}`);
    return [];
  }
  try {
    const data = await res.json() as AshbyResp;
    const jobs = data.jobs ?? data.jobPostings ?? [];
    return processJobs(jobs.map(r => ({
      id: `${mode}_ashby_${c.slug}_${r.id}`, title: r.title, location: r.locationName ?? c.city ?? c.country,
      url: r.jobUrl, postedAt: r.publishedAt ?? new Date().toISOString(),
      description: r.descriptionPlain ?? (r.descriptionHtml ? stripHtml(r.descriptionHtml) : ""),
    })), c, mode, visaSponsorship);
  } catch (err) {
    console.error(`[Ashby] Failed to parse JSON from ${url} for ${c.name}:`, err);
    return [];
  }
}

// ── Workable ───────────────────────────────────────────────────────────────

interface WorkableJob { shortcode: string; title: string; city: string; country: string; url: string; published_on: string; description?: string; body?: string; full_description?: string; }
interface WorkableResp { jobs: WorkableJob[]; }
interface WorkableDetail { full_description?: string; description?: string; }

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ── Global Workable rate limiter ─────────────────────────────────────────
// Workable is aggressive with 429s. Queue ALL requests globally, 1.5s apart.
let workableQueue: Promise<unknown> = Promise.resolve();
function queueWorkable<T>(fn: () => Promise<T>): Promise<T> {
  // Chain off current tail — result becomes the new tail even on error
  const result = workableQueue.then(() => sleep(3000)).then(fn);
  workableQueue = result.catch(() => {}); // swallow error so chain continues
  return result;
}

/** Run promises in batches to avoid hammering APIs */
async function pLimit<T>(fns: (() => Promise<T>)[], concurrency = 5): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < fns.length; i += concurrency) {
    const batch = await Promise.allSettled(fns.slice(i, i + concurrency).map(f => f()));
    for (const r of batch) results.push(r.status === "fulfilled" ? r.value : null as T);
    if (i + concurrency < fns.length) await sleep(2000); // 2s delay between batches
  }
  return results;
}

export async function fetchWorkable(c: ATSConfig, mode: JobMode, visaSponsorship: boolean): Promise<Job[]> {
  const listUrl = `https://apply.workable.com/api/v1/widget/accounts/${c.slug}?details=true`;

  const doFetch = () => fetch(listUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      "Referer": "https://apply.workable.com/",
      "Origin": "https://apply.workable.com",
    },
    signal: AbortSignal.timeout(30_000),
  }).catch(() => null);

  let res = await queueWorkable(doFetch);

  // Handle 429 with Retry-After
  if (res?.status === 429) {
    const retryAfter = parseInt(res.headers.get("Retry-After") ?? "60", 10);
    const waitMs = (isNaN(retryAfter) ? 60 : retryAfter) * 1000;
    console.warn(`[Workable] ⏳ ${c.name}: 429 — waiting ${waitMs / 1000}s (Retry-After)`);
    await sleep(waitMs);
    res = await doFetch();
  }

  if (!res || !res.ok) {
    console.error(`[Workable] ❌ ${c.name}: Fetch failed (Status: ${res?.status || "Timeout/Unknown"}) URL: ${listUrl}`);
    return [];
  }
  let data: WorkableResp;
  try {
    data = await res.json() as WorkableResp;
  } catch (err) {
    console.error(`[Workable] Failed to parse JSON from ${listUrl} for ${c.name}:`, err);
    return [];
  }
  const jobs = data.jobs ?? [];

  // Step 2: pre-filter by title before fetching descriptions
  const candidates = jobs.filter(r => !isClearlyNonFrontend(r.title) && !isTooSenior(r.title));

  // Step 3: fetch full description per candidate
  const withDesc = await pLimit(candidates.map(r => async () => {
    const detailUrl = `https://apply.workable.com/api/v1/widget/accounts/${c.slug}/jobs/${r.shortcode}`;
    const dr = await safeFetch(detailUrl);
    let desc = stripHtml(r.description ?? r.body ?? "");
    if (dr && dr.ok) {
      try {
        const detail = await dr.json() as WorkableDetail;
        desc = stripHtml(detail.full_description ?? detail.description ?? desc);
      } catch { /* keep listing description */ }
    }
    return {
      id: `${mode}_workable_${c.slug}_${r.shortcode}`,
      title: r.title,
      location: r.city ? `${r.city}, ${r.country}` : c.city ?? c.country,
      url: r.url,
      postedAt: r.published_on,
      description: desc,
    };
  }), 3);

  return processJobs(withDesc.filter(Boolean), c, mode, visaSponsorship);
}

// ── Teamtailor ─────────────────────────────────────────────────────────────

interface TTJob { id: string; attributes: { title: string; "external-url": string; "published-at": string; "body-html": string; "location-name": string; } }
interface TTResp { data: TTJob[]; }

export async function fetchTeamtailor(c: ATSConfig, mode: JobMode, visaSponsorship: boolean): Promise<Job[]> {
  // Use the Teamtailor public API endpoint with proper Accept header
  const url = `https://api.teamtailor.com/v1/jobs?&filter[status]=published`;
  // Fallback: use the public jobs.json endpoint with Accept: application/json
  const publicUrl = `https://${c.slug}.teamtailor.com/jobs.json`;
  const res = await fetch(publicUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      "Referer": `https://${c.slug}.teamtailor.com/jobs`,
      "X-Requested-With": "XMLHttpRequest",
      "Connection": "keep-alive",
    },
    signal: AbortSignal.timeout(30_000),
  }).catch(() => null);
  if (!res || !res.ok) {
    console.error(`[Teamtailor] ❌ ${c.name}: Fetch failed (Status: ${res?.status || "Timeout/Unknown"}) URL: ${publicUrl}`);
    return [];
  }
  try {
    const { data } = await res.json() as TTResp;
    return processJobs(data.map(r => ({
      id: `${mode}_tt_${c.slug}_${r.id}`, title: r.attributes.title, location: r.attributes["location-name"] ?? c.city ?? c.country,
      url: r.attributes["external-url"] || `https://${c.slug}.teamtailor.com/jobs/${r.id}`,
      postedAt: r.attributes["published-at"],
      description: stripHtml(r.attributes["body-html"]),
    })), c, mode, visaSponsorship);
  } catch (err) {
    console.error(`[Teamtailor] Failed to parse JSON from ${publicUrl} for ${c.name}:`, err);
    return [];
  }
}

// ── Breezy HR ──────────────────────────────────────────────────────────────

interface BreezyJob { id: string; name: string; location: { name: string }; url: string; updated_at: string; description: string; }

export async function fetchBreezy(c: ATSConfig, mode: JobMode, visaSponsorship: boolean): Promise<Job[]> {
  const url = `https://${c.slug}.breezy.hr/json`;
  const res = await safeFetch(url);
  if (!res || !res.ok) {
    console.error(`[Breezy] ❌ ${c.name}: Fetch failed (Status: ${res?.status || "Timeout/Unknown"}) URL: ${url}`);
    return [];
  }
  try {
    const jobs = await res.json() as BreezyJob[];
    return processJobs(jobs.map(r => ({
      id: `${mode}_breezy_${c.slug}_${r.id}`, title: r.name, location: r.location?.name ?? c.city ?? c.country,
      url: r.url, postedAt: r.updated_at, description: stripHtml(r.description),
    })), c, mode, visaSponsorship);
  } catch (err) {
    console.error(`[Breezy] Failed to parse JSON from ${url} for ${c.name}:`, err);
    return [];
  }
}

// ── SmartRecruiters ───────────────────────────────────────────────────────

interface SRJob { id: string; name: string; releasedDate: string; location: { fullLocation: string }; ref: string; }
interface SRResp { content: SRJob[]; }

export async function fetchSmartRecruiters(c: ATSConfig, mode: JobMode, visaSponsorship: boolean): Promise<Job[]> {
  const url = `https://api.smartrecruiters.com/v1/companies/${c.slug}/postings`;
  const res = await safeFetch(url);
  if (!res || !res.ok) {
    console.error(`[SmartRecruiters] ❌ ${c.name}: Fetch failed (Status: ${res?.status || "Timeout/Unknown"}) URL: ${url}`);
    return [];
  }
  let content: SRJob[];
  try {
    ({ content } = await res.json() as SRResp);
  } catch (err) {
    console.error(`[SmartRecruiters] Failed to parse JSON from ${url} for ${c.name}:`, err);
    return [];
  }
  
  const detailedJobs = await Promise.all(content.map(async (r) => {
    const detailRes = await safeFetch(r.ref);
    if (!detailRes || !detailRes.ok) return null;
    try {
      const detail = await detailRes.json() as { jobAd: { sections: { jobDescription: { content: string } } } };
      return {
          id: `${mode}_sr_${c.slug}_${r.id}`, title: r.name, location: r.location.fullLocation ?? c.city ?? c.country,
          url: `https://jobs.smartrecruiters.com/${c.slug}/${r.id}`,
          postedAt: r.releasedDate,
          description: stripHtml(detail.jobAd.sections.jobDescription.content),
      };
    } catch (err) {
      console.error(`[SmartRecruiters] Failed to parse JSON from ${r.ref} for ${c.name}:`, err);
      return null;
    }
  }));

  return processJobs(detailedJobs.filter(Boolean) as RawJob[], c, mode, visaSponsorship);
}

// ── BambooHR ───────────────────────────────────────────────────────────────

interface BHJob { id: number; jobOpeningName: string; jobOpeningStatus: string; departmentLabel: string; city: string; country: string; datePosted: string; }
interface BHResp { result: BHJob[]; }

export async function fetchBambooHR(c: ATSConfig, mode: JobMode, visaSponsorship: boolean): Promise<Job[]> {
  const url = `https://${c.slug}.bamboohr.com/careers/list`;
  const res = await safeFetch(url);
  if (!res || !res.ok) {
    console.error(`[BambooHR] ❌ ${c.name}: Fetch failed (Status: ${res?.status || "Timeout/Unknown"}) URL: ${url}`);
    return [];
  }
  try {
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
  } catch (err) {
    console.error(`[BambooHR] Failed to parse JSON from ${url} for ${c.name}:`, err);
    return [];
  }
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

// ── Custom Local Egyptian Company Fetchers ──────────────────────────────────

/**
 * Giza Systems — custom careers site.
 * Filters: Egypt jobs, IT/Software role categories (5,21), sorted by date.
 * Returns HTML page, we extract job cards from it.
 */
export async function fetchGizaSystems(mode: JobMode): Promise<Job[]> {
  const company: BaseCompany = { name: "Giza Systems", country: "Egypt", countryFlag: "🇪🇬", city: "Cairo" };
  const url = "https://www.gizasystemscareers.com/app/control/byt_job_search_manager?action=1&token=9IAKQR&query=trigger%3Ddate_indexed%26job_city%3Deg%2C2%2C0%26page%3D1%26jb_role%3D5%2C21%26date_indexed%3D8&body=job-search-results&lan=en";
  const res = await safeFetch(url);
  if (!res) return [];
  const html = await res.text();

  // Extract job cards: title, link, date from the returned HTML fragment
  const jobs: RawJob[] = [];
  // Pattern: job title in anchor tags and date in nearby spans
  const cardRegex = /<a[^>]+href="([^"]+byt_job_details[^"]+)"[^>]*>\s*([^<]+)<\/a>/gi;
  const dateRegex = /(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}-\d{2}-\d{2})/;
  let match: RegExpExecArray | null;
  const seenUrls = new Set<string>();

  // Split into rough "cards" to pair title+date
  const cards = html.split(/class="[^"]*job[^"]*"/i);
  for (const card of cards) {
    const linkMatch = /<a[^>]+href="([^"]+byt_job_details[^"]+)"[^>]*>([^<]{3,80})<\/a>/i.exec(card);
    if (!linkMatch) continue;
    const [, href, rawTitle] = linkMatch;
    const title = rawTitle.trim();
    if (!title || seenUrls.has(href)) continue;
    seenUrls.add(href);

    const dateMatch = dateRegex.exec(card);
    const postedAt = dateMatch ? new Date(dateMatch[1]).toISOString() : new Date().toISOString();

    const fullUrl = href.startsWith("http") ? href : `https://www.gizasystemscareers.com${href}`;
    jobs.push({ id: `local_gizasystems_${Buffer.from(href).toString("base64").slice(0, 16)}`, title, location: "Cairo", url: fullUrl, postedAt, description: "" });
  }

  console.log(`[local] Giza Systems raw: ${jobs.length}`);
  return processJobs(jobs, company, mode, false);
}

/**
 * Bright Skies — GraphQL API.
 */
export async function fetchBrightSkies(mode: JobMode): Promise<Job[]> {
  const company: BaseCompany = { name: "Bright Skies", country: "Egypt", countryFlag: "🇪🇬", city: "Cairo" };
  const res = await (async () => {
    try {
      return await fetch("https://brightskiesinc.com/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" },
        body: JSON.stringify({
          operationName: "getJobs",
          variables: { pageSize: 50, page: 1, title: "" },
          query: `query getJobs($pageSize: Int!, $page: Int!, $title: String, $department: String, $location: String) {
            jobs(filters: {title: {contains: $title}, department: {contains: $department}, location: {contains: $location}}, pagination: {pageSize: $pageSize, page: $page}) {
              data { id attributes { title location job_type department } }
            }
          }`,
        }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch { return null; }
  })();

  if (!res) return [];
  try {
    const data = await res.json() as { data?: { jobs?: { data?: Array<{ id: string; attributes: { title: string; location: string; department: string } }> } } };
    const items = data?.data?.jobs?.data ?? [];
    const jobs: RawJob[] = items.map((item) => ({
      id: `local_brightskies_${item.id}`,
      title: item.attributes.title,
      location: item.attributes.location || "Cairo",
      url: `https://brightskiesinc.com/careers/jobs/${item.id}`,
      postedAt: new Date().toISOString(), // no date in API response
      description: item.attributes.department || "",
    }));
    console.log(`[local] Bright Skies raw: ${jobs.length}`);
    return processJobs(jobs, company, mode, false);
  } catch { return []; }
}

/**
 * Pharos Solutions — WordPress AJAX job filter endpoint.
 */
export async function fetchPharos(mode: JobMode): Promise<Job[]> {
  const company: BaseCompany = { name: "Pharos Solutions", country: "Egypt", countryFlag: "🇪🇬", city: "Cairo" };
  const res = await (async () => {
    try {
      return await fetch("https://pharos-solutions.de/wp-admin/admin-ajax.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "Mozilla/5.0",
        },
        body: "awsm_job_spec%5Bjob-category%5D=36&awsm_job_spec%5Bjob-type%5D=32&awsm_job_spec%5Bjob-location%5D=&action=jobfilter&listings_per_page=30",
        signal: AbortSignal.timeout(15_000),
      });
    } catch { return null; }
  })();

  if (!res) return [];
  try {
    const html = await res.text();
    const jobs: RawJob[] = [];
    // Extract job listings from WP HTML response
    const linkRegex = /<a[^>]+href="(https?:\/\/pharos-solutions\.de\/job\/[^"]+)"[^>]*>\s*<h2[^>]*>([^<]{3,100})<\/h2>/gi;
    const dateRegex = /<time[^>]+datetime="([^"]+)"/i;
    let match: RegExpExecArray | null;

    // Split by job cards
    const cards = html.split(/<article|<li[^>]*class="[^"]*job/i);
    for (const card of cards) {
      const linkM = /<a[^>]+href="(https?:\/\/pharos-solutions\.de\/(?:job|jobs)[^"]*)"[^>]*>([^<]{3,100})/i.exec(card);
      if (!linkM) continue;
      const [, url, rawTitle] = linkM;
      const title = rawTitle.replace(/<[^>]+>/g, "").trim();
      if (!title) continue;

      const dateM = dateRegex.exec(card);
      const postedAt = dateM ? dateM[1] : new Date().toISOString();

      jobs.push({
        id: `local_pharos_${Buffer.from(url).toString("base64").slice(0, 16)}`,
        title, location: "Cairo", url, postedAt, description: "",
      });
    }
    console.log(`[local] Pharos raw: ${jobs.length}`);
    return processJobs(jobs, company, mode, false);
  } catch { return []; }
}
