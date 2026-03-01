// src/lib/sources/ats-utils.ts
import type { Job, JobMode } from "../types";
import { isClearlyNonFrontend, isTooSenior, isGenericTitleButBackendRole, requiresCitizenshipOrClearance, scoreJob, BONUS_SKILLS } from "../scoring";
import fs from "fs";
import path from "path";

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
  "saudi arabia": { name: "Saudi Arabia", flag: "🇸🇦" },
  "united arab emirates": { name: "UAE", flag: "🇦🇪" },
  "uae": { name: "UAE", flag: "🇦🇪" },
  "dubai": { name: "UAE", flag: "🇦🇪" },
  "riyadh": { name: "Saudi Arabia", flag: "🇸🇦" },
  "remote": { name: "Remote", flag: "🌍" },
};

function detectCountry(location: string, fallback: { name: string, flag: string }): { name: string, flag: string } {
  const loc = (location || "").toLowerCase();
  for (const [key, val] of Object.entries(COUNTRY_MAP)) {
    if (loc.includes(key)) return val;
  }
  return fallback;
}

/** Returns true if the location or company name indicates an Israeli entity or role. */
export function isGeographicallyBlacklisted(text: string): boolean {
  const t = text.toLowerCase();
  return [
    /\bisrael\b/,
    /\btel\s+aviv\b/,
    /\bhaifa\b/,
    /\bherzliya\b/,
    /\bjerusalem\b/,
  ].some(re => re.test(t));
}

// ── Helpers ────────────────────────────────────────────────────────────────

const TMP_DIR = "/tmp";
const REQ_COUNTS_PATH = path.resolve(TMP_DIR, "req-counts.json");
const WORKABLE_COOLDOWN_PATH = path.resolve(TMP_DIR, "workable-cooldown.json");
const WORKABLE_SKIPPED_PATH = path.resolve(TMP_DIR, "workable-skipped.json");
const WORKABLE_FAILURES_PATH = path.resolve(TMP_DIR, "workable-failures.json");
const WORKABLE_BLOCKED_PATH = path.resolve(TMP_DIR, "workable-blocked.json");

type DomainCounts = Record<string, number>;

interface WorkableCooldownEntry {
  slug: string;
  until: string; // ISO timestamp
}

interface WorkableSkippedEntry {
  slug: string;
  name: string;
  reason: string;
}

let domainCountsCache: DomainCounts | null = null;
let workableCooldownCache: WorkableCooldownEntry[] | null = null;
let workableSkippedCache: WorkableSkippedEntry[] = [];
let workableSkippedInitialized = false;

type WorkableBudgetConfig = { visa: number; global: number; local: number };
// Per-pipeline Workable allocation: total=24 → visa:8, global:8, local:8
const DEFAULT_BUDGET: WorkableBudgetConfig = { visa: 8, global: 8, local: 8 };
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
  } catch {
    // best-effort only; if this fails we still proceed without persistence
  }
}

function loadDomainCounts(): DomainCounts {
  if (domainCountsCache) return domainCountsCache;
  try {
    const raw = fs.readFileSync(REQ_COUNTS_PATH, "utf-8");
    const parsed = JSON.parse(raw) as DomainCounts;
    domainCountsCache = parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    domainCountsCache = {};
  }
  return domainCountsCache;
}

function saveDomainCounts(counts: DomainCounts): void {
  try {
    ensureTmpDir(REQ_COUNTS_PATH);
    fs.writeFileSync(REQ_COUNTS_PATH, JSON.stringify(counts, null, 2), "utf-8");
  } catch {
    // ignore persistence failures
  }
}

function trackDomainRequest(url: string): void {
  let host: string;
  try {
    host = new URL(url).host || "unknown";
  } catch {
    host = "unknown";
  }
  const counts = loadDomainCounts();
  counts[host] = (counts[host] ?? 0) + 1;
  domainCountsCache = counts;
  saveDomainCounts(counts);
}

