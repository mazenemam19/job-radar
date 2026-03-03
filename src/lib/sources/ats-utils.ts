// src/lib/sources/ats-utils.ts
import type { Job, JobMode } from "../types";
import { isClearlyNonFrontend, isTooSeniorOrTooJunior, scoreJob } from "../scoring";
import fs from "fs";
import path from "path";

// ── Shared Types ────────────────────────────────────────────────────────────

export interface BaseCompany {
  name: string;
  country: string;
  countryFlag: string;
  city?: string;
}
export interface ATSConfig extends BaseCompany {
  ats:
    | "greenhouse"
    | "lever"
    | "ashby"
    | "workable"
    | "teamtailor"
    | "breezy"
    | "smartrecruiters"
    | "bamboohr"
    | "jazzhr";
  slug: string;
}

const COUNTRY_MAP: Record<string, { name: string; flag: string }> = {
  ireland: { name: "Ireland", flag: "🇮🇪" },
  germany: { name: "Germany", flag: "🇩🇪" },
  netherlands: { name: "Netherlands", flag: "🇳🇱" },
  "united kingdom": { name: "UK", flag: "🇬🇧" },
  uk: { name: "UK", flag: "🇬🇧" },
  london: { name: "UK", flag: "🇬🇧" },
  berlin: { name: "Germany", flag: "🇩🇪" },
  amsterdam: { name: "Netherlands", flag: "🇳🇱" },
  dublin: { name: "Ireland", flag: "🇮🇪" },
  spain: { name: "Spain", flag: "🇪🇸" },
  barcelona: { name: "Spain", flag: "🇪🇸" },
  madrid: { name: "Spain", flag: "🇪🇸" },
  portugal: { name: "Portugal", flag: "🇵🇹" },
  lisbon: { name: "Portugal", flag: "🇵🇹" },
  france: { name: "France", flag: "🇫🇷" },
  paris: { name: "France", flag: "🇫🇷" },
  sweden: { name: "Sweden", flag: "🇸🇪" },
  stockholm: { name: "Sweden", flag: "🇸🇪" },
  denmark: { name: "Denmark", flag: "🇩🇰" },
  copenhagen: { name: "Denmark", flag: "🇩🇰" },
  finland: { name: "Finland", flag: "🇫🇮" },
  helsinki: { name: "Finland", flag: "🇫🇮" },
  poland: { name: "Poland", flag: "🇵🇱" },
  warsaw: { name: "Poland", flag: "🇵🇱" },
  usa: { name: "USA", flag: "🇺🇸" },
  "united states": { name: "USA", flag: "🇺🇸" },
  egypt: { name: "Egypt", flag: "🇪🇬" },
  cairo: { name: "Egypt", flag: "🇪🇬" },
  "saudi arabia": { name: "Saudi Arabia", flag: "🇸🇦" },
  "united arab emirates": { name: "UAE", flag: "🇦🇪" },
  uae: { name: "UAE", flag: "🇦🇪" },
  dubai: { name: "UAE", flag: "🇦🇪" },
  riyadh: { name: "Saudi Arabia", flag: "🇸🇦" },
  remote: { name: "Remote", flag: "🌍" },
};

function detectCountry(
  location: string,
  fallback: { name: string; flag: string },
): { name: string; flag: string } {
  const loc = (location || "").toLowerCase();
  for (const [key, val] of Object.entries(COUNTRY_MAP)) {
    const re = new RegExp(`\\b${key}\\b`, "i");
    if (re.test(loc)) return val;
  }
  return fallback;
}

// ── Strict Filters ──────────────────────────────────────────────────────────

export function isGeographicallyBlacklisted(text: string): boolean {
  const t = text.toLowerCase();
  return [
    /\bisrael\b/,
    /\btel\s+aviv\b/,
    /\btel-aviv\b/,
    /\bhaifa\b/,
    /\bherzliya\b/,
    /\bjerusalem\b/,
    /\bra'anana\b/,
    /\bgush\s+dan\b/,
    /\bcentral\s+district\b/,
  ].some((re) => re.test(t));
}

export function isTimezoneIncompatible(text: string): boolean {
  const t = text.toLowerCase();
  if (/\b(emea|europe|global|anywhere|africa|egypt|london|berlin|gmt\+2|gmt\+3)\b/.test(t))
    return false;
  const usOnly =
    /\b(us\s+only|usa\s+only|united\s+states\s+only|north\s+america\s+only|canada\s+only)\b/.test(
      t,
    );
  const usTimezones = /\b(pst|est|cst|mst|pacific\s+time|eastern\s+time)\b/.test(t);
  const usRemote = /\bremote[,.\s-]+(us|usa|united\s+states)\b/.test(t);
  return usOnly || usTimezones || usRemote;
}

