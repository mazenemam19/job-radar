// src/lib/sources/companies.ts
import type { Job } from "../types";
import { fetchGreenhouse, fetchLever, fetchAshby, fetchWorkable, fetchTeamtailor, fetchBreezy, fetchSmartRecruiters, type ATSConfig } from "./ats-utils";

const MODE = "visa";
const VISA = true;

const COMPANIES: ATSConfig[] = [
  // ── 🇩🇪 Germany ────────────────────────────────────────────────────────────
  { ats: "greenhouse",     name: "Contentful",     slug: "contentful",       country: "Germany",      countryFlag: "🇩🇪" },
  { ats: "greenhouse",     name: "N26",             slug: "n26",              country: "Germany",      countryFlag: "🇩🇪" },
  { ats: "greenhouse",     name: "Zalando",         slug: "zalando",          country: "Germany",      countryFlag: "🇩🇪" },
  { ats: "greenhouse",     name: "SumUp",           slug: "sumup",            country: "Germany",      countryFlag: "🇩🇪" },
  { ats: "greenhouse",     name: "Personio",        slug: "personio",         country: "Germany",      countryFlag: "🇩🇪" },
  { ats: "greenhouse",     name: "Babbel",          slug: "babbel",           country: "Germany",      countryFlag: "🇩🇪" },
  { ats: "greenhouse",     name: "Flixbus",         slug: "flixbus",          country: "Germany",      countryFlag: "🇩🇪" },
  { ats: "lever",          name: "GetYourGuide",    slug: "getyourguide",     country: "Germany",      countryFlag: "🇩🇪" },
  { ats: "lever",          name: "Tourlane",        slug: "tourlane",         country: "Germany",      countryFlag: "🇩🇪" },
  { ats: "lever",          name: "Taxfix",          slug: "taxfix",           country: "Germany",      countryFlag: "🇩🇪" },
  { ats: "lever",          name: "Planetly",        slug: "planetly",         country: "Germany",      countryFlag: "🇩🇪" },
  { ats: "ashby",          name: "Pitch",           slug: "pitch",            country: "Germany",      countryFlag: "🇩🇪" },
  { ats: "ashby",          name: "Lano",            slug: "lano",             country: "Germany",      countryFlag: "🇩🇪" },
  { ats: "workable",       name: "Moonfare",        slug: "moonfare",         country: "Germany",      countryFlag: "🇩🇪" },

  // ── 🇳🇱 Netherlands ─────────────────────────────────────────────────────────
  { ats: "greenhouse",     name: "Adyen",           slug: "adyen",            country: "Netherlands",  countryFlag: "🇳🇱" },
  { ats: "greenhouse",     name: "Mollie",          slug: "mollie",           country: "Netherlands",  countryFlag: "🇳🇱" },
  { ats: "greenhouse",     name: "Booking.com",     slug: "bookingcom",       country: "Netherlands",  countryFlag: "🇳🇱" },
  { ats: "greenhouse",     name: "TomTom",          slug: "tomtom",           country: "Netherlands",  countryFlag: "🇳🇱" },
  { ats: "greenhouse",     name: "WeTransfer",      slug: "wetransfer",       country: "Netherlands",  countryFlag: "🇳🇱" },
  { ats: "ashby",          name: "Elastic",         slug: "elastic",          country: "Netherlands",  countryFlag: "🇳🇱" },
  { ats: "lever",          name: "Messagebird",     slug: "messagebird",      country: "Netherlands",  countryFlag: "🇳🇱" },

  // ── 🇬🇧 United Kingdom ──────────────────────────────────────────────────────
  { ats: "greenhouse",     name: "Monzo",           slug: "monzo",            country: "UK",           countryFlag: "🇬🇧" },
  { ats: "greenhouse",     name: "Revolut",         slug: "revolut",          country: "UK",           countryFlag: "🇬🇧" },
  { ats: "greenhouse",     name: "Wise",            slug: "wise",             country: "UK",           countryFlag: "🇬🇧" },
  { ats: "greenhouse",     name: "Deliveroo",       slug: "deliveroo",        country: "UK",           countryFlag: "🇬🇧" },
  { ats: "greenhouse",     name: "Multiverse",      slug: "multiverse",       country: "UK",           countryFlag: "🇬🇧" },
  { ats: "greenhouse",     name: "Octopus Energy",  slug: "octopusenergy",    country: "UK",           countryFlag: "🇬🇧" },
  { ats: "greenhouse",     name: "FutureLearn",     slug: "futurelearn",      country: "UK",           countryFlag: "🇬🇧" },
  { ats: "ashby",          name: "Cleo",            slug: "meetcleo",         country: "UK",           countryFlag: "🇬🇧" },
  { ats: "ashby",          name: "Marshmallow",     slug: "marshmallow",      country: "UK",           countryFlag: "🇬🇧" },
  { ats: "lever",          name: "Cazoo",           slug: "cazoo",            country: "UK",           countryFlag: "🇬🇧" },
  { ats: "lever",          name: "Thread",          slug: "thread",           country: "UK",           countryFlag: "🇬🇧" },

  // ── 🇮🇪 Ireland ─────────────────────────────────────────────────────────────
  { ats: "greenhouse",     name: "Intercom",        slug: "intercom",         country: "Ireland",      countryFlag: "🇮🇪" },
  { ats: "greenhouse",     name: "HubSpot",         slug: "hubspot",          country: "Ireland",      countryFlag: "🇮🇪" },
  { ats: "greenhouse",     name: "Stripe",          slug: "stripe",           country: "Ireland",      countryFlag: "🇮🇪" },
  { ats: "greenhouse",     name: "Workday",         slug: "workday",          country: "Ireland",      countryFlag: "🇮🇪" },

  // ── 🇪🇸 Spain ───────────────────────────────────────────────────────────────
  { ats: "greenhouse",     name: "Typeform",        slug: "typeform",         country: "Spain",        countryFlag: "🇪🇸" },
  { ats: "greenhouse",     name: "Glovo",           slug: "glovo",            country: "Spain",        countryFlag: "🇪🇸" },
  { ats: "greenhouse",     name: "Wallapop",        slug: "wallapop",         country: "Spain",        countryFlag: "🇪🇸" },
  { ats: "workable",       name: "Factorial",       slug: "factorialhr",      country: "Spain",        countryFlag: "🇪🇸" },
  { ats: "lever",          name: "Holded",          slug: "holded",           country: "Spain",        countryFlag: "🇪🇸" },
  { ats: "lever",          name: "Outvio",          slug: "outvio",           country: "Spain",        countryFlag: "🇪🇸" },

  // ── 🇸🇪 Sweden ──────────────────────────────────────────────────────────────
  { ats: "greenhouse",     name: "Klarna",          slug: "klarna",           country: "Sweden",       countryFlag: "🇸🇪" },
  { ats: "greenhouse",     name: "Spotify",         slug: "spotify",          country: "Sweden",       countryFlag: "🇸🇪" },
  { ats: "greenhouse",     name: "King",            slug: "king",             country: "Sweden",       countryFlag: "🇸🇪" },
  { ats: "greenhouse",     name: "iZettle",         slug: "izettle",          country: "Sweden",       countryFlag: "🇸🇪" },
  { ats: "lever",          name: "Anyfin",          slug: "anyfin",           country: "Sweden",       countryFlag: "🇸🇪" },
  { ats: "ashby",          name: "Northvolt",       slug: "northvolt",        country: "Sweden",       countryFlag: "🇸🇪" },

  // ── 🇩🇰 Denmark ─────────────────────────────────────────────────────────────
  { ats: "greenhouse",     name: "Pleo",            slug: "pleo",             country: "Denmark",      countryFlag: "🇩🇰" },
  { ats: "greenhouse",     name: "Zendesk",         slug: "zendesk",          country: "Denmark",      countryFlag: "🇩🇰" },
  { ats: "lever",          name: "Templafy",        slug: "templafy",         country: "Denmark",      countryFlag: "🇩🇰" },
  { ats: "workable",       name: "Contractbook",    slug: "contractbook",     country: "Denmark",      countryFlag: "🇩🇰" },

  // ── 🇫🇮 Finland ─────────────────────────────────────────────────────────────
  { ats: "greenhouse",     name: "Wolt",            slug: "wolt",             country: "Finland",      countryFlag: "🇫🇮" },

  // ── 🇵🇱 Poland ──────────────────────────────────────────────────────────────
  { ats: "greenhouse",     name: "Brainly",         slug: "brainly",          country: "Poland",       countryFlag: "🇵🇱" },
  { ats: "lever",          name: "Packhelp",        slug: "packhelp",         country: "Poland",       countryFlag: "🇵🇱" },

  // ── 🇫🇷 France ──────────────────────────────────────────────────────────────
  { ats: "greenhouse",     name: "Doctolib",        slug: "doctolib",         country: "France",       countryFlag: "🇫🇷" },
  { ats: "greenhouse",     name: "Ledger",          slug: "ledger",           country: "France",       countryFlag: "🇫🇷" },
  { ats: "lever",          name: "Pennylane",       slug: "pennylane",        country: "France",       countryFlag: "🇫🇷" },
  { ats: "lever",          name: "Swile",           slug: "swile",            country: "France",       countryFlag: "🇫🇷" },

  // ── 🇪🇺 Other EU ─────────────────────────────────────────────────────────────
  { ats: "greenhouse",     name: "Pipedrive",       slug: "pipedrive",        country: "Estonia",      countryFlag: "🇪🇪" },
  { ats: "greenhouse",     name: "Skype/Microsoft", slug: "microsoft",        country: "Estonia",      countryFlag: "🇪🇪" },
  { ats: "lever",          name: "Printify",        slug: "printify",         country: "Latvia",       countryFlag: "🇱🇻" },
  { ats: "greenhouse",     name: "UiPath",          slug: "uipath",           country: "Romania",      countryFlag: "🇷🇴" },
  { ats: "greenhouse",     name: "Bitrise",         slug: "bitrise",          country: "Hungary",      countryFlag: "🇭🇺" },
  { ats: "greenhouse",     name: "Lokalise",        slug: "lokalise",         country: "Latvia",       countryFlag: "🇱🇻" },

  // ── 🌍 Global remote — strong visa sponsors ──────────────────────────────────
  { ats: "greenhouse",     name: "GitLab",          slug: "gitlab",           country: "Global",       countryFlag: "🌍" },
  { ats: "greenhouse",     name: "Speechify",       slug: "speechify",        country: "USA",          countryFlag: "🇺🇸" },
  { ats: "greenhouse",     name: "Deel",            slug: "deel",             country: "Global",       countryFlag: "🌍" },
  { ats: "ashby",          name: "Remote.com",      slug: "remote",           country: "Global",       countryFlag: "🌍" },
  { ats: "lever",          name: "Doist",           slug: "doist",            country: "Global",       countryFlag: "🌍" },
  { ats: "lever",          name: "Hotjar",          slug: "hotjar",           country: "Global",       countryFlag: "🌍" },
];

export async function fetchCompanyJobs(): Promise<Job[]> {
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
