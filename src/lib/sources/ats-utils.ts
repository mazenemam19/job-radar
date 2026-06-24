// src/lib/sources/ats-utils.ts
import type {
  Job,
  JobMode,
  BaseCompany,
  ATSConfig,
  RawJob,
  FetcherResult,
  GreenhouseJob,
  LeverJob,
  AshbyJob,
  WorkableJob,
  WorkableDetail,
  TeamtailorJob,
  BreezyJob,
  SRJob,
  SRDetail,
  BambooJob,
  BambooDetail,
  JazzJob,
  DomainCounts,
  WorkableCooldownEntry,
  WorkableBudgetConfig,
} from "@/types";
import { COUNTRY_MAP } from "../constants";
import type { Json } from "@/lib/database.types";
import fs from "fs";
import path from "path";

// ── Shared Helper Functions ──────────────────────────────────────────────────

/** Parses strings like '1 day ago', '2 hours ago', 'yesterday' into ISO strings. */
export function parseRelativeDate(text: string): string {
  if (!text) return new Date().toISOString();
  const t = text.toLowerCase().trim();
  const now = new Date();

  if (t === "yesterday") {
    return new Date(now.getTime() - 864e5).toISOString();
  }
  if (t === "just now" || t === "today") {
    return now.toISOString();
  }

  const match = t.match(/(\d+)\s+(minute|hour|day|week|month|year)s?\s+ago/);
  if (match) {
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const msMap: Record<string, number> = {
      minute: 60 * 1000,
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
      year: 365 * 24 * 60 * 60 * 1000,
    };
    return new Date(now.getTime() - value * msMap[unit]).toISOString();
  }

  // Fallback to native parse
  const parsed = Date.parse(text);
  return isNaN(parsed) ? now.toISOString() : new Date(parsed).toISOString();
}

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

// ── Helpers ────────────────────────────────────────────────────────────────

const TMP_DIR = "/tmp";
const REQ_COUNTS_PATH = path.resolve(TMP_DIR, "req-counts.json");

let workableBlockedCache: WorkableCooldownEntry[] = [];
let domainCountsCache: DomainCounts | null = null;

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

const DEFAULT_BUDGET: WorkableBudgetConfig = { visa: 999, global: 999, local: 999 };
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

// ── Workable rate-limit state (Supabase-backed) ─────────────────────────────
// This used to live in /tmp JSON files and a plain in-memory variable, which
// does not survive across serverless invocations (Vercel functions and
// GitHub Actions runs are both stateless per run) — meaning blocks and budget
// config silently reset to defaults on every single cron run. Persisting to
// app_config makes this actually work across runs.

export async function loadWorkableStateFromDB(): Promise<void> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const db = createAdminClient();
  const { data } = await db
    .from("app_config")
    .select("workable_blocked, workable_budget")
    .eq("id", 1)
    .single();
  if (data?.workable_blocked) {
    workableBlockedCache = (data.workable_blocked as unknown as WorkableCooldownEntry[]).filter(
      (e) => new Date(e.until).getTime() > Date.now(),
    );
  }
  if (data?.workable_budget) {
    workableBudget = {
      ...DEFAULT_BUDGET,
      ...(data.workable_budget as Partial<WorkableBudgetConfig>),
    };
  }
}