export function isTooBackendForFrontend(description: string): boolean {
  const d = description.toLowerCase();
  const backendSignals = [
    /\bkubernetes\b/,
    /\bterraform\b/,
    /\baws\s+lambda\b/,
    /\bpostgresql\b/,
    /\bmicroservices\b/,
    /\bdistributed\s+systems\b/,
    /\bjava\s+spring\b/,
    /\bpython\s+django\b/,
    /\bgo\s+backend\b/,
  ];
  const bCount = backendSignals.filter((re) => re.test(d)).length;
  return bCount >= 4;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const TMP_DIR = "/tmp";
const REQ_COUNTS_PATH = path.resolve(TMP_DIR, "req-counts.json");
const WORKABLE_COOLDOWN_PATH = path.resolve(TMP_DIR, "workable-cooldown.json");
const WORKABLE_BLOCKED_PATH = path.resolve(TMP_DIR, "workable-blocked.json");

type DomainCounts = Record<string, number>;
interface WorkableCooldownEntry {
  slug: string;
  until: string;
}

let domainCountsCache: DomainCounts | null = null;
let workableCooldownCache: WorkableCooldownEntry[] | null = null;

type WorkableBudgetConfig = { visa: number; global: number; local: number };
const DEFAULT_BUDGET: WorkableBudgetConfig = { visa: 12, global: 12, local: 12 };
let workableBudget: WorkableBudgetConfig = { ...DEFAULT_BUDGET };
const workableUsedByMode: Record<JobMode, number> = { visa: 0, global: 0, local: 0 };

export function resetWorkableUsed(mode?: JobMode): void {
  if (mode) workableUsedByMode[mode] = 0;
  else {
    workableUsedByMode.visa = 0;
    workableUsedByMode.global = 0;
    workableUsedByMode.local = 0;
  }
}

export function setWorkableBudgetConfig(config: Partial<WorkableBudgetConfig>): void {
  workableBudget = { ...DEFAULT_BUDGET, ...config };
  resetWorkableUsed();
}

function ensureTmpDir(filePath: string): void {
  const dir = path.dirname(filePath);
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  } catch {}
}

function loadDomainCounts(): DomainCounts {
  if (domainCountsCache) return domainCountsCache;
  try {
    const raw = fs.readFileSync(REQ_COUNTS_PATH, "utf-8");
    domainCountsCache = JSON.parse(raw);
  } catch {
    domainCountsCache = {};
  }
  return domainCountsCache || {};
}

function saveDomainCounts(counts: DomainCounts): void {
  try {
    ensureTmpDir(REQ_COUNTS_PATH);
    fs.writeFileSync(REQ_COUNTS_PATH, JSON.stringify(counts, null, 2));
  } catch {}
}

function trackDomainRequest(url: string): void {
  try {
    const host = new URL(url).host || "unknown";
    const counts = loadDomainCounts();
    counts[host] = (counts[host] ?? 0) + 1;
    saveDomainCounts(counts);
  } catch {}
}

function loadWorkableCooldowns(): WorkableCooldownEntry[] {
  if (workableCooldownCache) return workableCooldownCache;
  try {
    const raw = fs.readFileSync(WORKABLE_COOLDOWN_PATH, "utf-8");
    workableCooldownCache = JSON.parse(raw);
  } catch {
    workableCooldownCache = [];
  }
  return workableCooldownCache || [];
}

function getWorkableCooldownUntil(slug: string): Date | null {
  const entries = loadWorkableCooldowns();
  const entry = entries.find((e) => e.slug === slug);
  if (!entry) return null;
  const ms = Date.parse(entry.until);
  return isNaN(ms) ? null : new Date(ms);
}

function loadWorkableBlocked(): WorkableCooldownEntry[] {
  try {
    return JSON.parse(fs.readFileSync(WORKABLE_BLOCKED_PATH, "utf-8"));
  } catch {
    return [];
  }
}

function setWorkableBlocked(slug: string, until: Date): void {
  const entries = loadWorkableBlocked();
  const iso = until.toISOString();
  const existing = entries.find((e) => e.slug === slug);
  if (existing) existing.until = iso;
  else entries.push({ slug, until: iso });
  try {
    ensureTmpDir(WORKABLE_BLOCKED_PATH);
    fs.writeFileSync(WORKABLE_BLOCKED_PATH, JSON.stringify(entries, null, 2));
  } catch {}
}

function isWorkableBlocked(slug: string): boolean {
  const entries = loadWorkableBlocked();
  const entry = entries.find((e) => e.slug === slug);
  if (!entry) return false;
  return new Date(entry.until).getTime() > Date.now();
}

const workable429SlugsThisRun = new Set<string>();
export function getWorkable429SlugsThisRun(): string[] {
  return Array.from(workable429SlugsThisRun);
}
export function markWorkableSlugsBlocked24h(slugs: string[]): void {
  const until = new Date(Date.now() + 864e5);
  for (const slug of slugs) setWorkableBlocked(slug, until);
}

export function stripHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export async function safeFetch(url: string, timeout = 30_000): Promise<Response | null> {
  trackDomainRequest(url);
  try {
    return await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(timeout),
    });
  } catch {
    return null;
  }
}

