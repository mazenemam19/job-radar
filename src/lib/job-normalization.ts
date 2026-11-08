import { COUNTRY_FLAGS } from "./constants";
import type { JobEmploymentType } from "./types";

export type WorkplaceType = "on_site" | "hybrid" | "remote" | "unknown";

export interface NormalizedPostingLocation {
  sourceLocation: string;
  city: string | null;
  country: string;
  countryCode: string | null;
  countryFlag: string;
}

const COUNTRY_CODES: Record<string, string> = {
  germany: "DE",
  deutschland: "DE",
  egypt: "EG",
  uk: "GB",
  "united kingdom": "GB",
  "united states": "US",
  usa: "US",
  france: "FR",
  netherlands: "NL",
  ireland: "IE",
  spain: "ES",
  portugal: "PT",
  sweden: "SE",
  denmark: "DK",
  finland: "FI",
  poland: "PL",
  austria: "AT",
  switzerland: "CH",
  belgium: "BE",
  bulgaria: "BG",
  norway: "NO",
  canada: "CA",
  australia: "AU",
  singapore: "SG",
  "saudi arabia": "SA",
  "united arab emirates": "AE",
  uae: "AE",
  romania: "RO",
  hungary: "HU",
  czechia: "CZ",
  "czech republic": "CZ",
  italy: "IT",
  japan: "JP",
  "south africa": "ZA",
  gibraltar: "GI",
  mexico: "MX",
  argentina: "AR",
  brazil: "BR",
  india: "IN",
  indonesia: "ID",
  philippines: "PH",
};

const COUNTRY_NAMES: Record<string, string> = {
  DE: "Germany",
  EG: "Egypt",
  GB: "UK",
  US: "USA",
  FR: "France",
  NL: "Netherlands",
  IE: "Ireland",
  ES: "Spain",
  PT: "Portugal",
  SE: "Sweden",
  DK: "Denmark",
  FI: "Finland",
  PL: "Poland",
  AT: "Austria",
  CH: "Switzerland",
  BE: "Belgium",
  BG: "Bulgaria",
  NO: "Norway",
  CA: "Canada",
  AU: "Australia",
  SG: "Singapore",
  SA: "Saudi Arabia",
  AE: "UAE",
  RO: "Romania",
  HU: "Hungary",
  CZ: "Czechia",
  IT: "Italy",
  JP: "Japan",
  ZA: "South Africa",
  GI: "Gibraltar",
  MX: "Mexico",
  AR: "Argentina",
  BR: "Brazil",
  IN: "India",
  ID: "Indonesia",
  PH: "Philippines",
};

// These are unambiguous country-level location terms observed in live ATS
// records. They are deliberately separate from CITY_COUNTRIES: a state should
// identify the posting country, but must not be presented as a city match.
const LOCATION_COUNTRY_ALIASES: Record<string, { country: string; code: string }> = {
  california: { country: "USA", code: "US" },
};

interface CityCountry {
  city: string;
  country: string;
  code: string;
}