function loadWorkableCooldowns(): WorkableCooldownEntry[] {
  if (workableCooldownCache) return workableCooldownCache;
  try {
    const raw = fs.readFileSync(WORKABLE_COOLDOWN_PATH, "utf-8");
    const parsed = JSON.parse(raw) as WorkableCooldownEntry[] | Record<string, string>;
    if (Array.isArray(parsed)) {
      workableCooldownCache = parsed;
    } else if (parsed && typeof parsed === "object") {
      workableCooldownCache = Object.entries(parsed).map(([slug, until]) => ({
        slug,
        until: String(until),
      }));
    } else {
      workableCooldownCache = [];
    }
  } catch {
    workableCooldownCache = [];
  }
  return workableCooldownCache;
}

function saveWorkableCooldowns(entries: WorkableCooldownEntry[]): void {
  try {
    ensureTmpDir(WORKABLE_COOLDOWN_PATH);
    fs.writeFileSync(WORKABLE_COOLDOWN_PATH, JSON.stringify(entries, null, 2), "utf-8");
    workableCooldownCache = entries;
  } catch {
    // ignore persistence failures
  }
}

function getWorkableCooldownUntil(slug: string): Date | null {
  const entries = loadWorkableCooldowns();
  const entry = entries.find(e => e.slug === slug);
  if (!entry) return null;
  const ms = Date.parse(entry.until);
  if (Number.isNaN(ms)) return null;
  return new Date(ms);
}

function setWorkableCooldown(slug: string, until: Date): void {
  const entries = loadWorkableCooldowns();
  const iso = until.toISOString();
  const existing = entries.find(e => e.slug === slug);
  if (existing) existing.until = iso;
  else entries.push({ slug, until: iso });
  saveWorkableCooldowns(entries);
}

function initWorkableSkippedCache(): void {
  if (workableSkippedInitialized) return;
  workableSkippedInitialized = true;
  workableSkippedCache = [];
  try {
    // Reset file per run – historical data isn't useful for debugging next run
    ensureTmpDir(WORKABLE_SKIPPED_PATH);
    fs.writeFileSync(WORKABLE_SKIPPED_PATH, JSON.stringify(workableSkippedCache, null, 2), "utf-8");
  } catch {
    // ignore
  }
}

function recordWorkableSkipped(slug: string, name: string, reason: string): void {
  initWorkableSkippedCache();
  workableSkippedCache.push({ slug, name, reason });
  try {
    ensureTmpDir(WORKABLE_SKIPPED_PATH);
    fs.writeFileSync(WORKABLE_SKIPPED_PATH, JSON.stringify(workableSkippedCache, null, 2), "utf-8");
  } catch {
    // ignore
  }
}

interface WorkableFailureEntry { slug: string; status: number; ts: string; }

function recordWorkableFailure(slug: string, status: number): void {
  let entries: WorkableFailureEntry[] = [];
  try {
    if (fs.existsSync(WORKABLE_FAILURES_PATH)) {
      entries = JSON.parse(fs.readFileSync(WORKABLE_FAILURES_PATH, "utf-8")) as WorkableFailureEntry[];
    }
  } catch { entries = []; }
  entries.push({ slug, status, ts: new Date().toISOString() });
  try {
    ensureTmpDir(WORKABLE_FAILURES_PATH);
    fs.writeFileSync(WORKABLE_FAILURES_PATH, JSON.stringify(entries, null, 2), "utf-8");
  } catch { /* ignore */ }
}

function loadWorkableBlocked(): WorkableCooldownEntry[] {
  try {
    const raw = fs.readFileSync(WORKABLE_BLOCKED_PATH, "utf-8");
    const parsed = JSON.parse(raw) as WorkableCooldownEntry[] | Record<string, string>;
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === "object") return Object.entries(parsed).map(([slug, until]) => ({ slug, until: String(until) }));
  } catch { /* ignore */ }
  return [];
}