const AGE_CAP_DAYS = 7;
export interface RawJob {
  id: string;
  title: string;
  location: string;
  url: string;
  postedAt: string;
  description: string;
  company?: string;
  locationRestrictions?: string[];
}

export interface FetcherResult {
  jobs: Job[];
  rawCount?: number;
  error?: string;
  durationMs?: number;
}

/** For local jobs: extract a specific Egyptian city from the raw location string. */
function extractEgyptCity(rawLocation: string, companyCity?: string): string {
  const loc = (rawLocation || "").toLowerCase();
  if (loc.includes("remote")) return "Remote 🌐";
  if (loc.includes("cairo")) return "Cairo";
  if (loc.includes("giza")) return "Giza";
  if (loc.includes("alexandria")) return "Alexandria";
  if (loc.includes("maadi")) return "Maadi, Cairo";
  if (loc.includes("nasr city") || loc.includes("nasr-city")) return "Nasr City, Cairo";
  if (loc.includes("heliopolis")) return "Heliopolis, Cairo";
  if (loc.includes("new cairo") || loc.includes("new-cairo")) return "New Cairo";
  if (loc.includes("6th") || loc.includes("sheikh zayed")) return "6th of October";
  if (loc.includes("smart village")) return "Smart Village, Giza";
  return companyCity ?? "Cairo";
}

export function processJobs(
  raw: RawJob[],
  company: BaseCompany,
  mode: JobMode,
  visaSponsorship: boolean,
): Job[] {
  const now = new Date().toISOString();
  const cutoff = Date.now() - AGE_CAP_DAYS * 864e5;
  const out: Job[] = [];

  for (const r of raw) {
    const title = r.title.trim();
    if (isClearlyNonFrontend(title) || isTooSeniorOrTooJunior(title)) continue;
    if (isGeographicallyBlacklisted(title + r.location + r.description)) continue;

    // ── Global Mode Restrictions ──
    if (mode === "global") {
      if (isTimezoneIncompatible(r.description + r.location)) continue;

      // If there are specific country restrictions and it's not "Remote/Worldwide/Egypt/EMEA"
      if (r.locationRestrictions && r.locationRestrictions.length > 0) {
        const isBroad = r.locationRestrictions.some((loc) =>
          /remote|worldwide|anywhere|emea|europe|global/i.test(loc),
        );
        const hasEgypt = r.locationRestrictions.some((loc) => /egypt/i.test(loc));

        // If it's a single country restriction (or multiple specific ones) and none is Egypt/Broad
        if (!isBroad && !hasEgypt) {
          continue;
        }
      }
    }

    if (isTooBackendForFrontend(r.description)) continue;

    const postedMs = Date.parse(r.postedAt);
    if (!isNaN(postedMs) && postedMs < cutoff) continue;

    const scored = scoreJob({
      title,
      description: r.description,
      location: r.location,
      postedAt: r.postedAt,
    });
    if (scored.skillMatchScore === 0) continue;

    const actualSponsorship =
      visaSponsorship || /visa\s+sponsorship|relocation/i.test(r.description);
    const isRemote = /remote|work\s+from\s+home/i.test(title + r.location + r.description);
    const countryInfo = detectCountry(r.location, {
      name: company.country,
      flag: company.countryFlag,
    });

    const displayLocation =
      mode === "local" ? extractEgyptCity(r.location, company.city) : r.location;

    out.push({
      id: r.id,
      source: "company",
      mode,
      title,
      company: r.company || company.name,
      location: displayLocation,
      country: countryInfo.name,
      countryFlag: countryInfo.flag,
      url: r.url,
      description: r.description.slice(0, 3000),
      isRemote,
      postedAt: r.postedAt || now,
      dateUnknown: !r.postedAt,
      visaSponsorship: actualSponsorship,
      ...scored,
      fetchedAt: now,
    });
  }
  return out;
}

// ── Greenhouse ─────────────────────────────────────────────────────────────
export async function fetchGreenhouse(
  c: ATSConfig,
  mode: JobMode,
  visaSponsorship: boolean,
): Promise<FetcherResult> {
  const t0 = Date.now();
  const url = `https://boards-api.greenhouse.io/v1/boards/${c.slug}/jobs?content=true`;
  const res = await safeFetch(url);
  if (!res) return { jobs: [], rawCount: 0, error: "Network/Timeout", durationMs: Date.now() - t0 };
  if (!res.ok)
    return { jobs: [], rawCount: 0, error: `HTTP ${res.status}`, durationMs: Date.now() - t0 };
  try {
    const { jobs } = (await res.json()) as any;
    const rawCount = jobs.length;
    const processed = processJobs(
      jobs.map((r: any) => ({
        id: `${mode}_gh_${c.slug}_${r.id}`,
        title: r.title,
        location: r.location?.name ?? c.city ?? c.country,
        url: r.absolute_url,
        postedAt: r.updated_at,
        description: stripHtml(r.content || ""),
      })),
      c,
      mode,
      visaSponsorship,
    );
    return { jobs: processed, rawCount, durationMs: Date.now() - t0 };
  } catch (e) {
    return { jobs: [], rawCount: 0, error: `Parse Error: ${e}`, durationMs: Date.now() - t0 };
  }
}

