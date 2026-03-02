// src/lib/sources/local-companies.ts
import type { Job, SourceHealth } from "../types";
import {
  fetchGreenhouse,
  fetchLever,
  fetchAshby,
  fetchWorkable,
  fetchTeamtailor,
  fetchBreezy,
  fetchSmartRecruiters,
  fetchBambooHR,
  fetchJazzHR,
  fetchGizaSystems,
  fetchBrightSkies,
  fetchPharos,
  fetchWuzzuf,
  type ATSConfig,
  resetWorkableUsed,
  type FetcherResult,
} from "./ats-utils";
import { getNextBatch } from "../state";

const COUNTRY = "Egypt";
const FLAG = "🇪🇬";
const MODE = "local";
const VISA = false;

const COMPANIES: ATSConfig[] = [
  // ── Verified Lever ────────────────────────────────────────────────────
  {
    ats: "lever",
    name: "Bosta",
    slug: "Bosta",
    country: COUNTRY,
    countryFlag: FLAG,
    city: "Cairo",
  },

  // ── Verified Ashby ────────────────────────────────────────────────────
  {
    ats: "ashby",
    name: "Thndr",
    slug: "thndr",
    country: COUNTRY,
    countryFlag: FLAG,
    city: "Cairo",
  },

  // ── Verified SmartRecruiters ──────────────────────────────────────────
  {
    ats: "smartrecruiters",
    name: "Yassir",
    slug: "YassirGmbh",
    country: COUNTRY,
    countryFlag: FLAG,
    city: "Cairo",
  },
  {
    ats: "smartrecruiters",
    name: "Algoriza",
    slug: "Algoriza",
    country: COUNTRY,
    countryFlag: FLAG,
    city: "Cairo",
  },
  {
    ats: "smartrecruiters",
    name: "Khazna Tech",
    slug: "khaznatech",
    country: COUNTRY,
    countryFlag: FLAG,
    city: "Cairo",
  },
  {
    ats: "smartrecruiters",
    name: "valU",
    slug: "valU",
    country: COUNTRY,
    countryFlag: FLAG,
    city: "Cairo",
  },
  {
    ats: "smartrecruiters",
    name: "Homzmart",
    slug: "Homzmart",
    country: COUNTRY,
    countryFlag: FLAG,
    city: "Cairo",
  },

  // ── Verified Workable (Local Heavyweight) ─────────────────────────────
  {
    ats: "workable",
    name: "Swvl",
    slug: "swvl",
    country: COUNTRY,
    countryFlag: FLAG,
    city: "Cairo",
  },
  {
    ats: "workable",
    name: "Klivvr",
    slug: "klivvr",
    country: COUNTRY,
    countryFlag: FLAG,
    city: "Cairo",
  },
  {
    ats: "workable",
    name: "Nawy",
    slug: "nawy-real-estate",
    country: COUNTRY,
    countryFlag: FLAG,
    city: "Cairo",
  },
  {
    ats: "workable",
    name: "Dubizzle",
    slug: "bayutdubizzle",
    country: COUNTRY,
    countryFlag: FLAG,
    city: "Cairo",
  },
  {
    ats: "workable",
    name: "Rubikal",
    slug: "rubikal",
    country: COUNTRY,
    countryFlag: FLAG,
    city: "Cairo",
  },
  {
    ats: "workable",
    name: "Blink22",
    slug: "blink22",
    country: COUNTRY,
    countryFlag: FLAG,
    city: "Cairo",
  },
  {
    ats: "workable",
    name: "Squadio",
    slug: "squadio23",
    country: COUNTRY,
    countryFlag: FLAG,
    city: "Cairo",
  },
  {
    ats: "workable",
    name: "Robusta",
    slug: "robusta",
    country: COUNTRY,
    countryFlag: FLAG,
    city: "Cairo",
  },
  {
    ats: "workable",
    name: "Vezeeta",
    slug: "vezeeta",
    country: COUNTRY,
    countryFlag: FLAG,
    city: "Cairo",
  },
  {
    ats: "workable",
    name: "Moneyfellows",
    slug: "moneyfellows",
    country: COUNTRY,
    countryFlag: FLAG,
    city: "Cairo",
  },
  {
    ats: "jazzhr",
    name: "Koinz",
    slug: "koinz",
    country: COUNTRY,
    countryFlag: FLAG,
    city: "Cairo",
  },
  {
    ats: "workable",
    name: "Flextock",
    slug: "flextock",
    country: COUNTRY,
    countryFlag: FLAG,
    city: "Cairo",
  },
  {
    ats: "workable",
    name: "Sideup",
    slug: "sideup",
    country: COUNTRY,
    countryFlag: FLAG,
    city: "Cairo",
  },
  {
    ats: "workable",
    name: "Cartona",
    slug: "global-ventures",
    country: COUNTRY,
    countryFlag: FLAG,
    city: "Cairo",
  },
  {
    ats: "workable",
    name: "Taager",
    slug: "taager",
    country: COUNTRY,
    countryFlag: FLAG,
    city: "Cairo",
  },
  {
    ats: "workable",
    name: "NearPay",
    slug: "nearpay",
    country: COUNTRY,
    countryFlag: FLAG,
    city: "Cairo",
  },
  {
    ats: "workable",
    name: "Lean Technologies",
    slug: "leantech",
    country: COUNTRY,
    countryFlag: FLAG,
    city: "Cairo",
  },
  {
    ats: "workable",
    name: "Codescalers",
    slug: "codescalers",
    country: COUNTRY,
    countryFlag: FLAG,
    city: "Cairo",
  },
  {
    ats: "workable",
    name: "Dev-Point",
    slug: "devpoint",
    country: COUNTRY,
    countryFlag: FLAG,
    city: "Cairo",
  },
  {
    ats: "workable",
    name: "Atomica",
    slug: "atomica",
    country: COUNTRY,
    countryFlag: FLAG,
    city: "Cairo",
  },
  {
    ats: "workable",
    name: "Advansys",
    slug: "advansys",
    country: COUNTRY,
    countryFlag: FLAG,
    city: "Cairo",
  },
  {
    ats: "workable",
    name: "Sumerge",
    slug: "sumerge",
    country: COUNTRY,
    countryFlag: FLAG,
    city: "Cairo",
  },
  {
    ats: "workable",
    name: "Integrant",
    slug: "integrant",
    country: COUNTRY,
    countryFlag: FLAG,
    city: "Cairo",
  },
  {
    ats: "workable",
    name: "Eva Pharma",
    slug: "evapharma",
    country: COUNTRY,
    countryFlag: FLAG,
    city: "Cairo",
  },
  {
    ats: "workable",
    name: "SWATX",
    slug: "swatx",
    country: COUNTRY,
    countryFlag: FLAG,
    city: "Cairo",
  },
  {
    ats: "workable",
    name: "MNT-Halan",
    slug: "mnt-halan",
    country: COUNTRY,
    countryFlag: FLAG,
    city: "Cairo",
  },
  {
    ats: "workable",
    name: "Rabbit",
    slug: "rabbitmart",
    country: COUNTRY,
    countryFlag: FLAG,
    city: "Cairo",
  },
  {
    ats: "workable",
    name: "ArpuPlus",
    slug: "arpuplus",
    country: COUNTRY,
    countryFlag: FLAG,
    city: "Cairo",
  },

  // ── BambooHR ──────────────────────────────────────────────────────────
  {
    ats: "bamboohr",
    name: "Instabug",
    slug: "instabug",
    country: COUNTRY,
    countryFlag: FLAG,
    city: "Cairo",
  },

  // ── Breezy ────────────────────────────────────────────────────────────
  {
    ats: "breezy",
    name: "MaxAB",
    slug: "maxab",
    country: COUNTRY,
    countryFlag: FLAG,
    city: "Cairo",
  },
  {
    ats: "breezy",
    name: "Grinta",
    slug: "grinta",
    country: COUNTRY,
    countryFlag: FLAG,
    city: "Cairo",
  },
];

