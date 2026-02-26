// src/lib/sources/companies.ts
// Visa-mode: remote jobs at known visa-sponsoring companies.
// All jobs = visaSponsorship: true, mode: "visa"
//
// ATS confirmed working:
//   Greenhouse → boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true
//   Lever      → api.lever.co/v0/postings/{slug}?mode=json
//   Ashby      → api.ashbyhq.com/posting-api/job-board/{slug}?includeCompensation=true
//
// To add a company: find their careers page, open DevTools → Network → XHR/Fetch,
// filter requests while browsing jobs. Look for one of the three API patterns above.
// Then add one line to COMPANIES below.

import type { Job } from "../types";
import { isClearlyNonFrontend, isTooSenior, requiresCitizenshipOrClearance, scoreJob } from "../scoring";

// ── Config ─────────────────────────────────────────────────────────────────

interface BaseCompany { name: string; country: string; countryFlag: string; }
interface GHCompany extends BaseCompany { ats: "greenhouse"; slug: string; }
interface LeverCompany extends BaseCompany { ats: "lever"; slug: string; }
interface AshbyCompany extends BaseCompany { ats: "ashby"; slug: string; }
type CompanyConfig = GHCompany | LeverCompany | AshbyCompany;

// ── Company list ─────────────────────────────────────────────────────────────
// Only confirmed working slugs here. Silent 404 skip handles anything wrong.

const COMPANIES: CompanyConfig[] = [
  // ── Confirmed Greenhouse ────────────────────────────────────────────────
  { ats: "greenhouse", name: "Adyen", slug: "adyen", country: "Netherlands", countryFlag: "🇳🇱" },
  { ats: "greenhouse", name: "Monzo", slug: "monzo", country: "United Kingdom", countryFlag: "🇬🇧" },
  { ats: "greenhouse", name: "N26", slug: "n26", country: "Germany", countryFlag: "🇩🇪" },
  { ats: "greenhouse", name: "Typeform", slug: "typeform", country: "Spain", countryFlag: "🇪🇸" },
  { ats: "greenhouse", name: "Intercom", slug: "intercom", country: "Ireland", countryFlag: "🇮🇪" },
  { ats: "greenhouse", name: "Contentful", slug: "contentful", country: "Germany", countryFlag: "🇩🇪" },
  // ── Add more as you discover them via DevTools ──────────────────────────
  // { ats: "greenhouse", name: "...", slug: "...", country: "...", countryFlag: "..." },
  // { ats: "lever",      name: "...", slug: "...", country: "...", countryFlag: "..." },
  // { ats: "ashby",      name: "...", slug: "...", country: "...", countryFlag: "..." },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/\s{2,}/g, " ").trim();
}

async function safeFetch(url: string): Promise<Response | null> {
  try {
    return await fetch(url, {
      headers: { "User-Agent": "JobRadar/2.0 personal aggregator" },
      signal: AbortSignal.timeout(15_000),
    });
  } catch { return null; }
}

// ── Shared pipeline ────────────────────────────────────────────────────────

interface RawJob { id: string; title: string; location: string; url: string; postedAt: string; description: string; }

function processJobs(raw: RawJob[], company: CompanyConfig): Job[] {
  const now = new Date().toISOString();
  const out: Job[] = [];

  for (const r of raw) {
    const title = r.title.trim();
    if (isClearlyNonFrontend(title)) continue;
    if (isTooSenior(title)) continue;
    if (requiresCitizenshipOrClearance(r.description)) continue;

    const scored = scoreJob({ title, description: r.description, location: r.location, postedAt: r.postedAt });
    if (scored.skillMatchScore === 0) continue;

    out.push({
      id: r.id, source: "company", mode: "visa",
      title, company: company.name, location: r.location,
      country: company.country, countryFlag: company.countryFlag,
      url: r.url, description: r.description, salary: undefined,
      postedAt: r.postedAt ?? now, visaSponsorship: true,
      ...scored, fetchedAt: now,
    });
  }

  console.log(`[visa] ${company.name}: ${raw.length} total → ${out.length} matches`);
  return out;
}

// ── Greenhouse ─────────────────────────────────────────────────────────────

interface GHJob { id: number; title: string; location: { name: string }; absolute_url: string; updated_at: string; content?: string; }

