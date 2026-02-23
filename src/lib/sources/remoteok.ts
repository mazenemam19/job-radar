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

interface RemoteOKJob {
  id: string;
  url: string;
  title: string;
  company: string;
  description: string; // full HTML
  tags: string[];
  date: string; // ISO
  salary_min?: number;
  salary_max?: number;
  location?: string;
  legal?: string; // first item in array is metadata, skip it
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildSalary(job: RemoteOKJob): string | undefined {
  if (!job.salary_min && !job.salary_max) return undefined;
  const fmt = (v: number) => `$${(v / 1000).toFixed(0)}k`;
  if (job.salary_min && job.salary_max) return `${fmt(job.salary_min)} – ${fmt(job.salary_max)}/yr`;
  return `${fmt(job.salary_min || job.salary_max || 0)}/yr`;
}

export async function fetchRemoteOK(): Promise<Job[]> {
  const results: Job[] = [];
  let totalFetched = 0;
  let withVisa = 0;
  let droppedNoVisa = 0;
  let droppedCitizenship = 0;
  let droppedNoSkills = 0;

  try {
    // RemoteOK requires a User-Agent or returns 403
    const res = await fetch("https://remoteok.com/api", {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; JobRadar/1.0)",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      console.warn(`[RemoteOK] HTTP ${res.status}`);
      return [];
    }

    const raw = (await res.json()) as RemoteOKJob[];

    // First element is always a legal/metadata object — filter it out
    const allJobs = raw.filter((j) => !j.legal && j.id && j.title);

    // Pre-filter by tags to reduce noise — only frontend-relevant roles
    const FRONTEND_TAGS = new Set([
      "react",
      "frontend",
      "front-end",
      "typescript",
      "javascript",
      "nextjs",
      "vue",
      "angular",
      "css",
      "html",
      "ui",
      "ux",
      "fullstack",
      "full-stack",
      "node",
      "redux",
    ]);
    const jobs = allJobs.filter((j) => (j.tags || []).some((t) => FRONTEND_TAGS.has(t.toLowerCase())));
    totalFetched = jobs.length;

    console.log(
      `[RemoteOK] Fetched ${allJobs.length} total, ${totalFetched} frontend-relevant, running visa keyword detection...`
    );

    for (const job of jobs) {
      const descText = stripHtml(job.description || "");
      // Also include tags in combined text since RemoteOK tags are descriptive
      const tagsText = (job.tags || []).join(" ");
      const combinedText = `${job.title} ${tagsText} ${descText}`;

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

      const postedAt = new Date(job.date).toISOString();
      const recencyScore = computeRecencyScore(postedAt);
      const relocationBonus = computeRelocationBonus(descText);
      const totalScore = computeTotalScore(skillMatchScore, recencyScore, relocationBonus);

      const location = job.location || "Remote";
      const { country, flag } = getCountryFromLocation(location);

      results.push({
        id: `remoteok_${job.id}`,
        source: "remoteok",
        title: job.title,
        company: job.company,
        location,
        country,
        countryFlag: flag,
        url: job.url,
        description: descText,
        salary: buildSalary(job),
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
    console.warn("[RemoteOK] Fetch error:", err);
    return [];
  }

  console.log(
    `[RemoteOK] Pipeline: ${totalFetched} fetched → ${droppedNoVisa} no visa → ${withVisa} with visa → ${droppedCitizenship} dropped (citizenship) → ${droppedNoSkills} dropped (no skill match) → ${results.length} passed`
  );

  return results;
}
