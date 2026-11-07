import type { JobEmploymentType, JobSearchProfile, RawJob, WorkplaceType } from "./types";

const WORKPLACE_LABELS: Record<WorkplaceType, string> = {
  on_site: "On-site",
  hybrid: "Hybrid",
  remote: "Remote",
};

const EMPLOYMENT_LABELS: Record<JobEmploymentType, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  working_student: "Working student",
  internship: "Internship",
  contract: "Contract",
  temporary: "Temporary",
  mini_job: "Minijob",
  apprenticeship: "Apprenticeship",
  freelance: "Freelance",
  other: "Other / not specified",
};

export interface SearchProfileMatchExplanation {
  reasons: string[];
  uncertainties: string[];
}

function findMatchingCity(cities: string[], city: string | undefined): string | undefined {
  if (!city) return undefined;
  return cities.find((candidate) => candidate.toLocaleLowerCase() === city.toLocaleLowerCase());
}

function getCountryWideReason(
  location: JobSearchProfile["locations"][number],
  workplace: WorkplaceType | "unknown",
): string | undefined {
  if (workplace === "remote" && location.remote_countrywide) {
    return `Remote across ${location.country_name}`;
  }
  if (workplace === "on_site" && location.country_wide) {
    return `On-site across ${location.country_name}`;
  }
  if (workplace === "hybrid" && location.country_wide) {
    return `Hybrid across ${location.country_name}`;
  }
  return undefined;
}

function explainLocation(
  job: Pick<RawJob, "country_code" | "city">,
  profile: JobSearchProfile,
  workplace: WorkplaceType | "unknown",
): SearchProfileMatchExplanation {
  if (profile.locations.length === 0) return { reasons: [], uncertainties: [] };
  if (!job.country_code) {
    return { reasons: [], uncertainties: ["The posting country could not be identified"] };
  }

  const location = profile.locations.find(
    (candidate) => candidate.country_code.toUpperCase() === job.country_code?.toUpperCase(),
  );
  if (!location) return { reasons: [], uncertainties: [] };

  const city = job.city?.trim();
  const cityMatches = findMatchingCity(location.cities, city);
  if (cityMatches)
    return { reasons: [`${cityMatches}, ${location.country_name}`], uncertainties: [] };
  const countryWideReason = getCountryWideReason(location, workplace);
  if (countryWideReason) return { reasons: [countryWideReason], uncertainties: [] };
  if (!city) {
    return { reasons: [location.country_name], uncertainties: ["The city was not identified"] };
  }
  return { reasons: [], uncertainties: [] };
}

function explainWorkplace(workplace: WorkplaceType | "unknown"): SearchProfileMatchExplanation {
  if (workplace === "unknown") {
    return { reasons: [], uncertainties: ["The workplace arrangement is unclear"] };
  }
  return { reasons: [WORKPLACE_LABELS[workplace]], uncertainties: [] };
}

function explainEmployment(
  employmentTypes: JobEmploymentType[],
  profile: JobSearchProfile,
): SearchProfileMatchExplanation {
  if (employmentTypes.length === 0) {
    return { reasons: [], uncertainties: ["The employment type is unclear"] };
  }
  const matchingTypes = employmentTypes.filter(
    (type) => profile.employment_types.length === 0 || profile.employment_types.includes(type),
  );
  return { reasons: matchingTypes.map((type) => EMPLOYMENT_LABELS[type]), uncertainties: [] };
}

/** Builds short, evidence-based reasons for a job that passed the DB profile filter. */
export function explainSearchProfileMatch(
  job: Pick<RawJob, "country_code" | "city" | "workplace_type" | "employment_types">,
  profile: JobSearchProfile,
): SearchProfileMatchExplanation {
  const workplace = job.workplace_type ?? "unknown";
  const explanations = [
    explainLocation(job, profile, workplace),
    explainWorkplace(workplace),
    explainEmployment(job.employment_types ?? [], profile),
  ];
  const reasons = explanations.flatMap((explanation) => explanation.reasons);
  const uncertainties = explanations.flatMap((explanation) => explanation.uncertainties);

  return {
    reasons: Array.from(new Set(reasons)),
    uncertainties: Array.from(new Set(uncertainties)),
  };
}
