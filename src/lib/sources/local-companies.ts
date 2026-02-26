// src/lib/sources/local-companies.ts
// Local mode: Egyptian tech companies tracked directly via their ATS APIs.
// Same Greenhouse / Lever / Ashby approach as the visa pipeline.
// visaSponsorship: false, mode: "local"
//
// ── How to find ATS endpoints ──────────────────────────────────────────────
// 1. Open the company's careers page in Chrome
// 2. DevTools → Network tab → filter by "Fetch/XHR"
// 3. Scroll / search through job listings
// 4. Look for a JSON response containing an array of jobs
// 5. The URL will match one of:
//      boards-api.greenhouse.io/v1/boards/{slug}/jobs
//      api.lever.co/v0/postings/{slug}
//      api.ashbyhq.com/posting-api/job-board/{slug}
// 6. Add to COMPANIES below — silent 404 skip handles wrong slugs
//
// ── Known Egyptian companies & their ATS (verified / likely) ──────────────
//   Luciq (ex-Instabug) → likely Greenhouse "luciq" or "instabug"
//   Paymob              → likely Greenhouse "paymob" or custom
//   Halan               → likely Greenhouse "halan"
//   Breadfast           → likely Greenhouse "breadfast"
//   Rabbit              → likely Greenhouse "rabbit" or Ashby "rabbit"
//   MoneyFellows        → likely Greenhouse "moneyfellows"
//   Sylndr              → likely Ashby "sylndr"
//   Thndr               → likely Ashby "thndr"
//   MaxAB               → likely Greenhouse "maxab"
//   Cartona             → likely Greenhouse "cartona"
//
// All slugs below will 404-skip gracefully if wrong.
// Run `pnpm run cron:now` and watch the [local] logs — confirmed ones will show counts.

import type { Job } from "../types";
import { isClearlyNonFrontend, isTooSenior, scoreJob } from "../scoring";

interface BaseCompany { name: string; city: string; }
interface GHCompany extends BaseCompany { ats: "greenhouse"; slug: string; }
interface LeverCompany extends BaseCompany { ats: "lever"; slug: string; }
interface AshbyCompany extends BaseCompany { ats: "ashby"; slug: string; }
type CompanyConfig = GHCompany | LeverCompany | AshbyCompany;

const COUNTRY = "Egypt";
const FLAG = "🇪🇬";

const COMPANIES: CompanyConfig[] = [
    // ── Try Greenhouse slugs ────────────────────────────────────────────────
    { ats: "greenhouse", name: "Luciq", slug: "luciq", city: "Cairo" },
    { ats: "greenhouse", name: "Luciq", slug: "instabug", city: "Cairo" },   // old slug
    { ats: "greenhouse", name: "Paymob", slug: "paymob", city: "Cairo" },
    { ats: "greenhouse", name: "Halan", slug: "halan", city: "Cairo" },
    { ats: "greenhouse", name: "Breadfast", slug: "breadfast", city: "Cairo" },
    { ats: "greenhouse", name: "Rabbit", slug: "rabbit", city: "Cairo" },
    { ats: "greenhouse", name: "MoneyFellows", slug: "moneyfellows", city: "Cairo" },
    { ats: "greenhouse", name: "MaxAB", slug: "maxab", city: "Cairo" },
    { ats: "greenhouse", name: "Cartona", slug: "cartona", city: "Cairo" },
    // ── Try Ashby slugs ─────────────────────────────────────────────────────
    { ats: "ashby", name: "Sylndr", slug: "sylndr", city: "Cairo" },
    { ats: "ashby", name: "Thndr", slug: "thndr", city: "Cairo" },
    { ats: "ashby", name: "Rabbit", slug: "rabbit", city: "Cairo" },   // try both
    { ats: "ashby", name: "Paymob", slug: "paymob", city: "Cairo" },   // try both
    // ── Try Lever slugs ─────────────────────────────────────────────────────
    { ats: "lever", name: "Halan", slug: "halan", city: "Cairo" },   // try both
    { ats: "lever", name: "Breadfast", slug: "breadfast", city: "Cairo" },   // try both
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
            signal: AbortSignal.timeout(12_000),
        });
    } catch { return null; }
}

interface RawJob { id: string; title: string; location: string; url: string; postedAt: string; description: string; }

