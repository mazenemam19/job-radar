import { Job } from "../types";
import {
  computeSkillMatch,
  computeRecencyScore,
  computeRelocationBonus,
  computeTotalScore,
  requiresCitizenshipOrClearance,
  getCountryFromLocation,
  isClearlyNonFrontend,
  CORE_FRONTEND_SKILLS,
  MIN_CORE_SKILLS_REQUIRED,
} from "../scoring";
import { detectVisaSponsorship } from "../visa";

interface RemotiveJob {
  id: number;
  url: string;
  title: string;
  company_name: string;
  category: string;
  tags: string[];
  job_type: string;
  publication_date: string;
  candidate_required_location: string;
  salary: string;
  description: string;
}

interface RemotiveResponse {
  jobs: RemotiveJob[];
}

export async function fetchRemotive(): Promise<Job[]> {
  const results: Job[] = [];
  const seen = new Set<number>();
  const raw: RemotiveJob[] = [];
  let droppedNoVisa = 0;
  let droppedCitizenship = 0;
  let droppedNoSkills = 0;

  // Fetch multiple categories for broader coverage
  const CATEGORIES = ["software-dev", "design", "product"];

  for (const cat of CATEGORIES) {
    try {
      const res = await fetch(`https://remotive.com/api/remote-jobs?category=${cat}&limit=100`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        console.warn(`[Remotive] HTTP ${res.status} for category=${cat}`);
        continue;
      }
      const json = (await res.json()) as RemotiveResponse;
      for (const j of json.jobs || []) {
        if (!seen.has(j.id)) {
          seen.add(j.id);
          raw.push(j);
        }
      }
    } catch (err) {
      console.warn(`[Remotive] Error for category=${cat}:`, err);
    }
  }

  console.log(
    `[Remotive] Fetched ${raw.length} raw jobs across ${CATEGORIES.length} categories, running visa keyword detection...`
  );

  for (const job of raw) {
    const descText = job.description || "";
    const combinedText = `${job.title} ${descText}`;

    const visaResult = detectVisaSponsorship(combinedText);
    if (!visaResult.sponsored) {
      droppedNoVisa++;
      continue;
    }

    if (requiresCitizenshipOrClearance(combinedText)) {
      droppedCitizenship++;
      continue;
    }

    // Title filter: reject clearly non-frontend roles
    if (isClearlyNonFrontend(job.title)) {
      droppedNoSkills++;
      continue;
    }

    const { matchedSkills, missingSkills, skillMatchScore } = computeSkillMatch(combinedText);

    // Must match at least 2 core frontend skills
    const coreMatches = matchedSkills.filter((s) => CORE_FRONTEND_SKILLS.has(s));
    if (coreMatches.length < MIN_CORE_SKILLS_REQUIRED) {
      droppedNoSkills++;
      continue;
    }

    const postedAt = new Date(job.publication_date).toISOString();
    const recencyScore = computeRecencyScore(postedAt);
    const relocationBonus = computeRelocationBonus(descText);
    const totalScore = computeTotalScore(skillMatchScore, recencyScore, relocationBonus);

    const location = job.candidate_required_location || "Remote";
    const { country, flag } = getCountryFromLocation(location);

    results.push({
      id: `remotive_${job.id}`,
      source: "remotive",
      title: job.title,
      company: job.company_name,
      location,
      country,
      countryFlag: flag,
      url: job.url,
      description: descText,
      salary: job.salary || undefined,
      postedAt,
      visaSponsorship: true,
      matchedSkills,
      missingSkills,
      skillMatchScore,
      recencyScore,
      relocationBonus,
      totalScore,
      fetchedAt: new Date().toISOString(),
    });
  }

  console.log(
    `[Remotive] Pipeline: ${raw.length} fetched → ${droppedNoVisa} no visa → ${droppedCitizenship} dropped (citizenship) → ${droppedNoSkills} dropped (no skill match) → ${results.length} passed`
  );
  return results;
}
