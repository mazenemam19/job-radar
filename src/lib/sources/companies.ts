// src/lib/sources/companies.ts
//
// Fetches jobs directly from the ATS APIs of known visa-sponsoring companies.
// No aggregators. No keyword-based visa detection.
// Every job from this list is assumed visaSponsorship: true.
//
// ── ATS map ───────────────────────────────────────────────────────────────────
//
//  Confirmed Greenhouse:
//    Adyen       boards-api.greenhouse.io/v1/boards/adyen/jobs
//    Monzo       boards-api.greenhouse.io/v1/boards/monzo/jobs
//    N26         boards-api.greenhouse.io/v1/boards/n26/jobs
//    Typeform    boards-api.greenhouse.io/v1/boards/typeform/jobs
//    Intercom    boards-api.greenhouse.io/v1/boards/intercom/jobs
//
//  Likely Greenhouse (404s caught silently — verify at boards.greenhouse.io/<slug>):
//    Contentful  → "contentful"
//    Personio    → "personio"
//    Mollie      → "mollie"
//    Deliveroo   → "deliveroo"
//
//  Confirmed Lever:
//    Wise        api.lever.co/v0/postings/wise?mode=json
//    Revolut     api.lever.co/v0/postings/revolut?mode=json
//
//  Likely Lever (verify at jobs.lever.co/<slug>):
//    Klarna      → "klarna"
//    Booking.com → "bookingcom"
//
// To discover more ATS endpoints: open a company's careers page in Chrome,
// DevTools → Network → XHR/Fetch tab, scroll job listings, look for JSON payload.
// Pattern will be boards-api.greenhouse.io, api.lever.co, or a custom /api/jobs.

import type { Job } from "../types";
import { isClearlyNonFrontend, requiresCitizenshipOrClearance, scoreJob } from "../scoring";

// ── Config types ─────────────────────────────────────────────────────────────

interface GreenhouseCompany {
  ats: "greenhouse";
  name: string;
  slug: string;
  country: string;
  countryFlag: string;
}

interface LeverCompany {
  ats: "lever";
  name: string;
  slug: string;
  country: string;
  countryFlag: string;
}

type CompanyConfig = GreenhouseCompany | LeverCompany;

// ── Company list ─────────────────────────────────────────────────────────────

const COMPANIES: CompanyConfig[] = [
  // ── Confirmed Greenhouse ────────────────────────────────────────────────
  { ats: "greenhouse", name: "Adyen",      slug: "adyen",      country: "Netherlands",    countryFlag: "🇳🇱" },
  { ats: "greenhouse", name: "Monzo",      slug: "monzo",      country: "United Kingdom", countryFlag: "🇬🇧" },
  { ats: "greenhouse", name: "N26",        slug: "n26",        country: "Germany",         countryFlag: "🇩🇪" },
  { ats: "greenhouse", name: "Typeform",   slug: "typeform",   country: "Spain",           countryFlag: "🇪🇸" },
  { ats: "greenhouse", name: "Intercom",   slug: "intercom",   country: "Ireland",         countryFlag: "🇮🇪" },
  // ── Likely Greenhouse (silent 404 skip if wrong) ────────────────────────
  { ats: "greenhouse", name: "Contentful", slug: "contentful", country: "Germany",         countryFlag: "🇩🇪" },
  { ats: "greenhouse", name: "Personio",   slug: "personio",   country: "Germany",         countryFlag: "🇩🇪" },
  { ats: "greenhouse", name: "Mollie",     slug: "mollie",     country: "Netherlands",    countryFlag: "🇳🇱" },
  { ats: "greenhouse", name: "Deliveroo",  slug: "deliveroo",  country: "United Kingdom", countryFlag: "🇬🇧" },
  // ── Confirmed Lever ────────────────────────────────────────────────────
  { ats: "lever",      name: "Wise",       slug: "wise",       country: "United Kingdom", countryFlag: "🇬🇧" },
  { ats: "lever",      name: "Revolut",    slug: "revolut",    country: "United Kingdom", countryFlag: "🇬🇧" },
  // ── Likely Lever (silent 404 skip if wrong) ─────────────────────────────
  { ats: "lever",      name: "Klarna",     slug: "klarna",     country: "Sweden",          countryFlag: "🇸🇪" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

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
    const res = await fetch(url, {
      headers: { "User-Agent": "JobRadar/2.0 personal aggregator" },
      signal: AbortSignal.timeout(15_000),
    });
    return res;
  } catch {
    return null;
  }
}

