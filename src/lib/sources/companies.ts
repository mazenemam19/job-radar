// src/lib/sources/companies.ts
import type { Job } from "../types";
import { fetchGreenhouse, fetchLever, fetchAshby, fetchWorkable, fetchTeamtailor, fetchBreezy, fetchSmartRecruiters, type ATSConfig } from "./ats-utils";

const MODE = "visa";
const VISA = true;

const COMPANIES: ATSConfig[] = [
  // ── 🇩🇪 Germany ─────────────────────────────────────────────────────────────
  { ats: "greenhouse", name: "Contentful",      slug: "contentful",     country: "Germany",     countryFlag: "🇩🇪" },
  { ats: "greenhouse", name: "N26",             slug: "n26",            country: "Germany",     countryFlag: "🇩🇪" },
  { ats: "greenhouse", name: "SumUp",           slug: "sumup",          country: "Germany",     countryFlag: "🇩🇪" },
  { ats: "greenhouse", name: "Babbel",          slug: "babbel",         country: "Germany",     countryFlag: "🇩🇪" },
  { ats: "greenhouse", name: "Zenjob",          slug: "zenjob",         country: "Germany",     countryFlag: "🇩🇪" },
  { ats: "greenhouse", name: "Solarisbank",     slug: "solarisbank",    country: "Germany",     countryFlag: "🇩🇪" },
  { ats: "workable",   name: "Usercentrics",    slug: "usercentrics",   country: "Germany",     countryFlag: "🇩🇪" },
  { ats: "workable",   name: "Moonfare",        slug: "moonfare",       country: "Germany",     countryFlag: "🇩🇪" },

  // ── 🇳🇱 Netherlands ──────────────────────────────────────────────────────────
  { ats: "greenhouse", name: "Adyen",           slug: "adyen",          country: "Netherlands", countryFlag: "🇳🇱" },
  { ats: "ashby",      name: "Mollie",          slug: "mollie",         country: "Netherlands", countryFlag: "🇳🇱" },
  { ats: "greenhouse", name: "Elastic",         slug: "elastic",        country: "Netherlands", countryFlag: "🇳🇱" },
  { ats: "greenhouse", name: "Messagebird",     slug: "bird",           country: "Netherlands", countryFlag: "🇳🇱" },
  { ats: "greenhouse", name: "Sendcloud",       slug: "sendcloud",      country: "Netherlands", countryFlag: "🇳🇱" },
  { ats: "greenhouse", name: "Catawiki",        slug: "catawiki",       country: "Netherlands", countryFlag: "🇳🇱" },

  // ── 🇬🇧 United Kingdom ───────────────────────────────────────────────────────
  { ats: "greenhouse", name: "Monzo",           slug: "monzo",          country: "UK",          countryFlag: "🇬🇧" },
  { ats: "greenhouse", name: "GoCardless",      slug: "gocardless",     country: "UK",          countryFlag: "🇬🇧" },
  { ats: "ashby",      name: "Marshmallow",     slug: "marshmallow",    country: "UK",          countryFlag: "🇬🇧" },

  // ── 🇮🇪 Ireland ──────────────────────────────────────────────────────────────
  { ats: "greenhouse", name: "Intercom",        slug: "intercom",       country: "Ireland",     countryFlag: "🇮🇪" },
  { ats: "greenhouse", name: "HubSpot",         slug: "hubspot",        country: "Ireland",     countryFlag: "🇮🇪" },
  { ats: "greenhouse", name: "Stripe",          slug: "stripe",         country: "Global",      countryFlag: "🌍" },
  { ats: "greenhouse", name: "Squarespace",     slug: "squarespace",    country: "Ireland",     countryFlag: "🇮🇪" },

  // ── 🇪🇸 Spain ────────────────────────────────────────────────────────────────
  { ats: "greenhouse", name: "Typeform",        slug: "typeform",       country: "Spain",       countryFlag: "🇪🇸" },
  { ats: "greenhouse", name: "Wallapop",        slug: "wallapop",       country: "Spain",       countryFlag: "🇪🇸" },
  { ats: "smartrecruiters", name: "Glovo",      slug: "glovo",          country: "Spain",       countryFlag: "🇪🇸" },
  { ats: "workable",   name: "Factorial",       slug: "factorialhr",    country: "Spain",       countryFlag: "🇪🇸" },

  // ── 🇸🇪 Sweden ───────────────────────────────────────────────────────────────
  { ats: "smartrecruiters", name: "Spotify",    slug: "Spotify",        country: "Sweden",      countryFlag: "🇸🇪" },
  { ats: "smartrecruiters", name: "King",       slug: "King",           country: "Sweden",      countryFlag: "🇸🇪" },
  { ats: "workable",   name: "Mentimeter",      slug: "mentimeter",     country: "Sweden",      countryFlag: "🇸🇪" },

  // ── 🇩🇰 Denmark ──────────────────────────────────────────────────────────────
  { ats: "greenhouse", name: "Pleo",            slug: "pleo",           country: "Denmark",     countryFlag: "🇩🇰" },
  { ats: "workable",   name: "Contractbook",    slug: "contractbook",   country: "Denmark",     countryFlag: "🇩🇰" },

  // ── 🇫🇮 Finland ───────────────────────────────────────────────────────────────
  { ats: "greenhouse", name: "Wolt",            slug: "wolt",           country: "Finland",     countryFlag: "🇫🇮" },

  // ── 🇫🇷 France ───────────────────────────────────────────────────────────────
  { ats: "greenhouse", name: "Doctolib",        slug: "doctolib",       country: "France",      countryFlag: "🇫🇷" },
  { ats: "lever",      name: "Pennylane",       slug: "pennylane",      country: "France",      countryFlag: "🇫🇷" },
  { ats: "lever",      name: "Swile",           slug: "swile",          country: "France",      countryFlag: "🇫🇷" },
  { ats: "workable",   name: "Spendesk",        slug: "spendesk",       country: "France",      countryFlag: "🇫🇷" },
  { ats: "workable",   name: "Alma",            slug: "alma",           country: "France",      countryFlag: "🇫🇷" },
  { ats: "workable",   name: "Aircall",         slug: "aircall",        country: "France",      countryFlag: "🇫🇷" },

  // ── 🇵🇹 Portugal ─────────────────────────────────────────────────────────────
  { ats: "greenhouse", name: "Feedzai",         slug: "feedzai",        country: "Portugal",    countryFlag: "🇵🇹" },
  { ats: "workable",   name: "Infraspeak",      slug: "infraspeak",     country: "Portugal",    countryFlag: "🇵🇹" },

  // ── 🇨🇭 Switzerland ───────────────────────────────────────────────────────────
  { ats: "greenhouse", name: "Scandit",         slug: "scandit",        country: "Switzerland", countryFlag: "🇨🇭" },

  // ── 🇮🇹 Italy ─────────────────────────────────────────────────────────────────
  { ats: "workable",   name: "Bending Spoons",  slug: "bendingspoons",  country: "Italy",       countryFlag: "🇮🇹" },

  // ── 🌍 Global / strong visa sponsors ─────────────────────────────────────────
  { ats: "greenhouse", name: "GitLab",          slug: "gitlab",         country: "Global",      countryFlag: "🌍" },
  { ats: "ashby",      name: "Deel",            slug: "deel",           country: "Global",      countryFlag: "🌍" },
  { ats: "ashby",      name: "Doist",           slug: "doist",          country: "Global",      countryFlag: "🌍" },
  { ats: "greenhouse", name: "Speechify",       slug: "speechify",      country: "USA",         countryFlag: "🇺🇸" },
];

export async function fetchCompanyJobs(): Promise<Job[]> {
  const results = await Promise.allSettled(
    COMPANIES.map(c => {
      switch (c.ats) {
        case "greenhouse":      return fetchGreenhouse(c, MODE, VISA);
        case "lever":           return fetchLever(c, MODE, VISA);
        case "ashby":           return fetchAshby(c, MODE, VISA);
        case "workable":        return fetchWorkable(c, MODE, VISA);
        case "teamtailor":      return fetchTeamtailor(c, MODE, VISA);
        case "breezy":          return fetchBreezy(c, MODE, VISA);
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