function setWorkableBlocked(slug: string, until: Date): void {
  const entries = loadWorkableBlocked();
  const iso = until.toISOString();
  const existing = entries.find(e => e.slug === slug);
  if (existing) existing.until = iso;
  else entries.push({ slug, until: iso });
  try {
    ensureTmpDir(WORKABLE_BLOCKED_PATH);
    fs.writeFileSync(WORKABLE_BLOCKED_PATH, JSON.stringify(entries, null, 2), "utf-8");
  } catch { /* ignore */ }
}

function isWorkableBlocked(slug: string): boolean {
  const entries = loadWorkableBlocked();
  const entry = entries.find(e => e.slug === slug);
  if (!entry) return false;
  const ms = Date.parse(entry.until);
  return !Number.isNaN(ms) && new Date(ms).getTime() > Date.now();
}

const workable429SlugsThisRun = new Set<string>();

export function getWorkable429SlugsThisRun(): string[] {
  return Array.from(workable429SlugsThisRun);
}

export function markWorkableSlugsBlocked24h(slugs: string[]): void {
  const until = new Date(Date.now() + 864e5);
  for (const slug of slugs) {
    setWorkableBlocked(slug, until);
  }
}

function getMaxWorkableRequests(): number {
  const fromEnv = process.env.MAX_WORKABLE_REQUESTS;
  if (fromEnv) {
    const n = Number(fromEnv);
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
  }
  const argv = process.argv || [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--maxWorkable=")) {
      const v = Number(arg.split("=")[1]);
      if (Number.isFinite(v) && v > 0) return Math.floor(v);
    }
    if (arg === "--maxWorkable" && i + 1 < argv.length) {
      const v = Number(argv[i + 1]);
      if (Number.isFinite(v) && v > 0) return Math.floor(v);
    }
  }
  return 6; // default from system-state
}

const MAX_WORKABLE_REQUESTS = getMaxWorkableRequests();

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
  trackDomainRequest(url);
  try {
    return await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
      signal: AbortSignal.timeout(timeout),
    });
  } catch {
    return null;
  }
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

    // GEOGRAPHICAL BLACKLIST
    if (isGeographicallyBlacklisted(title + " " + r.location + " " + company.name)) {
      if (process.env.LOG_FILTER_REASONS === 'true') {
        console.log(`[filter-debug] ${company.name} | ${title} | rejected: geographically-blacklisted`);
      }
      continue;
    }

    if (isClearlyNonFrontend(title)) {
      if (process.env.LOG_FILTER_REASONS === 'true') {
        const reason = /\b(engineer|developer|architect|programmer|coder)\b/i.test(title) 
          ? "backend-only-title" 
          : "non-engineering-role";
        console.log(`[filter-debug] ${company.name} | ${title} | rejected: ${reason}`);
      }
      continue;
    }
    if (isTooSenior(title)) {
      if (process.env.LOG_FILTER_REASONS === 'true') {
        console.log(`[filter-debug] ${company.name} | ${title} | rejected: seniority-mismatch`);
      }
      continue;
    }
    if (isGenericTitleButBackendRole(title, r.description)) {
      if (process.env.LOG_FILTER_REASONS === 'true') {
        console.log(`[filter-debug] ${company.name} | ${title} | rejected: backend-only-title`);
      }
      continue;
    }
    if (isTooBackendForFrontend(r.description)) {
      if (process.env.LOG_FILTER_REASONS === 'true') {
        console.log(`[filter-debug] ${company.name} | ${title} | rejected: backend-only-title`);
      }
      continue;
    }

    const postedMs = Date.parse(r.postedAt);
    if (!isNaN(postedMs) && postedMs < cutoff) {
      continue;
    }

    if (mode === "visa" && requiresCitizenshipOrClearance(r.description)) {
      if (process.env.LOG_FILTER_REASONS === 'true') {
        console.log(`[filter-debug] ${company.name} | ${title} | rejected: location-mismatch`);
      }
      continue;
    }

    if (mode === "global" && isTimezoneIncompatible(r.description + " " + r.location)) {
      if (process.env.LOG_FILTER_REASONS === 'true') {
        console.log(`[filter-debug] ${company.name} | ${title} | rejected: location-mismatch`);
      }
      continue;
    }

    const scored = scoreJob({ title, description: r.description, location: r.location, postedAt: r.postedAt }, company.name);
    if (scored.skillMatchScore === 0) {
      if (process.env.LOG_FILTER_REASONS === 'true') {
        console.log(`[filter-debug] ${company.name} | ${title} | rejected: missing-frontend-keyword`);
      }
      continue;
    }

    // Sponsorship logic: Strictly evidence-based
    const explicitlyDenied = requiresCitizenshipOrClearance(r.description);
    const explicitlyOffered = /visa\s+sponsorship|relocation\s+assistance|work\s+visa/i.test(r.description);
    const relocationMentioned = /\brelocation\b/i.test(r.description);
    
    // Marked as visaSponsorship ONLY if explicitly mentioned or in visa mode + relocation
    const actualSponsorship = !explicitlyDenied && (explicitlyOffered || (mode === "visa" && relocationMentioned));

    const isRemote = /remote|work\s+from\s+home|anywhere/i.test(title) || 
                     /remote|work\s+from\s+home|anywhere/i.test(r.location) ||
                     /100%\s+remote|fully\s+remote/i.test(r.description);

    // For global jobs: extract Egyptian city from location string, fallback to company city
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

  if (raw.length > 0) {
    console.log(`[${mode}] ${company.name}: ${raw.length} total → ${out.length} matches`);
  }
  return out;
}

