// src/lib/sources/local-companies.ts
import type { Job } from "../types";
import { fetchGreenhouse, fetchLever, fetchAshby, fetchWorkable, fetchTeamtailor, fetchBreezy, fetchSmartRecruiters, fetchBambooHR, fetchGizaSystems, fetchBrightSkies, fetchPharos, type ATSConfig } from "./ats-utils";

const COUNTRY = "Egypt";
const FLAG = "🇪🇬";
const MODE = "local";
const VISA = false;

const COMPANIES: ATSConfig[] = [
  // ── Product / Scale-ups ────────────────────────────────────────────────
  { ats: "ashby", name: "Bosta", slug: "bosta", country: COUNTRY, countryFlag: FLAG, city: "Cairo" },
  { ats: "ashby", name: "Thndr", slug: "thndr", country: COUNTRY, countryFlag: FLAG, city: "Cairo" },
  { ats: "workable", name: "Nawy", slug: "nawy-real-estate", country: COUNTRY, countryFlag: FLAG, city: "Cairo" },
  { ats: "smartrecruiters", name: "Yassir", slug: "YassirGmbh", country: COUNTRY, countryFlag: FLAG, city: "Cairo" },
  { ats: "workable", name: "Dubizzle", slug: "bayutdubizzle", country: COUNTRY, countryFlag: FLAG, city: "Cairo" },
  { ats: "bamboohr", name: "Instabug", slug: "instabug", country: COUNTRY, countryFlag: FLAG, city: "Cairo" },
  { ats: "workable", name: "Rubikal", slug: "rubikal", country: COUNTRY, countryFlag: FLAG, city: "Cairo" },
  { ats: "workable", name: "Blink22", slug: "blink22-3", country: COUNTRY, countryFlag: FLAG, city: "Cairo" },
  { ats: "workable", name: "Squadio", slug: "squadio23", country: COUNTRY, countryFlag: FLAG, city: "Cairo" },
  { ats: "workable", name: "Robusta", slug: "robusta", country: COUNTRY, countryFlag: FLAG, city: "Cairo" },
  { ats: "smartrecruiters", name: "Algoriza", slug: "Algoriza", country: COUNTRY, countryFlag: FLAG, city: "Cairo" },
  { ats: "workable", name: "Vezeeta", slug: "vezeeta", country: COUNTRY, countryFlag: FLAG, city: "Cairo" },
  { ats: "breezy", name: "MaxAB", slug: "maxab", country: COUNTRY, countryFlag: FLAG, city: "Cairo" },

  // ── Fintech ───────────────────────────────────────────────────────────
  { ats: "ashby", name: "Paymob", slug: "paymob", country: COUNTRY, countryFlag: FLAG, city: "Cairo" },
  { ats: "ashby", name: "Halan", slug: "halan", country: COUNTRY, countryFlag: FLAG, city: "Cairo" },
  { ats: "ashby", name: "Khazna", slug: "khazna", country: COUNTRY, countryFlag: FLAG, city: "Cairo" },
  { ats: "ashby", name: "Fawry", slug: "fawry", country: COUNTRY, countryFlag: FLAG, city: "Cairo" },
  { ats: "workable", name: "Moneyfellows", slug: "moneyfellows", country: COUNTRY, countryFlag: FLAG, city: "Cairo" },
  { ats: "ashby", name: "Amenli", slug: "amenli", country: COUNTRY, countryFlag: FLAG, city: "Cairo" },
  { ats: "workable", name: "Koinz", slug: "koinz", country: COUNTRY, countryFlag: FLAG, city: "Cairo" },

  // ── E-commerce / Delivery ─────────────────────────────────────────────
  { ats: "ashby", name: "Breadfast", slug: "breadfast", country: COUNTRY, countryFlag: FLAG, city: "Cairo" },
  { ats: "ashby", name: "Trella", slug: "trella", country: COUNTRY, countryFlag: FLAG, city: "Cairo" },
  { ats: "ashby", name: "Swvl", slug: "swvl", country: COUNTRY, countryFlag: FLAG, city: "Cairo" },
  { ats: "ashby", name: "Jumia", slug: "jumia-com", country: COUNTRY, countryFlag: FLAG, city: "Cairo" },
  { ats: "workable", name: "Flextock", slug: "flextock", country: COUNTRY, countryFlag: FLAG, city: "Cairo" },
  { ats: "workable", name: "Sideup", slug: "sideup", country: COUNTRY, countryFlag: FLAG, city: "Cairo" },
  { ats: "workable", name: "Cartona", slug: "cartona", country: COUNTRY, countryFlag: FLAG, city: "Cairo" },
  { ats: "workable", name: "Taager", slug: "taager", country: COUNTRY, countryFlag: FLAG, city: "Cairo" },

  // ── Health / Other ────────────────────────────────────────────────────
  { ats: "workable", name: "Yodawy", slug: "yodawy", country: COUNTRY, countryFlag: FLAG, city: "Cairo" },
  { ats: "ashby", name: "Elmenus", slug: "elmenus", country: COUNTRY, countryFlag: FLAG, city: "Cairo" },
  { ats: "workable", name: "NearPay", slug: "nearpay", country: COUNTRY, countryFlag: FLAG, city: "Cairo" },
  { ats: "workable", name: "Lean Technologies", slug: "leantech", country: COUNTRY, countryFlag: FLAG, city: "Cairo" },

  // ── Agencies / Outsourcing ────────────────────────────────────────────
  { ats: "workable", name: "Codescalers", slug: "codescalers", country: COUNTRY, countryFlag: FLAG, city: "Cairo" },
  { ats: "workable", name: "Dev-Point", slug: "dev-point", country: COUNTRY, countryFlag: FLAG, city: "Cairo" },
  { ats: "ashby", name: "Integrant", slug: "integrant", country: COUNTRY, countryFlag: FLAG, city: "Cairo" },
  { ats: "workable", name: "Atomica", slug: "atomica", country: COUNTRY, countryFlag: FLAG, city: "Cairo" },
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
      for (const j of r.value) { if (!seen.has(j.id)) { seen.add(j.id); all.push(j); } }
    } else {
      console.error("[local] Unhandled rejection:", r.reason);
    }
  }

  // ── Custom fetchers (non-standard ATS) ────────────────────────────────
  const customResults = await Promise.allSettled([
    fetchGizaSystems(MODE),
    fetchBrightSkies(MODE),
    fetchPharos(MODE),
  ]);
  for (const r of customResults) {
    if (r.status === "fulfilled") {
      for (const j of r.value) { if (!seen.has(j.id)) { seen.add(j.id); all.push(j); } }
    } else {
      console.error("[local] Custom fetcher error:", r.reason);
    }
  }

  console.log(`[local] Total: ${all.length} jobs`);
  return all;
}