export async function fetchLocalJobs(): Promise<{
  jobs: Job[];
  health: Record<string, SourceHealth>;
}> {
  resetWorkableUsed(MODE);

  const workables = COMPANIES.filter((c) => c.ats === "workable");
  const others = COMPANIES.filter((c) => c.ats !== "workable");

  const batchWorkable = await getNextBatch(workables, 12, "local-workable");
  const toScan = [...others, ...batchWorkable];

  const results = await Promise.allSettled(
    toScan.map((c) => {
      const p = (() => {
        switch (c.ats) {
          case "greenhouse":
            return fetchGreenhouse(c, MODE, VISA);
          case "lever":
            return fetchLever(c, MODE, VISA);
          case "ashby":
            return fetchAshby(c, MODE, VISA);
          case "workable":
            return fetchWorkable(c, MODE, VISA);
          case "teamtailor":
            return fetchTeamtailor(c, MODE, VISA);
          case "breezy":
            return fetchBreezy(c, MODE, VISA);
          case "smartrecruiters":
            return fetchSmartRecruiters(c, MODE, VISA);
          case "bamboohr":
            return fetchBambooHR(c, MODE, VISA);
          case "jazzhr":
            return fetchJazzHR(c, MODE, VISA);
          default:
            return Promise.resolve({ jobs: [] } as FetcherResult);
        }
      })();
      return p.then((res) => ({ ...res, sourceName: c.name }));
    }),
  );

  const all: Job[] = [];
  const health: Record<string, SourceHealth> = {};
  const seen = new Set<string>();

  for (const r of results) {
    if (r.status === "fulfilled") {
      const { jobs, error, durationMs, sourceName } = r.value as FetcherResult & {
        sourceName: string;
      };
      health[sourceName] = { count: jobs.length, error, durationMs };
      for (const j of jobs) {
        if (!seen.has(j.id)) {
          seen.add(j.id);
          all.push(j);
        }
      }
    } else {
      console.error("[local] Unhandled rejection:", r.reason);
    }
  }

  // ── Custom fetchers (Verified direct APIs) ───────────────────────────
  const customFetchers = [
    { name: "Wuzzuf", fn: () => fetchWuzzuf(MODE) },
    { name: "Giza Systems", fn: () => fetchGizaSystems(MODE) },
    { name: "Bright Skies", fn: () => fetchBrightSkies(MODE) },
    { name: "Pharos Solutions", fn: () => fetchPharos(MODE) },
  ];

  const customResults = await Promise.allSettled(
    customFetchers.map((cf) => cf.fn().then((res) => ({ ...res, sourceName: cf.name }))),
  );

  for (const r of customResults) {
    if (r.status === "fulfilled") {
      const { jobs, error, durationMs, sourceName } = r.value as FetcherResult & {
        sourceName: string;
      };
      health[sourceName] = { count: jobs.length, error, durationMs };
      for (const j of jobs) {
        if (!seen.has(j.id)) {
          seen.add(j.id);
          all.push(j);
        }
      }
    } else {
      console.error("[local] Custom fetcher error:", r.reason);
    }
  }

  console.log(`[local] Total: ${all.length} jobs`);
  return { jobs: all, health };
}