async function fetchGreenhouse(c: GHCompany): Promise<Job[]> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${c.slug}/jobs?content=true`;
  const res = await safeFetch(url);
  if (!res) { console.error(`[visa] ${c.name}: network error`); return []; }
  if (res.status === 404) { console.warn(`[visa] ${c.name}: GH board "${c.slug}" not found — check boards.greenhouse.io/${c.slug}`); return []; }
  if (!res.ok) { console.error(`[visa] ${c.name}: HTTP ${res.status}`); return []; }
  const { jobs } = await res.json() as { jobs: GHJob[] };
  return processJobs(jobs.map(r => ({
    id: `visa_${c.slug}_${r.id}`, title: r.title, location: r.location?.name ?? c.country,
    url: r.absolute_url, postedAt: r.updated_at, description: r.content ? stripHtml(r.content) : "",
  })), c);
}

// ── Lever ──────────────────────────────────────────────────────────────────

interface LeverJob { id: string; text: string; hostedUrl: string; createdAt: number; descriptionPlain?: string; description?: string; categories?: { location?: string }; }

async function fetchLever(c: LeverCompany): Promise<Job[]> {
  const url = `https://api.lever.co/v0/postings/${c.slug}?mode=json`;
  const res = await safeFetch(url);
  if (!res) { console.error(`[visa] ${c.name}: network error`); return []; }
  if (res.status === 404) { console.warn(`[visa] ${c.name}: Lever slug "${c.slug}" not found — check jobs.lever.co/${c.slug}`); return []; }
  if (!res.ok) { console.error(`[visa] ${c.name}: HTTP ${res.status}`); return []; }
  const jobs = await res.json() as LeverJob[];
  return processJobs(jobs.map(r => ({
    id: `visa_${c.slug}_${r.id}`, title: r.text, location: r.categories?.location ?? c.country,
    url: r.hostedUrl, postedAt: new Date(r.createdAt).toISOString(),
    description: r.descriptionPlain ?? (r.description ? stripHtml(r.description) : ""),
  })), c);
}

// ── Ashby ──────────────────────────────────────────────────────────────────

interface AshbyJob { id: string; title: string; locationName?: string; jobUrl: string; publishedAt?: string; descriptionHtml?: string; descriptionPlain?: string; compensation?: { summaryComponents?: Array<{ label?: string; value?: string }> }; }
interface AshbyResp { jobs?: AshbyJob[]; jobPostings?: AshbyJob[]; }

async function fetchAshby(c: AshbyCompany): Promise<Job[]> {
  const url = `https://api.ashbyhq.com/posting-api/job-board/${c.slug}?includeCompensation=true`;
  const res = await safeFetch(url);
  if (!res) { console.error(`[visa] ${c.name}: network error`); return []; }
  if (res.status === 404) { console.warn(`[visa] ${c.name}: Ashby slug "${c.slug}" not found — check jobs.ashbyhq.com/${c.slug}`); return []; }
  if (!res.ok) { console.error(`[visa] ${c.name}: HTTP ${res.status}`); return []; }
  const data = await res.json() as AshbyResp;
  const jobs = data.jobs ?? data.jobPostings ?? [];
  return processJobs(jobs.map(r => ({
    id: `visa_${c.slug}_${r.id}`, title: r.title, location: r.locationName ?? c.country,
    url: r.jobUrl, postedAt: r.publishedAt ?? new Date().toISOString(),
    description: r.descriptionPlain ?? (r.descriptionHtml ? stripHtml(r.descriptionHtml) : ""),
  })), c);
}

// ── Main export ─────────────────────────────────────────────────────────────

export async function fetchCompanyJobs(): Promise<Job[]> {
  const results = await Promise.allSettled(
    COMPANIES.map(c =>
      c.ats === "greenhouse" ? fetchGreenhouse(c) :
        c.ats === "lever" ? fetchLever(c) :
          c.ats === "ashby" ? fetchAshby(c) :
            Promise.resolve([] as Job[]),
    ),
  );
  const all: Job[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") all.push(...r.value);
    else console.error("[visa] Unhandled rejection:", r.reason);
  }
  console.log(`[visa] Total: ${all.length} jobs`);
  return all;
}