export async function flushWorkable429sToDB(): Promise<void> {
  const slugs = getWorkable429SlugsThisRun();
  if (slugs.length === 0) return;
  markWorkableSlugsBlocked24h(slugs);

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const db = createAdminClient();
  await db
    .from("app_config")
    .update({
      workable_blocked: workableBlockedCache as unknown as Json,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
}

function setWorkableBlocked(slug: string, until: Date): void {
  const iso = until.toISOString();
  const existing = workableBlockedCache.find((e) => e.slug === slug);
  if (existing) existing.until = iso;
  else workableBlockedCache.push({ slug, until: iso });
}

function isWorkableBlocked(slug: string): boolean {
  const entry = workableBlockedCache.find((e) => e.slug === slug);
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

/** Increased timeout to 45s to avoid AbortErrors under load */
export async function safeFetch(url: string, timeout = 45_000): Promise<Response | null> {
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

    // NOTE: title-based "too senior" / "non-frontend" filtering used to happen
    // here via the old hardcoded scoring.ts. Removed deliberately — Job Radar
    // is multi-tenant now. Role/seniority/skill filtering is the user's call,
    // applied downstream against their own /settings, not baked into ingestion.

    // ── Global Mode Restrictions ──
    // (Geographic/timezone eligibility, not role filtering — kept as-is.)
    if (mode === "global") {
      if (isTimezoneIncompatible(r.description + r.location)) continue;

      // If there are specific country restrictions and it's not "Remote/Worldwide/Egypt/EMEA"
      if (r.locationRestrictions && r.locationRestrictions.length > 0) {
        const isBroad = r.locationRestrictions.some((loc) =>
          /remote|worldwide|anywhere|emea|europe|global/i.test(loc),
        );
        const hasEgypt = r.locationRestrictions.some((loc) => /egypt/i.test(loc));

        if (!isBroad && !hasEgypt) continue;
      }
    }

    const postedMs = Date.parse(r.postedAt);
    if (!isNaN(postedMs) && postedMs < cutoff) continue;

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
      sourceName: company.name,
      title,
      company: r.company || company.name,
      location: displayLocation,
      country: countryInfo.name,
      countryFlag: countryInfo.flag,
      url: r.url,
      // Full description stored — no ceiling. The old 6000-char slice (Bug 3,
      // raised from 3000) was still truncating a significant portion of live jobs.
      // Real ceiling determined by Gemini window in gemini.ts's filterBatch.
      description: r.description,
      isRemote,
      postedAt: r.postedAt || now,
      dateUnknown: !r.postedAt,
      visaSponsorship: actualSponsorship,
      // These fields are vestigial on the legacy `Job` type — nothing downstream
      // reads them (the dashboard pipeline computes its own scores in JobCard.tsx via
      // computeRecencyScore/passesSettingsGate against the user's real settings).
      // Kept as neutral defaults only to satisfy the existing type contract.
      matchedSkills: [],
      bonusSkills: [],
      missingSkills: [],
      skillMatchScore: 0,
      recencyScore: 0,
      relocationBonus: 0,
      totalScore: 0,
      fetchedAt: now,
    });
  }
  return out;
}

