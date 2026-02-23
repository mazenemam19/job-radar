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

interface JobicyJob {
  id: number;
  url: string;
  jobTitle: string;
  companyName: string;
  jobIndustry: string;
  jobType: string;
  jobGeo: string;
  jobLevel: string;
  jobExcerpt: string;
  jobDescription: string;
  pubDate: string;
  annualSalaryMin?: string;
  annualSalaryMax?: string;
  salaryCurrency?: string;
}

interface JobicyResponse {
  jobCount: number;
  jobs: JobicyJob[];
}

function stripHtml(html: string): string {
  return (html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildSalary(job: JobicyJob): string | undefined {
  if (!job.annualSalaryMin && !job.annualSalaryMax) return undefined;
  const currency = job.salaryCurrency || "USD";
  const fmt = (v: string) => `${currency} ${parseInt(v).toLocaleString()}`;
  if (job.annualSalaryMin && job.annualSalaryMax) {
    return `${fmt(job.annualSalaryMin)} – ${fmt(job.annualSalaryMax)}/yr`;
  }
  return `${fmt(job.annualSalaryMin || job.annualSalaryMax || "0")}/yr`;
}

export async function fetchJobicy(): Promise<Job[]> {
  const results: Job[] = [];
  const seen = new Set<number>();
  const allJobs: JobicyJob[] = [];
  let droppedNoVisa = 0;
  let droppedCitizenship = 0;
  let droppedNoSkills = 0;

  // Jobicy only supports one industry per request — call separately
  for (const industry of ["dev"]) {
    try {
      const res = await fetch(`https://jobicy.com/api/v2/remote-jobs?count=50&industry=${industry}`, {
        headers: { Accept: "application/json", "User-Agent": "JobRadar/1.0" },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        console.warn(`[Jobicy] HTTP ${res.status} for industry=${industry}`);
        continue;
      }
      const json = (await res.json()) as JobicyResponse;
      for (const j of json.jobs || []) {
        if (!seen.has(j.id)) {
          seen.add(j.id);
          allJobs.push(j);
        }
      }
    } catch (err) {
      console.warn(`[Jobicy] Error for industry=${industry}:`, err);
    }
  }

  console.log(`[Jobicy] Fetched ${allJobs.length} raw jobs, running visa keyword detection...`);

  for (const raw of allJobs) {
    const descText = stripHtml(raw.jobDescription || raw.jobExcerpt || "");
    const combinedText = `${raw.jobTitle} ${descText}`;

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
    if (isClearlyNonFrontend(raw.jobTitle)) {
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

    const postedAt = new Date(raw.pubDate).toISOString();
    const recencyScore = computeRecencyScore(postedAt);
    const relocationBonus = computeRelocationBonus(descText);
    const totalScore = computeTotalScore(skillMatchScore, recencyScore, relocationBonus);

    const location = raw.jobGeo && raw.jobGeo !== "Anywhere" ? raw.jobGeo : "Remote";
    const { country, flag } = getCountryFromLocation(location);

    results.push({
      id: `jobicy_${raw.id}`,
      source: "jobicy",
      title: raw.jobTitle,
      company: raw.companyName,
      location,
      country,
      countryFlag: flag,
      url: raw.url,
      description: descText,
      salary: buildSalary(raw),
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
    `[Jobicy] Pipeline: ${allJobs.length} fetched → ${droppedNoVisa} no visa → ${droppedCitizenship} citizenship → ${droppedNoSkills} no skills → ${results.length} passed`
  );
  return results;
}
