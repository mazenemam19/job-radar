import type { JobEmploymentType, JobSearchProfile, WorkplaceType } from "./types";

export const WORKPLACE_TYPES: readonly WorkplaceType[] = ["on_site", "hybrid", "remote"];

export const JOB_EMPLOYMENT_TYPES: readonly JobEmploymentType[] = [
  "full_time",
  "part_time",
  "working_student",
  "internship",
  "contract",
  "temporary",
  "mini_job",
  "apprenticeship",
  "freelance",
  "other",
];

export const EMPTY_SEARCH_PROFILE: JobSearchProfile = {
  locations: [],
  workplace_types: [],
  employment_types: [],
};

/**
 * An opt-in starting point for Mazen's Germany search. This is deliberately
 * not used as an application-wide or signup default.
 */
export const GERMANY_PILOT_SEARCH_PROFILE: JobSearchProfile = {
  locations: [
    {
      country_code: "DE",
      country_name: "Germany",
      cities: ["Buckenhof", "Erlangen", "Nürnberg"],
      country_wide: false,
      remote_countrywide: true,
    },
  ],
  workplace_types: [...WORKPLACE_TYPES],
  employment_types: [...JOB_EMPLOYMENT_TYPES],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeStringList(value: unknown, maxItems: number, maxLength: number): string[] | null {
  if (!Array.isArray(value) || value.length > maxItems) return null;
  const values: string[] = [];

  for (const item of value) {
    if (typeof item !== "string") return null;
    const normalized = item.trim();
    if (!normalized || normalized.length > maxLength) return null;
    if (
      !values.some((existing) => existing.toLocaleLowerCase() === normalized.toLocaleLowerCase())
    ) {
      values.push(normalized);
    }
  }

  return values;
}

function normalizeLocation(value: unknown): JobSearchProfile["locations"][number] | null {
  if (!isRecord(value)) return null;
  const countryCode = typeof value.country_code === "string" ? value.country_code.trim() : "";
  const countryName = typeof value.country_name === "string" ? value.country_name.trim() : "";
  const cities = normalizeStringList(value.cities, 40, 80);

  if (
    !/^[A-Za-z]{2}$/.test(countryCode) ||
    !countryName ||
    countryName.length > 80 ||
    !cities ||
    typeof value.country_wide !== "boolean" ||
    typeof value.remote_countrywide !== "boolean"
  ) {
    return null;
  }

  return {
    country_code: countryCode.toUpperCase(),
    country_name: countryName,
    cities,
    country_wide: value.country_wide,
    remote_countrywide: value.remote_countrywide,
  };
}

function normalizeAllowedList<T extends string>(
  value: unknown,
  allowedValues: readonly T[],
  maxLength: number,
): T[] | null {
  const normalized = normalizeStringList(value, allowedValues.length, maxLength);
  if (!normalized || !normalized.every((item) => allowedValues.includes(item as T))) return null;
  return normalized as T[];
}

/**
 * Validates and normalizes the JSONB profile accepted by the settings API.
 * Returns null for malformed or unsupported values.
 */
export function normalizeSearchProfile(value: unknown): JobSearchProfile | null {
  if (!isRecord(value)) return null;

  const locationsInput = value.locations;
  const workplaceInput = value.workplace_types;
  const employmentInput = value.employment_types;

  if (
    !Array.isArray(locationsInput) ||
    locationsInput.length > 20 ||
    !Array.isArray(workplaceInput) ||
    !Array.isArray(employmentInput)
  ) {
    return null;
  }

  const locations: JobSearchProfile["locations"] = [];
  for (const item of locationsInput) {
    const location = normalizeLocation(item);
    if (!location) return null;
    locations.push(location);
  }

  const workplaceTypes = normalizeAllowedList(workplaceInput, WORKPLACE_TYPES, 20);
  const employmentTypes = normalizeAllowedList(employmentInput, JOB_EMPLOYMENT_TYPES, 32);
  if (!workplaceTypes || !employmentTypes) return null;

  return {
    locations,
    workplace_types: workplaceTypes,
    employment_types: employmentTypes,
  };
}
