import { Job } from "../types";
import {
  computeSkillMatch,
  computeRecencyScore,
  computeRelocationBonus,
  computeTotalScore,
  requiresCitizenshipOrClearance,
  getCountryFromLocation,
} from "../scoring";
import { detectVisaSponsorship } from "../visa";

interface RemotiveJob {
  id: number;
  url: string;
  title: string;
  company_name: string;
  company_logo?: string;
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
  let totalFetched = 0;
  let withVisa = 0;
  let droppedNoVisa = 0;
  let droppedCitizenship = 0;
  let droppedNoSkills = 0;

  let raw: RemotiveJob[] = [];
  try {
    const res = await fetch("https://remotive.com/api/remote-jobs?category=software-dev&limit=100", {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      console.warn(`[Remotive] HTTP ${res.status}`);
      return [];
    }
    const json = (await res.json()) as RemotiveResponse;
    raw = json.jobs || [];
  } catch (err) {
    console.warn("[Remotive] Fetch error:", err);
    return [];
  }

  totalFetched = raw.length;
  console.log(`[Remotive] Fetched ${totalFetched} raw jobs, running visa keyword detection...`);

  for (const job of raw) {
    const descText = job.description || "";
    const combinedText = `${job.title} ${descText}`;

    // Visa check via keyword detection on full description
    const visaResult = detectVisaSponsorship(combinedText);
    if (!visaResult.sponsored) {
      droppedNoVisa++;
      continue;
    }
    withVisa++;

    // Hard filter: no citizenship/clearance
    if (requiresCitizenshipOrClearance(combinedText)) {
      droppedCitizenship++;
      continue;
    }

    const { matchedSkills, missingSkills, skillMatchScore } = computeSkillMatch(combinedText);

    if (matchedSkills.length === 0) {
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
    `[Remotive] Pipeline: ${totalFetched} fetched → ${droppedNoVisa} no visa → ${withVisa} with visa → ${droppedCitizenship} dropped (citizenship) → ${droppedNoSkills} dropped (no skill match) → ${results.length} passed`
  );

  return results;
}