const CITY_COUNTRIES: Record<string, CityCountry> = {
  berlin: { city: "Berlin", country: "Germany", code: "DE" },
  bremen: { city: "Bremen", country: "Germany", code: "DE" },
  hamburg: { city: "Hamburg", country: "Germany", code: "DE" },
  munich: { city: "Munich", country: "Germany", code: "DE" },
  münchen: { city: "München", country: "Germany", code: "DE" },
  nuremberg: { city: "Nuremberg", country: "Germany", code: "DE" },
  nürnberg: { city: "Nürnberg", country: "Germany", code: "DE" },
  erlangen: { city: "Erlangen", country: "Germany", code: "DE" },
  buckenhof: { city: "Buckenhof", country: "Germany", code: "DE" },
  frankfurt: { city: "Frankfurt", country: "Germany", code: "DE" },
  stuttgart: { city: "Stuttgart", country: "Germany", code: "DE" },
  cologne: { city: "Cologne", country: "Germany", code: "DE" },
  köln: { city: "Köln", country: "Germany", code: "DE" },
  cairo: { city: "Cairo", country: "Egypt", code: "EG" },
  giza: { city: "Giza", country: "Egypt", code: "EG" },
  alexandria: { city: "Alexandria", country: "Egypt", code: "EG" },
  london: { city: "London", country: "UK", code: "GB" },
  dublin: { city: "Dublin", country: "Ireland", code: "IE" },
  amsterdam: { city: "Amsterdam", country: "Netherlands", code: "NL" },
  paris: { city: "Paris", country: "France", code: "FR" },
  madrid: { city: "Madrid", country: "Spain", code: "ES" },
  barcelona: { city: "Barcelona", country: "Spain", code: "ES" },
  lisbon: { city: "Lisbon", country: "Portugal", code: "PT" },
  vienna: { city: "Vienna", country: "Austria", code: "AT" },
  zurich: { city: "Zurich", country: "Switzerland", code: "CH" },
  stockholm: { city: "Stockholm", country: "Sweden", code: "SE" },
  copenhagen: { city: "Copenhagen", country: "Denmark", code: "DK" },
  sofia: { city: "Sofia", country: "Bulgaria", code: "BG" },
  warsaw: { city: "Warsaw", country: "Poland", code: "PL" },
  prague: { city: "Prague", country: "Czechia", code: "CZ" },
  rome: { city: "Rome", country: "Italy", code: "IT" },
  tokyo: { city: "Tokyo", country: "Japan", code: "JP" },
  osaka: { city: "Osaka", country: "Japan", code: "JP" },
  kyoto: { city: "Kyoto", country: "Japan", code: "JP" },
  johannesburg: { city: "Johannesburg", country: "South Africa", code: "ZA" },
  "cape town": { city: "Cape Town", country: "South Africa", code: "ZA" },
  "mexico city": { city: "Mexico City", country: "Mexico", code: "MX" },
  "buenos aires": { city: "Buenos Aires", country: "Argentina", code: "AR" },
  "são paulo": { city: "São Paulo", country: "Brazil", code: "BR" },
  "sao paulo": { city: "Sao Paulo", country: "Brazil", code: "BR" },
  "rio de janeiro": { city: "Rio de Janeiro", country: "Brazil", code: "BR" },
  mumbai: { city: "Mumbai", country: "India", code: "IN" },
  delhi: { city: "Delhi", country: "India", code: "IN" },
  bengaluru: { city: "Bengaluru", country: "India", code: "IN" },
  bangalore: { city: "Bangalore", country: "India", code: "IN" },
  jakarta: { city: "Jakarta", country: "Indonesia", code: "ID" },
  "san francisco": { city: "San Francisco", country: "USA", code: "US" },
  "new york": { city: "New York", country: "USA", code: "US" },
  chicago: { city: "Chicago", country: "USA", code: "US" },
  seattle: { city: "Seattle", country: "USA", code: "US" },
  austin: { city: "Austin", country: "USA", code: "US" },
  boston: { city: "Boston", country: "USA", code: "US" },
  manila: { city: "Manila", country: "Philippines", code: "PH" },
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchCountry(location: string): { country: string; code: string } | null {
  const lower = location.toLowerCase();
  const entries = Object.entries(COUNTRY_CODES).sort(([a], [b]) => b.length - a.length);
  for (const [alias, info] of entries) {
    if (new RegExp(`\\b${escapeRegex(alias)}\\b`, "i").test(lower)) {
      return { country: COUNTRY_NAMES[info] ?? alias, code: info };
    }
  }
  const codeMatch = location.match(/(?:^|[,\s])([A-Z]{2})(?:$|[,\s])/);
  if (codeMatch && COUNTRY_NAMES[codeMatch[1]] && COUNTRY_FLAGS[codeMatch[1]]) {
    return { country: COUNTRY_NAMES[codeMatch[1]], code: codeMatch[1] };
  }
  return null;
}

function cleanCityCandidate(value: string): string | null {
  const candidate = value
    .replace(/\b(remote|hybrid|on[ -]?site|work from home)\b/gi, " ")
    .replace(/\b(office|headquarters|hq)\b/gi, " ")
    .replace(/[()]/g, " ")
    .trim()
    .replace(/^[\s-]+|[\s-]+$/g, "")
    .replace(/\s+/g, " ");
  if (!candidate || /^(worldwide|global|multiple locations|anywhere|unknown)$/i.test(candidate)) {
    return null;
  }
  return candidate;
}

function matchKnownCity(location: string): CityCountry | null {
  const entries = Object.entries(CITY_COUNTRIES).sort(([a], [b]) => b.length - a.length);
  for (const [name, city] of entries) {
    if (new RegExp(`(?:^|[^\\p{L}])${escapeRegex(name)}(?=$|[^\\p{L}])`, "iu").test(location)) {
      return city;
    }
  }
  return null;
}

function matchLocationCountry(location: string): { country: string; code: string } | null {
  for (const [alias, resolved] of Object.entries(LOCATION_COUNTRY_ALIASES)) {
    if (new RegExp(`(?:^|[^\\p{L}])${escapeRegex(alias)}(?=$|[^\\p{L}])`, "iu").test(location)) {
      return resolved;
    }
  }
  return null;
}

function isRegionalOrUnspecifiedLocation(location: string): boolean {
  return (
    !location ||
    /\b(global|emea|worldwide|any office|multiple locations|remote|anywhere)\b/i.test(location)
  );
}

export function normalizePostingLocation(
  rawLocation: string,
  title = "",
): NormalizedPostingLocation {
  const sourceLocation = rawLocation.trim();
  const sourceCountry = matchCountry(sourceLocation);
  const firstPart = sourceLocation.split(/[;,|]/, 1)[0] ?? "";
  const cityCandidate = cleanCityCandidate(firstPart);
  const cityCountry = matchKnownCity(sourceLocation);
  const city = cityCountry?.city ??
    (cityCandidate && !matchCountry(cityCandidate) && !matchLocationCountry(cityCandidate)
      ? cityCandidate
      : null);
  const sourceResolved = sourceCountry ?? cityCountry ?? matchLocationCountry(sourceLocation) ?? null;
  // A concrete ATS location is stronger evidence than a job title. Some ATS
  // feeds provide only a regional label (for example, EMEA); in that narrow
  // case an explicit country in the title is still useful and reviewable.
  const titleCountry =
    !sourceResolved && isRegionalOrUnspecifiedLocation(sourceLocation) ? matchCountry(title) : null;
  const resolved = sourceResolved ?? titleCountry;

  return {
    sourceLocation,
    city,
    country: resolved?.country ?? "Unknown",
    countryCode: resolved?.code ?? null,
    countryFlag: resolved ? (COUNTRY_FLAGS[resolved.code] ?? "🌍") : "🌍",
  };
}

export function inferWorkplaceType(
  rawLocation: string,
  title: string,
  description: string,
  atsValue?: string,
): WorkplaceType {
  const metadata = (atsValue ?? "").toLowerCase().replace(/[ -]/g, "_");
  if (/^(remote|fully_remote|distributed)$/.test(metadata)) return "remote";
  if (/^(hybrid|flexible)$/.test(metadata)) return "hybrid";
  if (/^(on_site|onsite|office)$/.test(metadata)) return "on_site";

  // Most ATS adapters expose the source location even when they do not
  // provide structured workplace metadata. A standalone `Remote` location is
  // an explicit arrangement, unlike a generic description mentioning remote
  // work, so it is safe to classify it here.
  if (/\bremote\b/i.test(rawLocation)) return "remote";

  const locationAndTitle = `${rawLocation} ${title}`;
  if (
    /\b(fully remote|remote-first|remote position|remote role|work from home|home-based)\b/i.test(
      locationAndTitle,
    )
  ) {
    return "remote";
  }
  if (/\bhybrid\b/i.test(locationAndTitle) || /\bhybrid work(?:ing)? model\b/i.test(description)) {
    return "hybrid";
  }
  if (/\b(on[ -]?site|in-office|office-based|office based)\b/i.test(locationAndTitle)) {
    return "on_site";
  }
  return "unknown";
}

const EMPLOYMENT_PATTERNS: Array<[JobEmploymentType, RegExp]> = [
  ["working_student", /\b(werkstudent(?:in)?|working student|student employee)\b/i],
  ["part_time", /\b(part[ -]?time|teilzeit)\b/i],
  ["full_time", /\b(full[ -]?time|vollzeit)\b/i],
  ["internship", /\b(internship|intern|praktikum|praktikant(?:in)?)\b/i],
  ["mini_job", /\b(mini[ -]?job|minijob)\b/i],
  ["apprenticeship", /\b(apprentice(?:ship)?|ausbildung|trainee program)\b/i],
  ["contract", /\b(contractor?|fixed[ -]term contract)\b/i],
  ["temporary", /\b(temporary|befristet)\b/i],
  ["freelance", /\b(freelance|freiberuflich)\b/i],
];

export function inferEmploymentTypes(...values: Array<string | undefined>): JobEmploymentType[] {
  const text = values.filter(Boolean).join(" ");
  return EMPLOYMENT_PATTERNS.filter(([, pattern]) => pattern.test(text)).map(([type]) => type);
}

const LANGUAGE_NAMES: Array<[string, RegExp]> = [
  ["German", /\b(german|deutsch(?:e|er|es|en)?)\b/i],
  ["English", /\b(english|englisch)\b/i],
  ["Arabic", /\b(arabic|arabisch)\b/i],
  ["French", /\b(french|französisch|francais|français)\b/i],
  ["Spanish", /\b(spanish|español|espanol|spanisch)\b/i],
  ["Dutch", /\b(dutch|niederländisch|nederlands)\b/i],
];

export interface LanguageClues {
  requirements: string[];
  evidence: string | null;
}

export function extractLanguageClues(text: string): LanguageClues {
  const sentences = text.split(/(?<=[.!?])\s+|\n+/).map((part) => part.trim());
  const matches = sentences.filter((sentence) =>
    LANGUAGE_NAMES.some(([, pattern]) => pattern.test(sentence)),
  );
  const requirements = LANGUAGE_NAMES.filter(([, pattern]) =>
    matches.some((sentence) => pattern.test(sentence)),
  ).map(([language]) => language);
  return { requirements, evidence: matches[0]?.slice(0, 320) ?? null };
}
