// src/lib/sources/companies.ts
import type { Job } from "../types";
import { fetchGreenhouse, fetchLever, fetchAshby, fetchWorkable, fetchTeamtailor, fetchBreezy, fetchSmartRecruiters, type ATSConfig, resetWorkableUsed } from "./ats-utils";

const MODE = "visa";
const VISA = true;

const COMPANIES: ATSConfig[] = [
  // ── Stable Core (Verified Greenhouse) ───────────────────────────────────
  { ats: "greenhouse",     name: "Contentful",     slug: "contentful",       country: "Germany",      countryFlag: "🇩🇪" },
  { ats: "greenhouse",     name: "N26",             slug: "n26",              country: "Germany",      countryFlag: "🇩🇪" },
  { ats: "greenhouse",     name: "SumUp",           slug: "sumup",            country: "Germany",      countryFlag: "🇩🇪" },
  { ats: "greenhouse",     name: "Babbel",          slug: "babbel",           country: "Germany",      countryFlag: "🇩🇪" },
  { ats: "greenhouse",     name: "Adyen",           slug: "adyen",            country: "Netherlands",  countryFlag: "🇳🇱" },
  { ats: "greenhouse",     name: "Elastic",         slug: "elastic",          country: "Netherlands",  countryFlag: "🇳🇱" },
  { ats: "greenhouse",     name: "Monzo",           slug: "monzo",            country: "UK",           countryFlag: "🇬🇧" },
  { ats: "greenhouse",     name: "Intercom",        slug: "intercom",         country: "Ireland",      countryFlag: "🇮🇪" },
  { ats: "greenhouse",     name: "Stripe",          slug: "stripe",           country: "Global",       countryFlag: "🌍" },
  { ats: "greenhouse",     name: "Wallapop",        slug: "wallapop",         country: "Spain",        countryFlag: "🇪🇸" },
  { ats: "greenhouse",     name: "Pleo",            slug: "pleo",             country: "Denmark",      countryFlag: "🇩🇰" },
  { ats: "greenhouse",     name: "Wolt",            slug: "wolt",             country: "Finland",      countryFlag: "🇫🇮" },
  { ats: "greenhouse",     name: "Doctolib",        slug: "doctolib",         country: "France",       countryFlag: "🇫🇷" },
  { ats: "greenhouse",     name: "Pipedrive",       slug: "pipedrive",        country: "Estonia",      countryFlag: "🇪🇪" },
  { ats: "greenhouse",     name: "Zenjob",         slug: "zenjob",          country: "Germany",      countryFlag: "🇩🇪" },
  { ats: "greenhouse",     name: "Solarisbank",    slug: "solarisbank",     country: "Germany",      countryFlag: "🇩🇪" },
  { ats: "greenhouse",     name: "GoCardless",     slug: "gocardless",      country: "UK",           countryFlag: "🇬🇧" },
  { ats: "greenhouse",     name: "Catawiki",       slug: "catawiki",        country: "Netherlands",  countryFlag: "🇳🇱" },
  { ats: "greenhouse",     name: "Scandit",        slug: "scandit",         country: "Switzerland",  countryFlag: "🇨🇭" },
  { ats: "greenhouse",     name: "Feedzai",        slug: "feedzai",         country: "Portugal",     countryFlag: "🇵🇹" },
  { ats: "greenhouse",     name: "Squarespace",    slug: "squarespace",     country: "Ireland",      countryFlag: "🇮🇪" },

  // ── Stable Core (Verified Ashby) ────────────────────────────────────────
  { ats: "ashby",          name: "Mollie",          slug: "mollie",           country: "Netherlands",  countryFlag: "🇳🇱" },

  // ── Stable Core (Verified Workable) ─────────────────────────────────────
  { ats: "workable",       name: "Moonfare",        slug: "moonfare",         country: "Germany",      countryFlag: "🇩🇪" },
];

export async function fetchCompanyJobs(): Promise<Job[]> {
  resetWorkableUsed(MODE);
  const results = await Promise.allSettled(
    COMPANIES.map(c => {
      switch (c.ats) {
        case "greenhouse":     return fetchGreenhouse(c, MODE, VISA);
        case "lever":          return fetchLever(c, MODE, VISA);
        case "ashby":          return fetchAshby(c, MODE, VISA);
        case "workable":       return fetchWorkable(c, MODE, VISA);
        case "teamtailor":     return fetchTeamtailor(c, MODE, VISA);
        case "breezy":         return fetchBreezy(c, MODE, VISA);
        case "smartrecruiters": return fetchSmartRecruiters(c, MODE, VISA);
        default: return Promise.resolve([] as Job[]);
      }
    }),
  );

  const all: Job[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") all.push(...r.value);
    else console.error("[visa] Unhandled rejection:", r.reason);
  }
  console.log(`[visa] Total: ${all.length} jobs`);
  return all;
}