function processJobs(raw: RawJob[], company: CompanyConfig): Job[] {
    const now = new Date().toISOString();
    const out: Job[] = [];

    for (const r of raw) {
        const title = r.title.trim();
        if (isClearlyNonFrontend(title)) continue;
        if (isTooSenior(title)) continue;

        const scored = scoreJob({ title, description: r.description, location: r.location, postedAt: r.postedAt });
        if (scored.skillMatchScore === 0) continue;

        // Dedup: if Luciq appears via both "luciq" and "instabug" slugs, same job id will dedup in storage
        out.push({
            id: r.id, source: "company", mode: "local",
            title, company: company.name,
            location: `${company.city}, Egypt`,
            country: COUNTRY, countryFlag: FLAG,
            url: r.url, description: r.description, salary: undefined,
            postedAt: r.postedAt ?? now,
            visaSponsorship: false,  // local jobs — no visa assumption
            ...scored, fetchedAt: now,
        });
    }

    if (raw.length > 0 || out.length > 0) {
        console.log(`[local] ${company.name} (${company.ats}/${company.slug}): ${raw.length} total → ${out.length} matches`);
    }
    return out;
}

// ── Greenhouse ─────────────────────────────────────────────────────────────

interface GHJob { id: number; title: string; location: { name: string }; absolute_url: string; updated_at: string; content?: string; }

async function fetchGreenhouse(c: GHCompany): Promise<Job[]> {
    const url = `https://boards-api.greenhouse.io/v1/boards/${c.slug}/jobs?content=true`;
    const res = await safeFetch(url);
    if (!res) return [];
    if (res.status === 404) { console.warn(`[local] GH board "${c.slug}" not found`); return []; }
    if (!res.ok) return [];
    const { jobs } = await res.json() as { jobs: GHJob[] };
    return processJobs(jobs.map(r => ({
        id: `local_gh_${c.slug}_${r.id}`, title: r.title, location: r.location?.name ?? c.city,
        url: r.absolute_url, postedAt: r.updated_at, description: r.content ? stripHtml(r.content) : "",
    })), c);
}

// ── Lever ──────────────────────────────────────────────────────────────────

interface LeverJob { id: string; text: string; hostedUrl: string; createdAt: number; descriptionPlain?: string; description?: string; categories?: { location?: string }; }

async function fetchLever(c: LeverCompany): Promise<Job[]> {
    const url = `https://api.lever.co/v0/postings/${c.slug}?mode=json`;
    const res = await safeFetch(url);
    if (!res) return [];
    if (res.status === 404) { console.warn(`[local] Lever slug "${c.slug}" not found`); return []; }
    if (!res.ok) return [];
    const jobs = await res.json() as LeverJob[];
    return processJobs(jobs.map(r => ({
        id: `local_lever_${c.slug}_${r.id}`, title: r.text, location: c.city,
        url: r.hostedUrl, postedAt: new Date(r.createdAt).toISOString(),
        description: r.descriptionPlain ?? (r.description ? stripHtml(r.description) : ""),
    })), c);
}

// ── Ashby ──────────────────────────────────────────────────────────────────

interface AshbyJob { id: string; title: string; locationName?: string; jobUrl: string; publishedAt?: string; descriptionHtml?: string; descriptionPlain?: string; }
interface AshbyResp { jobs?: AshbyJob[]; jobPostings?: AshbyJob[]; }

async function fetchAshby(c: AshbyCompany): Promise<Job[]> {
    const url = `https://api.ashbyhq.com/posting-api/job-board/${c.slug}?includeCompensation=true`;
    const res = await safeFetch(url);
    if (!res) return [];
    if (res.status === 404) { console.warn(`[local] Ashby slug "${c.slug}" not found`); return []; }
    if (!res.ok) return [];
    const data = await res.json() as AshbyResp;
    const jobs = data.jobs ?? data.jobPostings ?? [];
    return processJobs(jobs.map(r => ({
        id: `local_ashby_${c.slug}_${r.id}`, title: r.title, location: r.locationName ?? c.city,
        url: r.jobUrl, postedAt: r.publishedAt ?? new Date().toISOString(),
        description: r.descriptionPlain ?? (r.descriptionHtml ? stripHtml(r.descriptionHtml) : ""),
    })), c);
}

// ── Main export ─────────────────────────────────────────────────────────────

export async function fetchLocalJobs(): Promise<Job[]> {
    const results = await Promise.allSettled(
        COMPANIES.map(c =>
            c.ats === "greenhouse" ? fetchGreenhouse(c) :
                c.ats === "lever" ? fetchLever(c) :
                    c.ats === "ashby" ? fetchAshby(c) :
                        Promise.resolve([] as Job[]),
        ),
    );
    const all: Job[] = [];
    const seen = new Set<string>();
    for (const r of results) {
        if (r.status === "fulfilled") {
            for (const j of r.value) {
                if (!seen.has(j.id)) { seen.add(j.id); all.push(j); }
            }
        } else {
            console.error("[local] Unhandled rejection:", r.reason);
        }
    }
    console.log(`[local] Total: ${all.length} jobs`);
    return all;
}