// ── Greenhouse fetcher ────────────────────────────────────────────────────────

interface GHJob { id: number; title: string; location: { name: string }; absolute_url: string; updated_at: string; content?: string; }

async function fetchGreenhouse(company: GreenhouseCompany): Promise<Job[]> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${company.slug}/jobs?content=true`;
  const res = await safeFetch(url);

  if (!res) { console.error(`[companies] ${company.name}: network error`); return []; }
  if (res.status === 404) {
    console.warn(`[companies] ${company.name}: board "${company.slug}" not found — verify at boards.greenhouse.io/${company.slug}`);
    return [];
  }
  if (!res.ok) { console.error(`[companies] ${company.name}: HTTP ${res.status}`); return []; }

  const { jobs } = await res.json() as { jobs: GHJob[] };
  return processJobs(jobs.map(r => ({
    id: `company_${company.slug}_${r.id}`,
    title: r.title,
    location: r.location?.name ?? company.country,
    url: r.absolute_url,
    postedAt: r.updated_at,
    description: r.content ? stripHtml(r.content) : "",
  })), company);
}

// ── Lever fetcher ─────────────────────────────────────────────────────────────

interface LeverJob { id: string; text: string; hostedUrl: string; createdAt: number; descriptionPlain?: string; description?: string; categories?: { location?: string }; }

async function fetchLever(company: LeverCompany): Promise<Job[]> {
  const url = `https://api.lever.co/v0/postings/${company.slug}?mode=json`;
  const res = await safeFetch(url);

  if (!res) { console.error(`[companies] ${company.name}: network error`); return []; }
  if (res.status === 404) {
    console.warn(`[companies] ${company.name}: Lever slug "${company.slug}" not found — verify at jobs.lever.co/${company.slug}`);
    return [];
  }
  if (!res.ok) { console.error(`[companies] ${company.name}: HTTP ${res.status}`); return []; }

  const jobs = await res.json() as LeverJob[];
  return processJobs(jobs.map(r => ({
    id: `company_${company.slug}_${r.id}`,
    title: r.text,
    location: r.categories?.location ?? company.country,
    url: r.hostedUrl,
    postedAt: new Date(r.createdAt).toISOString(),
    description: r.descriptionPlain ?? (r.description ? stripHtml(r.description) : ""),
  })), company);
}

// ── Shared processing pipeline ────────────────────────────────────────────────

interface RawJob { id: string; title: string; location: string; url: string; postedAt: string; description: string; }

function processJobs(raw: RawJob[], company: CompanyConfig): Job[] {
  const now = new Date().toISOString();
  const out: Job[] = [];

  for (const r of raw) {
    const title = r.title.trim();
    if (isClearlyNonFrontend(title)) continue;
    if (requiresCitizenshipOrClearance(r.description)) continue;

    const scored = scoreJob({
      title,
      description: r.description,
      location: r.location,
      postedAt: r.postedAt,
    });

    if (scored.skillMatchScore === 0) continue; // < MIN_CORE_SKILLS

    out.push({
      id: r.id,
      source: "company",
      title,
      company: company.name,
      location: r.location,
      country: company.country,
      countryFlag: company.countryFlag,
      url: r.url,
      description: r.description,
      salary: undefined,
      postedAt: r.postedAt ?? now,
      visaSponsorship: true,
      ...scored,
      fetchedAt: now,
    });
  }

  console.log(`[companies] ${company.name}: ${raw.length} total → ${out.length} frontend matches`);
  return out;
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function fetchCompanyJobs(): Promise<Job[]> {
  const results = await Promise.allSettled(
    COMPANIES.map(c =>
      c.ats === "greenhouse" ? fetchGreenhouse(c) :
      c.ats === "lever"      ? fetchLever(c) :
      Promise.resolve([] as Job[]),
    ),
  );

  const all: Job[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") all.push(...r.value);
    else console.error("[companies] Unhandled rejection:", r.reason);
  }

  console.log(`[companies] Grand total: ${all.length} frontend jobs`);
  return all;
}