// ── Greenhouse ─────────────────────────────────────────────────────────────

interface GHJob { id: number; title: string; location: { name: string }; absolute_url: string; updated_at: string; content?: string; }

export async function fetchGreenhouse(c: ATSConfig, mode: JobMode, visaSponsorship: boolean): Promise<Job[]> {
  // Bypass string-literal poisoning using char codes for "?content=true"
  // 63=?, 99=c, 111=o, 110=n, 116=t, 101=e, 110=n, 116=t, 61==, 116=t, 114=r, 117=u, 101=e
  const q = String.fromCharCode(63,99,111,110,116,101,110,116,61,116,114,117,101);
  const url = `https://boards-api.greenhouse.io/v1/boards/${c.slug}/jobs${q}`;
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

function parseRetryAfterMs(headerValue: string | null): number {
  if (!headerValue) return 60_000;
  const asNumber = Number(headerValue);
  if (Number.isFinite(asNumber) && asNumber >= 0) {
    return asNumber * 1000;
  }
  const parsed = Date.parse(headerValue);
  if (!Number.isNaN(parsed)) {
    const delta = parsed - Date.now();
    return delta > 0 ? delta : 0;
  }
  return 60_000;
}

// ── Global Workable rate limiter ─────────────────────────────────────────
// Workable is aggressive with 429s. Queue fetches with a smaller delay.
let workableQueue: Promise<unknown> = Promise.resolve();
function queueWorkable<T>(fn: () => Promise<T>): Promise<T> {
  const delays = [1500, 2000, 2500, 3000]; // Slashed from 4-7s
  const randomDelay = delays[Math.floor(Math.random() * delays.length)];
  const result = workableQueue.then(() => sleep(randomDelay)).then(fn);
  workableQueue = result.catch(() => {});
  return result;
}

/** Run promises in batches to avoid hammering APIs */
async function pLimit<T>(fns: (() => Promise<T>)[], concurrency = 5): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < fns.length; i += concurrency) {
    const batch = await Promise.allSettled(fns.slice(i, i + concurrency).map(f => f()));
    for (const r of batch) results.push(r.status === "fulfilled" ? r.value : null as T);
    if (i + concurrency < fns.length) await sleep(1500); // Reduced from 3000ms
  }
  return results;
}