// ── Lever ──────────────────────────────────────────────────────────────────
export async function fetchLever(
  c: ATSConfig,
  mode: JobMode,
  visaSponsorship: boolean,
): Promise<FetcherResult> {
  const t0 = Date.now();
  const url = `https://api.lever.co/v0/postings/${c.slug}?mode=json`;
  const res = await safeFetch(url);
  if (!res) return { jobs: [], rawCount: 0, error: "Network/Timeout", durationMs: Date.now() - t0 };
  if (!res.ok)
    return { jobs: [], rawCount: 0, error: `HTTP ${res.status}`, durationMs: Date.now() - t0 };
  try {
    const jobs = (await res.json()) as any[];
    const rawCount = jobs.length;
    const processed = processJobs(
      jobs.map((r: any) => ({
        id: `${mode}_lever_${c.slug}_${r.id}`,
        title: r.text,
        location: r.categories?.location ?? c.city ?? c.country,
        url: r.hostedUrl,
        postedAt: new Date(r.createdAt).toISOString(),
        description: stripHtml(r.description || ""),
      })),
      c,
      mode,
      visaSponsorship,
    );
    return { jobs: processed, rawCount, durationMs: Date.now() - t0 };
  } catch (e) {
    return { jobs: [], rawCount: 0, error: `Parse Error: ${e}`, durationMs: Date.now() - t0 };
  }
}

// ── Ashby ──────────────────────────────────────────────────────────────────
export async function fetchAshby(
  c: ATSConfig,
  mode: JobMode,
  visaSponsorship: boolean,
): Promise<FetcherResult> {
  const t0 = Date.now();
  const url = `https://api.ashbyhq.com/posting-api/job-board/${c.slug}`;
  const res = await safeFetch(url);
  if (!res) return { jobs: [], rawCount: 0, error: "Network/Timeout", durationMs: Date.now() - t0 };
  if (!res.ok)
    return { jobs: [], rawCount: 0, error: `HTTP ${res.status}`, durationMs: Date.now() - t0 };
  try {
    const data = (await res.json()) as any;
    const jobs = data.jobs || data.jobPostings || [];
    const rawCount = jobs.length;
    const processed = processJobs(
      jobs.map((r: any) => ({
        id: `${mode}_ashby_${c.slug}_${r.id}`,
        title: r.title,
        location: r.locationName ?? c.city ?? c.country,
        url: r.jobUrl,
        postedAt: r.publishedAt,
        description: stripHtml(r.descriptionHtml || ""),
      })),
      c,
      mode,
      visaSponsorship,
    );
    return { jobs: processed, rawCount, durationMs: Date.now() - t0 };
  } catch (e) {
    return { jobs: [], rawCount: 0, error: `Parse Error: ${e}`, durationMs: Date.now() - t0 };
  }
}

// ── Workable ───────────────────────────────────────────────────────────────
const workableQueues = new Map<JobMode, Promise<unknown>>();

function queueWorkable<T>(fn: () => Promise<T>, mode: JobMode): Promise<T> {
  const delays = [1500, 2000, 3000];
  const randomDelay = delays[Math.floor(Math.random() * delays.length)];

  if (!workableQueues.has(mode)) {
    workableQueues.set(mode, Promise.resolve());
  }

  const currentQueue = workableQueues.get(mode)!;
  const result = currentQueue.then(() => new Promise((r) => setTimeout(r, randomDelay))).then(fn);
  workableQueues.set(
    mode,
    result.catch(() => {}),
  );
  return result;
}

async function pLimit<T>(fns: (() => Promise<T>)[], concurrency = 10): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < fns.length; i += concurrency) {
    const batch = await Promise.allSettled(fns.slice(i, i + concurrency).map((f) => f()));
    for (const r of batch) results.push(r.status === "fulfilled" ? r.value : (null as T));
    if (i + concurrency < fns.length) await new Promise((r) => setTimeout(r, 500));
  }
  return results;
}

