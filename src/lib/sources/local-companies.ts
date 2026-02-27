// src/lib/sources/local-companies.ts
import type { Job } from "../types";
import { fetchGreenhouse, fetchLever, fetchAshby, fetchWorkable, fetchTeamtailor, fetchBreezy, fetchSmartRecruiters, fetchBambooHR, type ATSConfig } from "./ats-utils";

const COUNTRY = "Egypt";
const FLAG = "🇪🇬";
const MODE = "local";
const VISA = false;

const COMPANIES: ATSConfig[] = [
    // ── Verified Live ──────────────────────────────────────────────────────
    { ats: "lever", name: "Bosta", slug: "Bosta", country: COUNTRY, countryFlag: FLAG, city: "Cairo" },
    { ats: "ashby", name: "Thndr", slug: "thndr", country: COUNTRY, countryFlag: FLAG, city: "Cairo" },
    { ats: "greenhouse", name: "Speechify", slug: "speechify", country: COUNTRY, countryFlag: FLAG, city: "Cairo" },
    { ats: "workable", name: "Nawy", slug: "nawy-real-estate", country: COUNTRY, countryFlag: FLAG, city: "Cairo" },
    { ats: "smartrecruiters", name: "Yassir", slug: "YassirGmbh", country: COUNTRY, countryFlag: FLAG, city: "Cairo" },
    { ats: "workable", name: "Dubizzle", slug: "bayutdubizzle", country: COUNTRY, countryFlag: FLAG, city: "Cairo" },

    // ── Confirmed from career page URL patterns ────────────────────────────
    // ⚠️ Verify with live fetch before trusting.
    { ats: "bamboohr", name: "Instabug", slug: "instabug", country: COUNTRY, countryFlag: FLAG, city: "Cairo" },
    { ats: "workable", name: "Rubikal", slug: "rubikal", country: COUNTRY, countryFlag: FLAG, city: "Cairo" },
    { ats: "workable", name: "Blink22", slug: "blink22-3", country: COUNTRY, countryFlag: FLAG, city: "Cairo" },
    { ats: "workable", name: "Squadio", slug: "squadio23", country: COUNTRY, countryFlag: FLAG, city: "Cairo" },
    { ats: "workable", name: "Robusta", slug: "robusta", country: COUNTRY, countryFlag: FLAG, city: "Cairo" },
    { ats: "smartrecruiters", name: "Algoriza", slug: "Algoriza", country: COUNTRY, countryFlag: FLAG, city: "Cairo" },

    // ── Monitoring ──────────────────────────────────────────────────────────
    { ats: "workable", name: "Vezeeta", slug: "vezeeta", country: COUNTRY, countryFlag: FLAG, city: "Cairo" },
    { ats: "breezy", name: "MaxAB", slug: "maxab", country: COUNTRY, countryFlag: FLAG, city: "Cairo" },

    // ── TODO: Need manual page fetch to identify ATS ──────────────────────
    // enozom       → https://enozom.com/Company/Join_Us/           (custom or Zoho?)
    // Pharos       → https://pharos-solutions.de/careers/          (unknown)
    // softxpert    → https://softxpert.zohorecruit.com/jobs/Careers (Zoho Recruit - needs custom fetcher)
    // trianglz     → https://trianglz.com/software-development-jobs-egypt-trianglz/
    // inovaeg      → https://inovaeg.com/jobs/
    // espace       → https://espace.com.eg/jobs/
    // eventum      → https://odoo.eventumsolutions.com/jobs (Odoo - needs custom fetcher)
    // objects      → https://objects.ws/careers/
    // brightskiesinc → https://brightskiesinc.com/careers/jobs
    // gizasystems  → https://www.gizasystemscareers.com/en/job-search-results/
];

export async function fetchLocalJobs(): Promise<Job[]> {
    const results = await Promise.allSettled(
        COMPANIES.map(c => {
            switch (c.ats) {
                case "greenhouse": return fetchGreenhouse(c, MODE, VISA);
                case "lever": return fetchLever(c, MODE, VISA);
                case "ashby": return fetchAshby(c, MODE, VISA);
                case "workable": return fetchWorkable(c, MODE, VISA);
                case "teamtailor": return fetchTeamtailor(c, MODE, VISA);
                case "breezy": return fetchBreezy(c, MODE, VISA);
                case "smartrecruiters": return fetchSmartRecruiters(c, MODE, VISA);
                case "bamboohr": return fetchBambooHR(c, MODE, VISA);
                default: return Promise.resolve([] as Job[]);
            }
        }),
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