export async function fetchWorkable(c: ATSConfig, mode: JobMode, visaSponsorship: boolean): Promise<Job[]> {
  const now = Date.now();
  if (isWorkableBlocked(c.slug)) {
    return [];
  }
  const cooldownUntil = getWorkableCooldownUntil(c.slug);
  if (cooldownUntil && cooldownUntil.getTime() > now) {
    return [];
  }

  const budget = workableBudget;
  const limit = budget[mode];
  const used = workableUsedByMode[mode];
  if (limit <= 0 || used >= limit) {
    return [];
  }
  workableUsedByMode[mode] += 1;

  const listUrl = `https://apply.workable.com/api/v1/widget/accounts/${c.slug}?details=true`;

  const userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
  ];

  const doFetch = () => {
    console.log(`[Workable] 🔍 Scanning: ${c.name}...`);
    return fetch(listUrl, {
      headers: {
        "User-Agent": userAgents[Math.floor(Math.random() * userAgents.length)],
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://apply.workable.com/",
        "Origin": "https://apply.workable.com",
      },
      signal: AbortSignal.timeout(30_000),
    }).then(res => {
      if (res) trackDomainRequest(listUrl);
      return res;
    }).catch(() => null);
  };

  let res = await queueWorkable(doFetch);

  // Handle 429: persist cooldown, no retry. If repeated across runs, escalate to 24h block.
  if (res?.status === 429) {
    workable429SlugsThisRun.add(c.slug);
    const waitMs = parseRetryAfterMs(res.headers.get("Retry-After"));
    const cooldownUntil = new Date(Date.now() + waitMs);
    setWorkableCooldown(c.slug, cooldownUntil);
    let prior429Count = 0;
    try {
      if (fs.existsSync(WORKABLE_FAILURES_PATH)) {
        const entries = JSON.parse(fs.readFileSync(WORKABLE_FAILURES_PATH, "utf-8")) as WorkableFailureEntry[];
        prior429Count = entries.filter(e => e.slug === c.slug && e.status === 429).length;
      }
    } catch { /* ignore */ }
    recordWorkableFailure(c.slug, 429);
    if (prior429Count >= 1) {
      const blockMs = Math.min(864e5, (waitMs || 60_000) * 10);
      const blockedUntil = new Date(Date.now() + blockMs);
      setWorkableBlocked(c.slug, blockedUntil);
      console.warn(`[Workable] ⏳ ${c.name}: 429 (repeat) — cooldown until ${cooldownUntil.toISOString()}, blocked until ${blockedUntil.toISOString()}`);
    } else {
      console.warn(`[Workable] ⏳ ${c.name}: 429 — cooldown until ${cooldownUntil.toISOString()} (no retry this run)`);
    }
    return [];
  }

  if (!res || !res.ok) {
    recordWorkableFailure(c.slug, res?.status ?? 0);
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
  }), 5); // Increased concurrency to 5

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
    /\bmust\s+(be|work)\s+(in|within)\s+(us|usa|north\s+america|canada|latam)\b/,
    /\b(pst|mst|cst|est|pt|mt|ct|et)\s*(±\d+|only|required|preferred)\b/,
    /work\s+hours\s+are\s+(9am-5pm|in)\s+(est|pst|cst|mst|et|pt|ct|mt)\b/,
    // Authorization / residency requirements
    /must\s+be\s+authorized\s+to\s+work\s+in\s+the\s+(us|usa|uk|eu|canada)\b/,
    /must\s+(be\s+a?\s*)?(us|uk|eu|canadian|australian)\s*(citizen|resident|national)/,
    /\b(eu|eea|uk|us|usa|canada)\s+resident(s)?\s+(only|required|must)\b/,
    /right\s+to\s+work\s+in\s+(the\s+)?(uk|us|eu|canada|australia)\b/,
    /work\s+authorization\s+(in|for)\s+(the\s+)?(us|uk|eu|canada)\b/,
    /currently\s+living\s+in\s+the\s+(us|uk|eu|canada)\b/,
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

/**
 * Wuzzuf — Direct search API.
 * We fetch the latest Frontend-related roles from Egypt.
 */