export async function fetchWorkable(
  c: ATSConfig,
  mode: JobMode,
  visaSponsorship: boolean,
): Promise<FetcherResult> {
  const t0 = Date.now();
  if (isWorkableBlocked(c.slug))
    return { jobs: [], rawCount: 0, error: "Blocked (Cooldown)", durationMs: Date.now() - t0 };
  const cooldownUntil = getWorkableCooldownUntil(c.slug);
  if (cooldownUntil && cooldownUntil.getTime() > Date.now())
    return { jobs: [], rawCount: 0, error: "Workable Cooldown", durationMs: Date.now() - t0 };

  const budget = workableBudget;
  const limit = budget[mode as JobMode];
  const used = workableUsedByMode[mode];
  if (limit <= 0 || used >= limit)
    return { jobs: [], rawCount: 0, error: "Budget Exceeded", durationMs: Date.now() - t0 };
  workableUsedByMode[mode] += 1;

  const listUrl = `https://apply.workable.com/api/v1/widget/accounts/${c.slug}?details=true`;
  const doFetch = () => {
    return fetch(listUrl, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      signal: AbortSignal.timeout(30_000),
    })
      .then((r) => {
        if (r.status === 429) workable429SlugsThisRun.add(c.slug);
        return r;
      })
      .catch(() => null);
  };

  let res = await queueWorkable(doFetch, mode);
  if (!res) return { jobs: [], rawCount: 0, error: "Network/Timeout", durationMs: Date.now() - t0 };
  if (!res.ok)
    return { jobs: [], rawCount: 0, error: `HTTP ${res.status}`, durationMs: Date.now() - t0 };
  try {
    const data = (await res.json()) as any;
    const rawJobs = data.jobs || [];
    const rawCount = rawJobs.length;
    const jobs = rawJobs.filter(
      (r: any) => !isClearlyNonFrontend(r.title) && !isTooSeniorOrTooJunior(r.title),
    );
    const withDesc = await pLimit(
      jobs.map((r: any) => async () => {
        const detailUrl = `https://apply.workable.com/api/v1/widget/accounts/${c.slug}/jobs/${r.shortcode}`;
        const dr = await fetch(detailUrl, { headers: { "User-Agent": "Mozilla/5.0" } }).catch(
          () => null,
        );
        let desc = stripHtml(r.description || "");
        if (dr && dr.ok) {
          try {
            const detail = (await dr.json()) as any;
            desc = stripHtml(detail.full_description || detail.description || desc);
          } catch {}
        }
        return {
          id: `${mode}_workable_${c.slug}_${r.shortcode}`,
          title: r.title,
          location: r.city ?? c.city ?? c.country,
          url: r.url,
          postedAt: r.published_on,
          description: desc,
        };
      }),
      5,
    );
    const processed = processJobs(withDesc.filter(Boolean) as any[], c, mode, visaSponsorship);
    return { jobs: processed, rawCount, durationMs: Date.now() - t0 };
  } catch (e) {
    return { jobs: [], rawCount: 0, error: `Parse Error: ${e}`, durationMs: Date.now() - t0 };
  }
}

// ── Teamtailor ─────────────────────────────────────────────────────────────
export async function fetchTeamtailor(
  c: ATSConfig,
  mode: JobMode,
  visaSponsorship: boolean,
): Promise<FetcherResult> {
  const t0 = Date.now();
  const publicUrl = `https://${c.slug}.teamtailor.com/jobs.json`;
  const res = await fetch(publicUrl, {
    headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  }).catch(() => null);
  if (!res) return { jobs: [], rawCount: 0, error: "Network/Timeout", durationMs: Date.now() - t0 };
  if (!res.ok)
    return { jobs: [], rawCount: 0, error: `HTTP ${res.status}`, durationMs: Date.now() - t0 };
  try {
    const { data } = (await res.json()) as any;
    const rawCount = data.length;
    const processed = processJobs(
      data.map((r: any) => ({
        id: `${mode}_tt_${c.slug}_${r.id}`,
        title: r.attributes.title,
        location: r.attributes["location-name"] ?? c.city ?? c.country,
        url: r.attributes["external-url"] || `https://${c.slug}.teamtailor.com/jobs/${r.id}`,
        postedAt: r.attributes["published-at"],
        description: stripHtml(r.attributes["body-html"] || ""),
      })),
      c,
      mode,
      visaSponsorship,
    );
    return { jobs: processed, rawCount, durationMs: Date.now() - t0 };
  } catch (e) {
    return { jobs: [], rawCount: 0, error: `Parse Error: ${e}`, durationMs: Date.now() - t0 };
  }
}

// ── Breezy HR ──────────────────────────────────────────────────────────────
export async function fetchBreezy(
  c: ATSConfig,
  mode: JobMode,
  visaSponsorship: boolean,
): Promise<FetcherResult> {
  const t0 = Date.now();
  const url = `https://${c.slug}.breezy.hr/json`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  }).catch(() => null);
  if (!res) return { jobs: [], rawCount: 0, error: "Network/Timeout", durationMs: Date.now() - t0 };
  if (!res.ok)
    return { jobs: [], rawCount: 0, error: `HTTP ${res.status}`, durationMs: Date.now() - t0 };
  try {
    const jobs = (await res.json()) as any[];
    const rawCount = jobs.length;
    const processed = processJobs(
      jobs.map((r: any) => ({
        id: `${mode}_breezy_${c.slug}_${r.id}`,
        title: r.name,
        location: r.location?.name ?? c.city ?? c.country,
        url: r.url,
        postedAt: r.updated_at,
        description: stripHtml(r.description || ""),
      })),
      c,
      mode,
      visaSponsorship,
    );
    return { jobs: processed, rawCount, durationMs: Date.now() - t0 };
  } catch (e) {
    return { jobs: [], rawCount: 0, error: `Parse Error: ${e}`, durationMs: Date.now() - t0 };
  }
}

