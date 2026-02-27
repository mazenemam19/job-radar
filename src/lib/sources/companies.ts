// src/lib/sources/companies.ts
import type { Job } from "../types";
import { fetchGreenhouse, fetchLever, fetchAshby, fetchWorkable, fetchTeamtailor, fetchBreezy, fetchSmartRecruiters, type ATSConfig } from "./ats-utils";

const MODE = "visa";
const VISA = true;

const COMPANIES: ATSConfig[] = [
  // ── 🇩🇪 Germany ────────────────────────────────────────────────────────────
  { ats: "greenhouse",     name: "Contentful",     slug: "contentful",       country: "Germany",      countryFlag: "🇩🇪" },
  { ats: "greenhouse",     name: "N26",             slug: "n26",              country: "Germany",      countryFlag: "🇩🇪" },
  { ats: "greenhouse",     name: "SumUp",           slug: "sumup",            country: "Germany",      countryFlag: "🇩🇪" },
  { ats: "greenhouse",     name: "Babbel",          slug: "babbel",           country: "Germany",      countryFlag: "🇩🇪" },
  { ats: "lever",          name: "GetYourGuide",    slug: "getyourguide",     country: "Germany",      countryFlag: "🇩🇪" },
  { ats: "lever",          name: "Tourlane",        slug: "tourlane",         country: "Germany",      countryFlag: "🇩🇪" },
  { ats: "lever",          name: "Taxfix",          slug: "taxfix",           country: "Germany",      countryFlag: "🇩🇪" },
  { ats: "lever",          name: "Planetly",        slug: "planetly",         country: "Germany",      countryFlag: "🇩🇪" },
  { ats: "workable",       name: "Moonfare",        slug: "moonfare",         country: "Germany",      countryFlag: "🇩🇪" },

  // ── 🇳🇱 Netherlands ─────────────────────────────────────────────────────────
  { ats: "greenhouse",     name: "Adyen",           slug: "adyen",            country: "Netherlands",  countryFlag: "🇳🇱" },
  { ats: "ashby",          name: "Mollie",          slug: "mollie",           country: "Netherlands",  countryFlag: "🇳🇱" },
  { ats: "lever",          name: "TomTom",          slug: "tomtom",           country: "Netherlands",  countryFlag: "🇳🇱" },
  { ats: "greenhouse",     name: "Elastic",         slug: "elastic",          country: "Netherlands",  countryFlag: "🇳🇱" },
  { ats: "greenhouse",     name: "Messagebird",     slug: "bird",             country: "Netherlands",  countryFlag: "🇳🇱" },

  // ── 🇬🇧 United Kingdom ──────────────────────────────────────────────────────
  { ats: "greenhouse",     name: "Monzo",           slug: "monzo",            country: "UK",           countryFlag: "🇬🇧" },
  { ats: "ashby",          name: "Wise",            slug: "wise",             country: "UK",           countryFlag: "🇬🇧" },
  { ats: "greenhouse",     name: "Deliveroo",       slug: "deliveroouk",      country: "UK",           countryFlag: "🇬🇧" },
  { ats: "teamtailor",     name: "Multiverse",      slug: "multiverse",       country: "UK",           countryFlag: "🇬🇧" },
  { ats: "ashby",          name: "Octopus Energy",  slug: "octopusenergy",    country: "UK",           countryFlag: "🇬🇧" },
  { ats: "ashby",          name: "Marshmallow",     slug: "marshmallow",      country: "UK",           countryFlag: "🇬🇧" },

  // ── 🇮🇪 Ireland ─────────────────────────────────────────────────────────────
  { ats: "greenhouse",     name: "Intercom",        slug: "intercom",         country: "Ireland",      countryFlag: "🇮🇪" },
  { ats: "greenhouse",     name: "HubSpot",         slug: "hubspot",          country: "Ireland",      countryFlag: "🇮🇪" },
  { ats: "greenhouse",     name: "Stripe",          slug: "stripe",           country: "Global",       countryFlag: "🌍" },

  // ── 🇪🇸 Spain ───────────────────────────────────────────────────────────────
  { ats: "greenhouse",     name: "Typeform",        slug: "typeform",         country: "Spain",        countryFlag: "🇪🇸" },
  { ats: "smartrecruiters",name: "Glovo",           slug: "glovo",            country: "Spain",        countryFlag: "🇪🇸" },
  { ats: "greenhouse",     name: "Wallapop",        slug: "wallapop",         country: "Spain",        countryFlag: "🇪🇸" },
  { ats: "workable",       name: "Factorial",       slug: "factorialhr",      country: "Spain",        countryFlag: "🇪🇸" },
  { ats: "lever",          name: "Holded",          slug: "holded",           country: "Spain",        countryFlag: "🇪🇸" },
  { ats: "lever",          name: "Outvio",          slug: "outvio",           country: "Spain",        countryFlag: "🇪🇸" },

  // ── 🇸🇪 Sweden ──────────────────────────────────────────────────────────────
  { ats: "ashby",          name: "Klarna",          slug: "klarna",           country: "Sweden",       countryFlag: "🇸🇪" },
  { ats: "smartrecruiters",name: "Spotify",         slug: "Spotify",          country: "Sweden",       countryFlag: "🇸🇪" },
  { ats: "smartrecruiters",name: "King",            slug: "King",             country: "Sweden",       countryFlag: "🇸🇪" },
  { ats: "ashby",          name: "iZettle / Zettle",slug: "zettle",           country: "Sweden",       countryFlag: "🇸🇪" },
  { ats: "ashby",          name: "Anyfin",          slug: "anyfin",           country: "Sweden",       countryFlag: "🇸🇪" },
  { ats: "ashby",          name: "Northvolt",       slug: "northvolt",        country: "Sweden",       countryFlag: "🇸🇪" },

  // ── 🇩🇰 Denmark ─────────────────────────────────────────────────────────────
  { ats: "greenhouse",     name: "Pleo",            slug: "pleo",             country: "Denmark",      countryFlag: "🇩🇰" },
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
  { ats: "ashby",          name: "Pipedrive",       slug: "pipedrive",        country: "Estonia",      countryFlag: "🇪🇪" },
  { ats: "workable",       name: "Printify",        slug: "printify",         country: "Latvia",       countryFlag: "🇱🇻" },
  { ats: "greenhouse",     name: "UiPath",          slug: "uipath-inc",       country: "Romania",      countryFlag: "🇷🇴" },
  { ats: "ashby",          name: "Bitrise",         slug: "bitrise",          country: "Hungary",      countryFlag: "🇭🇺" },
  { ats: "ashby",          name: "Lokalise",        slug: "lokalise",         country: "Latvia",       countryFlag: "🇱🇻" },


  // ── 🇩🇪 Germany (more) ──────────────────────────────────────────────────────
  { ats: "greenhouse",     name: "Zenjob",         slug: "zenjob",          country: "Germany",      countryFlag: "🇩🇪" },
  { ats: "greenhouse",     name: "Scalable Capital",slug: "scalablecapital",country: "Germany",      countryFlag: "🇩🇪" },
  { ats: "greenhouse",     name: "Solarisbank",    slug: "solarisbank",     country: "Germany",      countryFlag: "🇩🇪" },
  { ats: "greenhouse",     name: "Komoot",         slug: "komoot",          country: "Germany",      countryFlag: "🇩🇪" },
  { ats: "workable",       name: "Usercentrics",   slug: "usercentrics",    country: "Germany",      countryFlag: "🇩🇪" },
  { ats: "ashby",          name: "Moss",           slug: "getmoss",         country: "Germany",      countryFlag: "🇩🇪" },
  { ats: "ashby",          name: "Flink",          slug: "flink-2",         country: "Germany",      countryFlag: "🇩🇪" },

  // ── 🇳🇱 Netherlands (more) ──────────────────────────────────────────────────
  { ats: "greenhouse",     name: "Sendcloud",      slug: "sendcloud",       country: "Netherlands",  countryFlag: "🇳🇱" },
  { ats: "greenhouse",     name: "Catawiki",       slug: "catawiki",        country: "Netherlands",  countryFlag: "🇳🇱" },
  { ats: "ashby",          name: "Picnic",         slug: "picnic",          country: "Netherlands",  countryFlag: "🇳🇱" },
  { ats: "ashby",          name: "Mews",           slug: "mews",            country: "Netherlands",  countryFlag: "🇳🇱" },
  { ats: "ashby",          name: "Channable",      slug: "channable",       country: "Netherlands",  countryFlag: "🇳🇱" },

  // ── 🇬🇧 United Kingdom (more) ───────────────────────────────────────────────
  { ats: "greenhouse",     name: "Farfetch",       slug: "farfetch",        country: "UK",           countryFlag: "🇬🇧" },
  { ats: "greenhouse",     name: "GoCardless",     slug: "gocardless",      country: "UK",           countryFlag: "🇬🇧" },
  { ats: "ashby",          name: "Checkout.com",   slug: "checkout-com",    country: "UK",           countryFlag: "🇬🇧" },
  { ats: "ashby",          name: "ManyPets",       slug: "manypets",        country: "UK",           countryFlag: "🇬🇧" },
  { ats: "ashby",          name: "Paysend",        slug: "paysend",         country: "UK",           countryFlag: "🇬🇧" },
  { ats: "ashby",          name: "Beams",          slug: "beams",           country: "UK",           countryFlag: "🇬🇧" },

  // ── 🇮🇪 Ireland (more) ──────────────────────────────────────────────────────
  { ats: "greenhouse",     name: "Squarespace",    slug: "squarespace",     country: "Ireland",      countryFlag: "🇮🇪" },
  { ats: "ashby",          name: "Shopify",        slug: "shopify",         country: "Ireland",      countryFlag: "🇮🇪" },
  { ats: "ashby",          name: "Flipdish",       slug: "flipdish",        country: "Ireland",      countryFlag: "🇮🇪" },

  // ── 🇵🇹 Portugal ────────────────────────────────────────────────────────────
  { ats: "greenhouse",     name: "Feedzai",        slug: "feedzai",         country: "Portugal",     countryFlag: "🇵🇹" },
  { ats: "teamtailor",     name: "Unbabel",         slug: "unbabel",          country: "Portugal",     countryFlag: "🇵🇹" },
  { ats: "lever",          name: "Daltix",         slug: "daltix",          country: "Portugal",     countryFlag: "🇵🇹" },
  { ats: "workable",       name: "Infraspeak",     slug: "infraspeak",      country: "Portugal",     countryFlag: "🇵🇹" },

  // ── 🇮🇹 Italy ────────────────────────────────────────────────────────────────
  { ats: "greenhouse",     name: "Prima",          slug: "prima",           country: "Italy",        countryFlag: "🇮🇹" },
  { ats: "lever",          name: "Satispay",       slug: "satispay",        country: "Italy",        countryFlag: "🇮🇹" },
  { ats: "workable",       name: "Bending Spoons", slug: "bendingspoons",   country: "Italy",        countryFlag: "🇮🇹" },

  // ── 🇨🇭 Switzerland ──────────────────────────────────────────────────────────
  { ats: "greenhouse",     name: "Scandit",        slug: "scandit",         country: "Switzerland",  countryFlag: "🇨🇭" },
  { ats: "greenhouse",     name: "GetSafe",        slug: "getsafe",         country: "Switzerland",  countryFlag: "🇨🇭" },
  { ats: "lever",          name: "Yokoy",          slug: "yokoy",           country: "Switzerland",  countryFlag: "🇨🇭" },

  // ── 🇸🇪 Sweden (more) ───────────────────────────────────────────────────────
  { ats: "greenhouse",     name: "Voi",            slug: "voi",             country: "Sweden",       countryFlag: "🇸🇪" },
  { ats: "teamtailor",     name: "Hemnet",          slug: "hemnet",           country: "Sweden",       countryFlag: "🇸🇪" },
  { ats: "lever",          name: "Quinyx",         slug: "quinyx",          country: "Sweden",       countryFlag: "🇸🇪" },
  { ats: "workable",       name: "Mentimeter",     slug: "mentimeter",      country: "Sweden",       countryFlag: "🇸🇪" },

  // ── 🇩🇰 Denmark (more) ──────────────────────────────────────────────────────
  { ats: "workable",       name: "Adapto",         slug: "adapto",          country: "Denmark",      countryFlag: "🇩🇰" },
  { ats: "lever",          name: "Dinero",         slug: "dinero",          country: "Denmark",      countryFlag: "🇩🇰" },

  // ── 🇫🇷 France (more) ───────────────────────────────────────────────────────
  { ats: "greenhouse",     name: "ManoMano",       slug: "manomano",        country: "France",       countryFlag: "🇫🇷" },
  { ats: "greenhouse",     name: "Alan",           slug: "alan",            country: "France",       countryFlag: "🇫🇷" },
  { ats: "lever",          name: "Lydia",          slug: "lydia",           country: "France",       countryFlag: "🇫🇷" },
  { ats: "lever",          name: "Qonto",          slug: "qonto",           country: "France",       countryFlag: "🇫🇷" },
  { ats: "workable",       name: "Spendesk",       slug: "spendesk",        country: "France",       countryFlag: "🇫🇷" },
  { ats: "workable",       name: "Alma",           slug: "alma",            country: "France",       countryFlag: "🇫🇷" },

  // ── 🇪🇺 Other EU (more) ─────────────────────────────────────────────────────
  { ats: "greenhouse",     name: "Vinted",         slug: "vinted",          country: "Lithuania",    countryFlag: "🇱🇹" },
  { ats: "ashby",          name: "Bolt",           slug: "bolt-eu",         country: "Estonia",      countryFlag: "🇪🇪" },
  { ats: "teamtailor",     name: "Deezer",          slug: "deezer",           country: "France",       countryFlag: "🇫🇷" },
  { ats: "ashby",          name: "Voucherify",     slug: "voucherify",      country: "Poland",       countryFlag: "🇵🇱" },
  { ats: "ashby",          name: "Tidio",          slug: "tidio",           country: "Poland",       countryFlag: "🇵🇱" },
  { ats: "workable",       name: "Aircall",        slug: "aircall",         country: "France",       countryFlag: "🇫🇷" },
  { ats: "ashby",          name: "Travelperk",     slug: "travelperk",      country: "Spain",        countryFlag: "🇪🇸" },
  { ats: "ashby",          name: "Carto",          slug: "carto",           country: "Spain",        countryFlag: "🇪🇸" },
  { ats: "workable",       name: "Bdeo",           slug: "bdeo",            country: "Spain",        countryFlag: "🇪🇸" },

  // ── 🌍 Global remote — strong visa sponsors ──────────────────────────────────
  { ats: "greenhouse",     name: "GitLab",          slug: "gitlab",           country: "Global",       countryFlag: "🌍" },
  { ats: "greenhouse",     name: "Speechify",       slug: "speechify",        country: "USA",          countryFlag: "🇺🇸" },
  { ats: "ashby",          name: "Deel",            slug: "deel",             country: "Global",       countryFlag: "🌍" },
  { ats: "ashby",          name: "Remote.com",      slug: "remote-com",       country: "Global",       countryFlag: "🌍" },
  { ats: "ashby",          name: "Doist",           slug: "doist",            country: "Global",       countryFlag: "🌍" },
  { ats: "ashby",          name: "Hotjar",          slug: "hotjar",           country: "Global",       countryFlag: "🌍" },
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