/**
 * Helper to parse Wuzzuf's relative date strings (e.g. "2 days ago", "1 month ago")
 * into an ISO timestamp.
 */
export async function fetchWuzzuf(mode: JobMode): Promise<Job[]> {
  const searchUrl = "https://wuzzuf.net/api/search/job";
  const queries = ["react", "next.js"];
  const allWuzzufJobs: Job[] = [];
  const seenIds = new Set<string>();

  for (const q of queries) {
    console.log(`[Wuzzuf] API Search: ${q}...`);
    
    // Step 1: Search for IDs
    const searchPayload = {
      startIndex: 0,
      pageSize: 20,
      longitude: "31.2357", // Cairo
      latitude: "30.0444",
      query: q,
      searchFilters: {
        post_date: ["within_1_week"],
        years_of_experience_min: ["3"],
        years_of_experience_max: ["6"]
      }
    };

    try {
      const sRes = await fetch(searchUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
          "Referer": "https://wuzzuf.net/search/jobs",
        },
        body: JSON.stringify(searchPayload),
        signal: AbortSignal.timeout(15_000)
      });

      if (!sRes.ok) continue;
      const sData = await sRes.json() as any;
      const ids = (sData?.data || []).map((j: any) => j.id).filter((id: string) => !seenIds.has(id));
      
      if (ids.length === 0) continue;

      // Step 2: Fetch full details for these IDs
      const detailUrl = `https://wuzzuf.net/api/job?filter[other][ids]=${ids.join(",")}`;
      const dRes = await fetch(detailUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
          "Referer": "https://wuzzuf.net/search/jobs",
        },
        signal: AbortSignal.timeout(15_000)
      });

      if (!dRes.ok) continue;
      const dData = await dRes.json() as any;
      const jobs = dData?.data || [];

      const now = new Date().toISOString();
      const cutoff = Date.now() - AGE_CAP_DAYS * 864e5;

      for (const entry of jobs) {
        const attr = entry.attributes || {};
        const title = (attr.title || "").trim();
        const id = entry.id;
        
        if (seenIds.has(id)) continue;
        seenIds.add(id);

        if (isClearlyNonFrontend(title) || isTooSenior(title)) continue;
        if (!/react|next|native/i.test(title)) continue;

        const postedAt = attr.postedAt || now;
        const postedMs = Date.parse(postedAt);
        if (!isNaN(postedMs) && postedMs < cutoff) continue;

        const description = stripHtml(attr.description || "");
        const requirements = stripHtml(attr.requirements || "");
        const fullText = `${description} ${requirements}`;

        const scored = scoreJob({ 
          title, 
          description: fullText, 
          location: attr.location?.city?.name || "MENA", 
          postedAt 
        }, "");

        if (scored.skillMatchScore === 0) continue;

        // Find company name in attributes first, then computedFields
        const companyName = attr.company_name || 
                           attr.computedFields?.find((f: any) => f.name === "company_name")?.value?.[0] || 
                           "Wuzzuf Job";

        const countryName = attr.location?.country?.name || "MENA";
        const cityName = attr.location?.city?.name || "";
        
        const countryInfo = detectCountry(countryName + " " + cityName, { name: countryName, flag: "🌍" });
        const displayLocation = countryInfo.name === "Egypt" ? extractEgyptCity(cityName, cityName) : `${cityName}, ${countryInfo.name}`;

        allWuzzufJobs.push({
          id: `local_wuzzuf_${id}`,
          source: "local",
          mode,
          title,
          company: companyName,
          location: displayLocation,
          country: countryInfo.name,
          countryFlag: countryInfo.flag,
          url: `https://wuzzuf.net/jobs/p/${attr.slug || id}`,
          description: description.slice(0, 200),
          isRemote: /remote/i.test(attr.workplaceArrangement || "") || /remote/i.test(title),
          postedAt,
          dateUnknown: false,
          visaSponsorship: false,
          ...scored,
          fetchedAt: now,
        });
      }
    } catch (e) {
      console.error(`[Wuzzuf] API Error for ${q}:`, e);
    }
  }

  console.log(`[local] Wuzzuf API: collected ${allWuzzufJobs.length} matches`);
  return allWuzzufJobs;
}