// ── SmartRecruiters ───────────────────────────────────────────────────────
export async function fetchSmartRecruiters(
  c: ATSConfig,
  mode: JobMode,
  visaSponsorship: boolean,
): Promise<FetcherResult> {
  const t0 = Date.now();
  const url = `https://api.smartrecruiters.com/v1/companies/${c.slug}/postings`;
  const res = await safeFetch(url);
  if (!res) return { jobs: [], rawCount: 0, error: "Network/Timeout", durationMs: Date.now() - t0 };
  if (!res.ok)
    return { jobs: [], rawCount: 0, error: `HTTP ${res.status}`, durationMs: Date.now() - t0 };
  try {
    const { content } = (await res.json()) as any;
    const rawCount = content.length;
    const detailedJobs = await Promise.all(
      content.map(async (r: any) => {
        const detailRes = await safeFetch(r.ref);
        if (!detailRes || !detailRes.ok) return null;
        try {
          const detail = (await detailRes.json()) as any;
          return {
            id: `${mode}_sr_${c.slug}_${r.id}`,
            title: r.name,
            location: r.location.fullLocation ?? c.city ?? c.country,
            url: `https://jobs.smartrecruiters.com/${c.slug}/${r.id}`,
            postedAt: r.releasedDate,
            description: stripHtml(detail.jobAd?.sections?.jobDescription?.content || ""),
          };
        } catch {
          return null;
        }
      }),
    );
    const processed = processJobs(detailedJobs.filter(Boolean) as any[], c, mode, visaSponsorship);
    return { jobs: processed, rawCount, durationMs: Date.now() - t0 };
  } catch (e) {
    return { jobs: [], rawCount: 0, error: `Parse Error: ${e}`, durationMs: Date.now() - t0 };
  }
}

// ── BambooHR ───────────────────────────────────────────────────────────────
export async function fetchBambooHR(
  c: ATSConfig,
  mode: JobMode,
  visaSponsorship: boolean,
): Promise<FetcherResult> {
  const t0 = Date.now();
  const url = `https://${c.slug}.bamboohr.com/careers/list`;
  const res = await safeFetch(url);
  if (!res) return { jobs: [], rawCount: 0, error: "Network/Timeout", durationMs: Date.now() - t0 };
  if (!res.ok)
    return { jobs: [], rawCount: 0, error: `HTTP ${res.status}`, durationMs: Date.now() - t0 };
  try {
    const data = (await res.json()) as any;
    const jobs = data.result ?? [];
    const rawCount = jobs.length;
    const processed = processJobs(
      jobs.map((r: any) => ({
        id: `${mode}_bamboohr_${c.slug}_${r.id}`,
        title: r.jobOpeningName,
        location: r.city ? `${r.city}, ${r.country}` : (c.city ?? c.country),
        url: `https://${c.slug}.bamboohr.com/careers/${r.id}`,
        postedAt: r.datePosted,
        description: "",
      })),
      c,
      mode,
      visaSponsorship,
    );
    return { jobs: processed, rawCount, durationMs: Date.now() - t0 };
  } catch (e) {
    return { jobs: [], rawCount: 0, error: `Parse Error: ${e}`, durationMs: Date.now() - t0 };
  }
}

// ── JazzHR ──────────────────────────────────────────────────────────────────
export async function fetchJazzHR(
  c: ATSConfig,
  mode: JobMode,
  visaSponsorship: boolean,
): Promise<FetcherResult> {
  const t0 = Date.now();
  const url = `https://api.resumator.com/v1/jobs/board/public/account/${c.slug}`;
  const res = await safeFetch(url, 60_000); // Increased timeout to 60s
  if (!res) return { jobs: [], rawCount: 0, error: "Network/Timeout", durationMs: Date.now() - t0 };
  if (!res.ok)
    return { jobs: [], rawCount: 0, error: `HTTP ${res.status}`, durationMs: Date.now() - t0 };
  try {
    const jobs = (await res.json()) as any[];
    const rawCount = jobs.length;
    const processed = processJobs(
      jobs.map((r: any) => ({
        id: `${mode}_jazz_${c.slug}_${r.id}`,
        title: r.title,
        location: r.location || c.city || c.country,
        url: r.apply_url,
        postedAt: new Date(r.posted).toISOString(),
        description: stripHtml(r.description || ""),
      })),
      c,
      mode,
      visaSponsorship,
    );
    return { jobs: processed, rawCount, durationMs: Date.now() - t0 };
  } catch (e) {
    return { jobs: [], rawCount: 0, error: `Parse Error: ${e}`, durationMs: Date.now() - t0 };
  }
}

