// src/lib/sources/global-companies.ts
// "Global Remote" pipeline — worldwide companies that genuinely accept Egypt/GMT+2 applicants.
// Filter logic rejects: US-timezone-only, must-be-authorized-in-country, EU-resident-only.
// Accepts: worldwide, global remote, EMEA, no timezone restriction.

import type { Job } from "../types";
import { fetchGreenhouse, fetchLever, fetchAshby, fetchWorkable, type ATSConfig } from "./ats-utils";

const MODE = "global";
const VISA = false;

// ── Company list ────────────────────────────────────────────────────────────
// These are globally remote-friendly companies known to hire from EMEA/worldwide.
// Add more as you discover them — same ATS slug approach as other pipelines.
const COMPANIES: ATSConfig[] = [
    // Greenhouse
    { ats: "greenhouse", name: "Automattic", slug: "automattic", country: "Global", countryFlag: "🌍" },
    { ats: "greenhouse", name: "GitLab", slug: "gitlab", country: "Global", countryFlag: "🌍" },
    { ats: "greenhouse", name: "Hotjar", slug: "hotjar", country: "Global", countryFlag: "🌍" },
    { ats: "greenhouse", name: "Spreedly", slug: "spreedly", country: "Global", countryFlag: "🌍" },

    // Lever
    { ats: "lever", name: "Doist", slug: "doist", country: "Global", countryFlag: "🌍" },
    { ats: "lever", name: "Whereby", slug: "whereby", country: "Global", countryFlag: "🌍" },

    // Ashby
    { ats: "ashby", name: "Remote.com", slug: "remote", country: "Global", countryFlag: "🌍" },
    { ats: "ashby", name: "Loom", slug: "loom", country: "Global", countryFlag: "🌍" },

    // Workable
    { ats: "workable", name: "Typeform", slug: "typeform", country: "Global", countryFlag: "🌍" },

    // ── Add more companies here as you research them ────────────────────────
    // Pattern: { ats: "greenhouse"|"lever"|"ashby"|"workable", name: "...", slug: "...", country: "Global", countryFlag: "🌍" }
];

export async function fetchGlobalJobs(): Promise<Job[]> {
    const results = await Promise.allSettled(
        COMPANIES.map(c => {
            switch (c.ats) {
                case "greenhouse": return fetchGreenhouse(c, MODE, VISA);
                case "lever": return fetchLever(c, MODE, VISA);
                case "ashby": return fetchAshby(c, MODE, VISA);
                case "workable": return fetchWorkable(c, MODE, VISA);
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
            console.error("[global] Unhandled rejection:", r.reason);
        }
    }
    console.log(`[global] Total: ${all.length} jobs`);
    return all;
}