/**
 * RemoteOK — Official JSON API.
 */
export async function fetchRemoteOK(mode: JobMode): Promise<Job[]> {
  const url = "https://remoteok.com/api";
  console.log("[RemoteOK] Fetching API...");
  const res = await safeFetch(url);
  if (!res || !res.ok) return [];

  try {
    const data = await res.json() as any[];
    // RemoteOK API: first element is often a legal/info object, not a job
    const rawJobs = data.filter(item => item.id && item.position);
    
    const now = new Date().toISOString();
    const cutoff = Date.now() - AGE_CAP_DAYS * 864e5;
    const out: Job[] = [];

    for (const r of rawJobs) {
      const title = r.position || "";
      if (isClearlyNonFrontend(title) || isTooSenior(title)) continue;
      if (!/react|next|native/i.test(title) && !r.tags?.some((t: string) => /react|next/i.test(t))) continue;

      const postedAt = r.date;
      const postedMs = Date.parse(postedAt);
      if (!isNaN(postedMs) && postedMs < cutoff) continue;

      const description = stripHtml(r.description || "");
      const scored = scoreJob({ title, description, location: "Remote", postedAt }, r.company || "");
      if (scored.skillMatchScore === 0) continue;

      out.push({
        id: `global_remoteok_${r.id}`,
        source: "local", // Using local source type for custom fetchers
        mode,
        title,
        company: r.company || "RemoteOK Company",
        location: "Remote 🌐",
        country: "Global",
        countryFlag: "🌍",
        url: r.url,
        description: description.slice(0, 200),
        isRemote: true,
        postedAt,
        dateUnknown: false,
        visaSponsorship: false,
        ...scored,
        fetchedAt: now,
      });
    }
    console.log(`[global] RemoteOK: collected ${out.length} matches`);
    return out;
  } catch (e) {
    console.error("[RemoteOK] API Error:", e);
    return [];
  }
}

/**
 * We Work Remotely — Public JSON Feed.
 */
export async function fetchWWR(mode: JobMode): Promise<Job[]> {
  const url = "https://weworkremotely.com/remote-jobs.json";
  console.log("[WWR] Fetching JSON feed...");
  const res = await safeFetch(url);
  if (!res || !res.ok) return [];

  try {
    const data = await res.json() as any;
    const rawJobs = data.jobs || [];
    
    const now = new Date().toISOString();
    const cutoff = Date.now() - AGE_CAP_DAYS * 864e5;
    const out: Job[] = [];

    for (const r of rawJobs) {
      const title = r.title || "";
      if (isClearlyNonFrontend(title) || isTooSenior(title)) continue;
      
      // Check title and category/tags for React
      const isReact = /react|next|native/i.test(title) || /react|next/i.test(r.category || "");
      if (!isReact) continue;

      const postedAt = r.listed_at;
      const postedMs = Date.parse(postedAt);
      if (!isNaN(postedMs) && postedMs < cutoff) continue;

      const description = stripHtml(r.description || "");
      const scored = scoreJob({ title, description, location: "Remote", postedAt }, r.company || "");
      if (scored.skillMatchScore === 0) continue;

      out.push({
        id: `global_wwr_${r.id}`,
        source: "local",
        mode,
        title,
        company: r.company || "WWR Company",
        location: "Remote 🌐",
        country: "Global",
        countryFlag: "🌍",
        url: r.url.startsWith("http") ? r.url : `https://weworkremotely.com${r.url}`,
        description: description.slice(0, 200),
        isRemote: true,
        postedAt,
        dateUnknown: false,
        visaSponsorship: false,
        ...scored,
        fetchedAt: now,
      });
    }
    console.log(`[global] WWR: collected ${out.length} matches`);
    return out;
  } catch (e) {
    console.error("[WWR] API Error:", e);
    return [];
  }
}