// ── Wuzzuf ──────────────────────────────────────────────────────────────────
export async function fetchWuzzuf(mode: JobMode): Promise<FetcherResult> {
  const t0 = Date.now();
  const searchUrl = "https://wuzzuf.net/api/search/job";
  const queries = ["react", "next.js"];
  const allWuzzufJobs: Job[] = [];
  const seenIds = new Set<string>();
  const now = new Date().toISOString();
  let rawCount = 0;
  try {
    const queryResults = await Promise.all(
      queries.map(async (q) => {
        const searchPayload = {
          startIndex: 0,
          pageSize: 20,
          longitude: "31.2357",
          latitude: "30.0444",
          query: q,
          searchFilters: {
            post_date: ["within_1_week"],
            years_of_experience_min: ["3"],
            years_of_experience_max: ["6"],
          },
        };
        const sRes = await fetch(searchUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" },
          body: JSON.stringify(searchPayload),
        });
        if (!sRes.ok) return [];
        const sData = (await sRes.json()) as any;
        const ids = (sData?.data || [])
          .map((j: any) => j.id)
          .filter((id: string) => !seenIds.has(id));
        if (ids.length === 0) return [];

        // Add to seenIds immediately to avoid duplicate detail fetches in other query branches
        ids.forEach((id: string) => seenIds.add(id));
        rawCount += ids.length;

        const detailUrl = `https://wuzzuf.net/api/job?filter[other][ids]=${ids.join(",")}`;
        const dRes = await fetch(detailUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
        if (!dRes.ok) return [];
        const dData = (await dRes.json()) as any;
        return dData?.data || [];
      }),
    );

    const jobs = queryResults.flat();
    seenIds.clear(); // Reset for the actual title/dedupe check

    for (const entry of jobs) {
      const attr = entry.attributes || {};
      const title = (attr.title || "").trim();
      if (seenIds.has(entry.id) || !/react|next|native/i.test(title)) continue;
      seenIds.add(entry.id);
      const companyName =
        attr.company_name ||
        attr.computedFields?.find((f: any) => f.name === "company_name")?.value?.[0] ||
        "Wuzzuf Job";
      allWuzzufJobs.push({
        id: `local_wuzzuf_${entry.id}`,
        source: "local",
        mode,
        title,
        company: companyName,
        location: attr.location?.city?.name || "MENA",
        country: attr.location?.country?.name || "MENA",
        countryFlag: "🌍",
        url: `https://wuzzuf.net/jobs/p/${attr.slug || entry.id}`,
        description: stripHtml(attr.description || "").slice(0, 3000),
        isRemote: /remote/i.test(attr.workplaceArrangement || "") || /remote/i.test(title),
        postedAt: attr.postedAt,
        dateUnknown: false,
        visaSponsorship: false,
        ...scoreJob({
          title,
          description: attr.description,
          location: "MENA",
          postedAt: attr.postedAt,
        }),
        fetchedAt: now,
      });
    }
    return { jobs: allWuzzufJobs, rawCount, durationMs: Date.now() - t0 };
  } catch (e) {
    return { jobs: [], rawCount: 0, error: `Error: ${e}`, durationMs: Date.now() - t0 };
  }
}

// ── RemoteOK ────────────────────────────────────────────────────────────────
export async function fetchRemoteOK(mode: JobMode): Promise<FetcherResult> {
  const t0 = Date.now();
  const url = "https://remoteok.com/api";
  const res = await safeFetch(url);
  if (!res) return { jobs: [], rawCount: 0, error: "Network/Timeout", durationMs: Date.now() - t0 };
  if (!res.ok)
    return { jobs: [], rawCount: 0, error: `HTTP ${res.status}`, durationMs: Date.now() - t0 };
  try {
    const data = (await res.json()) as any[];
    const rawJobs = data.filter((item) => item.id && item.position);
    const rawCount = rawJobs.length;
    const out: Job[] = [];
    for (const r of rawJobs) {
      const title = r.position || "";
      const description = stripHtml(r.description || "");
      const scored = scoreJob({ title, description, location: "Remote", postedAt: r.date });
      if (scored.skillMatchScore === 0) continue;
      out.push({
        id: `global_remoteok_${r.id}`,
        source: "company",
        mode,
        title,
        company: r.company || "RemoteOK",
        location: "Remote 🌐",
        country: "Global",
        countryFlag: "🌍",
        url: r.url,
        description: description.slice(0, 500),
        isRemote: true,
        postedAt: r.date,
        dateUnknown: false,
        visaSponsorship: false,
        ...scored,
        fetchedAt: new Date().toISOString(),
      });
    }
    return { jobs: out, rawCount, durationMs: Date.now() - t0 };
  } catch (e) {
    return { jobs: [], rawCount: 0, error: `Parse Error: ${e}`, durationMs: Date.now() - t0 };
  }
}

// ── Custom Local Egyptian Company Fetchers ──────────────────────────────────