export async function pLimit<T>(fns: (() => Promise<T>)[], concurrency = 10): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < fns.length; i += concurrency) {
    const batch = await Promise.allSettled(fns.slice(i, i + concurrency).map((f) => f()));
    for (const r of batch) results.push(r.status === "fulfilled" ? r.value : (null as T));
    if (i + concurrency < fns.length) await new Promise((r) => setTimeout(r, 500));
  }
  return results;
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
    const { jobs } = (await res.json()) as { jobs: GreenhouseJob[] };
    const rawCount = jobs.length;
    const processed = processJobs(
      jobs.map((r) => {
        const officeNames = (r.offices || [])
          .map((o) => o.name)
          .filter((n) => n && n !== "Remote")
          .join(", ");
        const location = officeNames || r.location?.name || c.city || c.country;

        return {
          id: `${mode}_gh_${c.slug}_${r.id}`,
          title: r.title,
          location,
          url: r.absolute_url,
          postedAt: r.updated_at,
          description: stripHtml(r.content || ""),
        };
      }),
      c,
      mode,
      visaSponsorship,
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

// ── Lever ──────────────────────────────────────────────────────────────────

export async function fetchLever(
  c: ATSConfig,
  mode: JobMode,
  visaSponsorship: boolean,
): Promise<FetcherResult> {
  const t0 = Date.now();
  const url = `https://api.lever.co/v0/postings/${c.slug}?mode=json`;
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
    const jobs = (await res.json()) as LeverJob[];
    const rawCount = jobs.length;
    const processed = processJobs(
      jobs.map((r) => ({
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

// ── Ashby ──────────────────────────────────────────────────────────────────

export async function fetchAshby(
  c: ATSConfig,
  mode: JobMode,
  visaSponsorship: boolean,
): Promise<FetcherResult> {
  const t0 = Date.now();
  const url = `https://api.ashbyhq.com/posting-api/job-board/${c.slug}`;
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
    const data = (await res.json()) as { jobs?: AshbyJob[]; jobPostings?: AshbyJob[] };
    const jobs = data.jobs || data.jobPostings || [];
    const rawCount = jobs.length;
    const processed = processJobs(
      jobs.map((r) => ({
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

export async function fetchWorkable(
  c: ATSConfig,
  mode: JobMode,
  visaSponsorship: boolean,
): Promise<FetcherResult> {
  const t0 = Date.now();
  if (isWorkableBlocked(c.slug))
    return {
      jobs: [],
      rawCount: 0,
      error: "Blocked (Cooldown)",
      durationMs: Date.now() - t0,
      ok: false,
    };

  const budget = workableBudget;
  const limit = budget[mode as JobMode];
  const used = workableUsedByMode[mode];
  if (used >= limit)
    return {
      jobs: [],
      rawCount: 0,
      error: "Budget Exceeded",
      durationMs: Date.now() - t0,
      ok: false,
    };
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

  const res = await queueWorkable(doFetch, mode);

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
    const data = (await res.json()) as { jobs?: WorkableJob[] };
    const rawJobs = data.jobs || [];
    const rawCount = rawJobs.length;
    // NOTE: this used to pre-filter by title via the old hardcoded scoring.ts
    // before even fetching job details, as a Workable API budget optimization.
    // Removed for the same reason as processJobs — role filtering is the
    // user's call via /settings now, not a hardcoded gate. If Workable detail-fetch
    // volume becomes a real budget concern, that's a separate, deliberate decision —
    // not a silent side effect of this filter.
    const jobs = rawJobs;
    const withDesc = await pLimit(
      jobs.map((r) => async () => {
        const detailUrl = `https://apply.workable.com/api/v1/widget/accounts/${c.slug}/jobs/${r.shortcode}`;
        const dr = await fetch(detailUrl, { headers: { "User-Agent": "Mozilla/5.0" } }).catch(
          () => null,
        );
        let desc = stripHtml(r.description || "");
        if (dr && dr.ok) {
          try {
            const detail = (await dr.json()) as WorkableDetail;
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
    const processed = processJobs(withDesc.filter(Boolean) as RawJob[], c, mode, visaSponsorship);

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
    const { data } = (await res.json()) as { data: TeamtailorJob[] };
    const rawCount = data.length;
    const processed = processJobs(
      data.map((r) => ({
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
    const jobs = (await res.json()) as BreezyJob[];
    const rawCount = jobs.length;
    const processed = processJobs(
      jobs.map((r) => ({
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

// ── SmartRecruiters ───────────────────────────────────────────────────────

export async function fetchSmartRecruiters(
  c: ATSConfig,
  mode: JobMode,
  visaSponsorship: boolean,
): Promise<FetcherResult> {
  const t0 = Date.now();
  const url = `https://api.smartrecruiters.com/v1/companies/${c.slug}/postings`;
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
    const { content } = (await res.json()) as { content: SRJob[] };
    const rawCount = content.length;
    const detailedJobs = await Promise.all(
      content.map(async (r) => {
        const detailRes = await safeFetch(r.ref);
        if (!detailRes || !detailRes.ok) return null;
        try {
          const detail = (await detailRes.json()) as SRDetail;
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
    const processed = processJobs(
      detailedJobs.filter((j): j is RawJob => j !== null),
      c,
      mode,
      visaSponsorship,
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

// ── BambooHR ───────────────────────────────────────────────────────────────

export async function fetchBambooHR(
  c: ATSConfig,
  mode: JobMode,
  visaSponsorship: boolean,
): Promise<FetcherResult> {
  const t0 = Date.now();
  const url = `https://${c.slug}.bamboohr.com/careers/list`;
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
    const data = (await res.json()) as { result?: BambooJob[] };
    const jobs = data.result ?? [];
    const rawCount = jobs.length;
    // BambooHR's list endpoint never includes a description (Bug 4,
    // gemini-filter-audit.md) — fetch each job's detail page for the real
    // description, mirroring fetchWorkable's detail-fetch pattern.
    const withDesc = await pLimit(
      jobs.map((r) => async () => {
        let description = "";
        const detailUrl = `https://${c.slug}.bamboohr.com/careers/${r.id}/detail`;
        const dr = await safeFetch(detailUrl);
        if (dr && dr.ok) {
          try {
            const detail = (await dr.json()) as BambooDetail;
            description = stripHtml(detail.result?.jobOpening?.description ?? "");
          } catch {}
        }
        return {
          id: `${mode}_bamboohr_${c.slug}_${r.id}`,
          title: r.jobOpeningName,
          location: r.city ? `${r.city}, ${r.country}` : (c.city ?? c.country),
          url: `https://${c.slug}.bamboohr.com/careers/${r.id}`,
          postedAt: r.datePosted,
          description,
        };
      }),
      5,
    );
    const processed = processJobs(withDesc.filter(Boolean) as RawJob[], c, mode, visaSponsorship);
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

// ── JazzHR ──────────────────────────────────────────────────────────────────

export async function fetchJazzHR(
  c: ATSConfig,
  mode: JobMode,
  visaSponsorship: boolean,
): Promise<FetcherResult> {
  const t0 = Date.now();
  const url = `https://api.resumator.com/v1/jobs/board/public/account/${c.slug}`;
  const res = await safeFetch(url, 60_000); // Increased timeout to 60s

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
    const jobs = (await res.json()) as JazzJob[];
    const rawCount = jobs.length;
    const processed = processJobs(
      jobs.map((r) => ({
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
