// src/lib/sources/local-companies.ts
import type { Job } from "../types";
import { fetchGreenhouse, fetchLever, fetchAshby, fetchWorkable, fetchTeamtailor, fetchBreezy, fetchSmartRecruiters, fetchBambooHR, fetchGizaSystems, fetchBrightSkies, fetchPharos, type ATSConfig } from "./ats-utils";

const COUNTRY = "Egypt";
const FLAG = "🇪🇬";
const MODE = "local";
const VISA = false;

const COMPANIES: ATSConfig[] = [
    // ── Verified Live ──────────────────────────────────────────────────────
    { ats: "lever",          name: "Bosta",       slug: "Bosta",             country: COUNTRY, countryFlag: FLAG, city: "Cairo" },
    { ats: "ashby",          name: "Thndr",        slug: "thndr",             country: COUNTRY, countryFlag: FLAG, city: "Cairo" },
    { ats: "workable",       name: "Nawy",         slug: "nawy-real-estate",  country: COUNTRY, countryFlag: FLAG, city: "Cairo" },
    { ats: "smartrecruiters",name: "Yassir",       slug: "YassirGmbh",        country: COUNTRY, countryFlag: FLAG, city: "Cairo" },
    { ats: "workable",       name: "Dubizzle",     slug: "bayutdubizzle",     country: COUNTRY, countryFlag: FLAG, city: "Cairo" },
    { ats: "bamboohr",       name: "Instabug",     slug: "instabug",          country: COUNTRY, countryFlag: FLAG, city: "Cairo" },
    { ats: "workable",       name: "Rubikal",      slug: "rubikal",           country: COUNTRY, countryFlag: FLAG, city: "Cairo" },
    { ats: "workable",       name: "Blink22",      slug: "blink22-3",         country: COUNTRY, countryFlag: FLAG, city: "Cairo" },
    { ats: "workable",       name: "Squadio",      slug: "squadio23",         country: COUNTRY, countryFlag: FLAG, city: "Cairo" },
    { ats: "workable",       name: "Robusta",      slug: "robusta",           country: COUNTRY, countryFlag: FLAG, city: "Cairo" },
    { ats: "smartrecruiters",name: "Algoriza",     slug: "Algoriza",          country: COUNTRY, countryFlag: FLAG, city: "Cairo" },
    { ats: "workable",       name: "Vezeeta",      slug: "vezeeta",           country: COUNTRY, countryFlag: FLAG, city: "Cairo" },
    { ats: "breezy",         name: "MaxAB",        slug: "maxab",             country: COUNTRY, countryFlag: FLAG, city: "Cairo" },

    // ── Added: Fintech / High-tech Egypt ───────────────────────────────────
    { ats: "greenhouse",     name: "Paymob",       slug: "paymob",            country: COUNTRY, countryFlag: FLAG, city: "Cairo" },
    { ats: "lever",          name: "Halan",        slug: "halan",             country: COUNTRY, countryFlag: FLAG, city: "Cairo" },
    { ats: "greenhouse",     name: "Breadfast",    slug: "breadfast",         country: COUNTRY, countryFlag: FLAG, city: "Cairo" },
    { ats: "workable",       name: "NearPay",      slug: "nearpay",           country: COUNTRY, countryFlag: FLAG, city: "Cairo" },
    { ats: "workable",       name: "Lean Technologies", slug: "leantech",     country: COUNTRY, countryFlag: FLAG, city: "Cairo" },
    { ats: "greenhouse",     name: "Khazna",       slug: "khazna",            country: COUNTRY, countryFlag: FLAG, city: "Cairo" },
    { ats: "lever",          name: "Trella",       slug: "trella",            country: COUNTRY, countryFlag: FLAG, city: "Cairo" },

    // ── Server-side / Down (cannot scrape) ───────────────────────────────
    // Objects      → server-side rendered
    // Trianglz     → server-side rendered
    // SoftXpert    → Zoho Recruit, server-side
    // Enozom       → server-side (also no openings currently)
    // Innova       → API currently down
];

// ── Companies with custom fetchers (non-standard ATS) ────────────────────────
// Giza Systems, Bright Skies, Pharos use custom endpoints (see ats-utils.ts)

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
    // ── Custom fetchers (non-standard ATS) ──────────────────────────────────
    const customFetchers = [
        fetchGizaSystems(MODE),
        fetchBrightSkies(MODE),
        fetchPharos(MODE),
    ];
    const customResults = await Promise.allSettled(customFetchers);
    for (const r of customResults) {
        if (r.status === "fulfilled") {
            for (const j of r.value) {
                if (!seen.has(j.id)) { seen.add(j.id); all.push(j); }
            }
        } else {
            console.error("[local] Custom fetcher error:", r.reason);
        }
    }

    console.log(`[local] Total: ${all.length} jobs`);
    return all;
}