export async function fetchGizaSystems(mode: JobMode): Promise<FetcherResult> {
  const t0 = Date.now();
  const company: BaseCompany = {
    name: "Giza Systems",
    country: "Egypt",
    countryFlag: "🇪🇬",
    city: "Cairo",
  };
  const url =
    "https://www.gizasystemscareers.com/app/control/byt_job_search_manager?action=1&token=9IAKQR&query=trigger%3Ddate_indexed%26job_city%3Deg%2C2%2C0%26page%3D1%26jb_role%3D5%2C21%26date_indexed%3D8&body=job-search-results&lan=en";
  const res = await safeFetch(url);
  if (!res) return { jobs: [], rawCount: 0, error: "Network/Timeout", durationMs: Date.now() - t0 };
  try {
    const html = await res.text();
    const jobs: RawJob[] = [];
    const cards = html.split(/class="[^"]*job[^"]*"/i);
    for (const card of cards) {
      const linkMatch = /<a[^>]+href="([^"]+byt_job_details[^"]+)"[^>]*>([^<]{3,80})<\/a>/i.exec(
        card,
      );
      if (!linkMatch) continue;
      const dateMatch = /(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}-\d{2}-\d{2})/.exec(card);
      const postedAt = dateMatch ? new Date(dateMatch[1]).toISOString() : new Date().toISOString();
      jobs.push({
        id: `local_gizasystems_${Buffer.from(linkMatch[1]).toString("base64").slice(0, 16)}`,
        title: linkMatch[2].trim(),
        location: "Cairo",
        url: linkMatch[1].startsWith("http")
          ? linkMatch[1]
          : `https://www.gizasystemscareers.com${linkMatch[1]}`,
        postedAt,
        description: "",
      });
    }
    const rawCount = jobs.length;
    return { jobs: processJobs(jobs, company, mode, false), rawCount, durationMs: Date.now() - t0 };
  } catch (e) {
    return { jobs: [], rawCount: 0, error: `Error: ${e}`, durationMs: Date.now() - t0 };
  }
}

export async function fetchBrightSkies(mode: JobMode): Promise<FetcherResult> {
  const t0 = Date.now();
  const company: BaseCompany = {
    name: "Bright Skies",
    country: "Egypt",
    countryFlag: "🇪🇬",
    city: "Cairo",
  };
  try {
    const res = await fetch("https://brightskiesinc.com/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        operationName: "getJobs",
        variables: { pageSize: 50, page: 1, title: "" },
        query: `query getJobs($pageSize: Int!, $page: Int!, $title: String, $department: String, $location: String) { jobs(filters: {title: {contains: $title}, department: {contains: $department}, location: {contains: $location}}, pagination: {pageSize: $pageSize, page: $page}) { data { id attributes { title location job_type department } } } }`,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok)
      return { jobs: [], rawCount: 0, error: `HTTP ${res.status}`, durationMs: Date.now() - t0 };
    const data = (await res.json()) as any;
    const rawJobs = data.data?.jobs?.data || [];
    const rawCount = rawJobs.length;
    const processed = processJobs(
      rawJobs.map((item: any) => ({
        id: `local_brightskies_${item.id}`,
        title: item.attributes.title,
        location: item.attributes.location || "Cairo",
        url: `https://brightskiesinc.com/careers/jobs/${item.id}`,
        postedAt: new Date().toISOString(),
        description: item.attributes.department || "",
      })),
      company,
      mode,
      false,
    );
    return { jobs: processed, rawCount, durationMs: Date.now() - t0 };
  } catch (e) {
    return { jobs: [], rawCount: 0, error: `Error: ${e}`, durationMs: Date.now() - t0 };
  }
}

export async function fetchPharos(mode: JobMode): Promise<FetcherResult> {
  const t0 = Date.now();
  const company: BaseCompany = {
    name: "Pharos Solutions",
    country: "Egypt",
    countryFlag: "🇪🇬",
    city: "Cairo",
  };
  try {
    const res = await fetch("https://pharos-solutions.de/wp-admin/admin-ajax.php", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "awsm_job_spec%5Bjob-category%5D=36&awsm_job_spec%5Bjob-type%5D=32&awsm_job_spec%5Bjob-location%5D=&action=jobfilter&listings_per_page=30",
      signal: AbortSignal.timeout(60_000), // Increased timeout to 60s
    });
    if (!res.ok)
      return { jobs: [], rawCount: 0, error: `HTTP ${res.status}`, durationMs: Date.now() - t0 };
    const html = await res.text();
    const jobs: RawJob[] = [];
    const cards = html.split(/<article|<li[^>]*class="[^"]*job/i);
    for (const card of cards) {
      const linkM =
        /<a[^>]+href="(https?:\/\/pharos-solutions\.de\/(?:job|jobs)[^"]*)"[^>]*>([^<]{3,100})/i.exec(
          card,
        );
      if (!linkM) continue;
      const dateM = /<time[^>]+datetime="([^"]+)"/i.exec(card);
      jobs.push({
        id: `local_pharos_${Buffer.from(linkM[1]).toString("base64").slice(0, 16)}`,
        title: linkM[2].replace(/<[^>]+>/g, "").trim(),
        location: "Cairo",
        url: linkM[1],
        postedAt: dateM ? dateM[1] : new Date().toISOString(),
        description: "",
      });
    }
    const rawCount = jobs.length;
    return { jobs: processJobs(jobs, company, mode, false), rawCount, durationMs: Date.now() - t0 };
  } catch (e) {
    return { jobs: [], rawCount: 0, error: `Error: ${e}`, durationMs: Date.now() - t0 };
  }
}
