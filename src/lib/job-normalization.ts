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
};

const CITY_COUNTRIES: Record<string, { country: string; code: string }> = {
  berlin: { country: "Germany", code: "DE" },
  hamburg: { country: "Germany", code: "DE" },
  munich: { country: "Germany", code: "DE" },
  münchen: { country: "Germany", code: "DE" },
  nuremberg: { country: "Germany", code: "DE" },
  nürnberg: { country: "Germany", code: "DE" },
  erlangen: { country: "Germany", code: "DE" },
  buckenhof: { country: "Germany", code: "DE" },
  frankfurt: { country: "Germany", code: "DE" },
  stuttgart: { country: "Germany", code: "DE" },
  cologne: { country: "Germany", code: "DE" },
  köln: { country: "Germany", code: "DE" },
  cairo: { country: "Egypt", code: "EG" },
  giza: { country: "Egypt", code: "EG" },
  alexandria: { country: "Egypt", code: "EG" },
  london: { country: "UK", code: "GB" },
  dublin: { country: "Ireland", code: "IE" },
  amsterdam: { country: "Netherlands", code: "NL" },
  paris: { country: "France", code: "FR" },
  madrid: { country: "Spain", code: "ES" },
  barcelona: { country: "Spain", code: "ES" },
  lisbon: { country: "Portugal", code: "PT" },
  vienna: { country: "Austria", code: "AT" },
  zurich: { country: "Switzerland", code: "CH" },
  stockholm: { country: "Sweden", code: "SE" },
  copenhagen: { country: "Denmark", code: "DK" },
  warsaw: { country: "Poland", code: "PL" },
  prague: { country: "Czechia", code: "CZ" },
  rome: { country: "Italy", code: "IT" },
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
    .replace(/[()]/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  if (!candidate || /^(worldwide|global|multiple locations|anywhere|unknown)$/i.test(candidate)) {
    return null;
  }
  return candidate;
}

export function normalizePostingLocation(rawLocation: string): NormalizedPostingLocation {
  const sourceLocation = rawLocation.trim();
  const country = matchCountry(sourceLocation);
  const firstPart = sourceLocation.split(/[;,|]/, 1)[0] ?? "";
  const cityCandidate = cleanCityCandidate(firstPart);
  const city =
    cityCandidate && (CITY_COUNTRIES[cityCandidate.toLowerCase()] || !matchCountry(cityCandidate))
      ? cityCandidate
      : null;
  const cityCountry = city ? CITY_COUNTRIES[city.toLowerCase()] : undefined;
  const resolved = country ?? cityCountry ?? null;

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
