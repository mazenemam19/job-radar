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
  jobDescription: string; // full HTML
  pubDate: string;
  annualSalaryMin?: string;
  annualSalaryMax?: string;
  salaryCurrency?: string;
}

interface JobicyResponse {
  friendlyNotice?: string;
  jobCount: number;
  jobs: JobicyJob[];
}

function stripHtml(html: string): string {
  return html
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
  let totalFetched = 0;
  let withVisa = 0;
  let droppedNoVisa = 0;
  let droppedCitizenship = 0;
  let droppedNoSkills = 0;

  // Fetch dev jobs — max 50 per call (API limit)
  try {
    const res = await fetch("https://jobicy.com/api/v2/remote-jobs?count=50&industry=dev", {
      headers: { Accept: "application/json", "User-Agent": "JobRadar/1.0" },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      console.warn(`[Jobicy] HTTP ${res.status}`);
      return [];
    }

    const json = (await res.json()) as JobicyResponse;
    const jobs = json.jobs || [];
    totalFetched = jobs.length;

    console.log(`[Jobicy] Fetched ${totalFetched} raw jobs, running visa keyword detection...`);

    for (const raw of jobs) {
      const descText = stripHtml(raw.jobDescription || raw.jobExcerpt || "");
      const combinedText = `${raw.jobTitle} ${descText}`;

      const visaResult = detectVisaSponsorship(combinedText);
      if (!visaResult.sponsored) {
        droppedNoVisa++;
        continue;
      }
      withVisa++;

      if (requiresCitizenshipOrClearance(combinedText)) {
        droppedCitizenship++;
        continue;
      }

      const { matchedSkills, missingSkills, skillMatchScore } = computeSkillMatch(combinedText);
      if (matchedSkills.length === 0) {
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
  } catch (err) {
    console.warn("[Jobicy] Fetch error:", err);
    return [];
  }

  console.log(
    `[Jobicy] Pipeline: ${totalFetched} fetched → ${droppedNoVisa} no visa → ${withVisa} with visa → ${droppedCitizenship} dropped (citizenship) → ${droppedNoSkills} dropped (no skill match) → ${results.length} passed`
  );

  return results;
}
