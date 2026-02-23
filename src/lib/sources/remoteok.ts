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

// RemoteOK returns an array where item[0] is metadata
interface RemoteOKMeta {
  last_updated?: string;
  legal?: string;
}

interface RemoteOKJob {
  slug?: string; // their ID field (not "id")
  url?: string;
  apply_url?: string;
  position?: string; // NOT "title" — RemoteOK uses "position"
  company?: string;
  description?: string;
  tags?: string[];
  date?: string;
  epoch?: number;
  salary_min?: number;
  salary_max?: number;
  location?: string;
  // metadata marker
  legal?: string;
  last_updated?: string;
}

function stripHtml(html: string): string {
  return (html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildSalary(job: RemoteOKJob): string | undefined {
  if (!job.salary_min && !job.salary_max) return undefined;
  const fmt = (v: number) => `$${Math.round(v / 1000)}k`;
  if (job.salary_min && job.salary_max) return `${fmt(job.salary_min)} – ${fmt(job.salary_max)}/yr`;
  return `${fmt(job.salary_min || job.salary_max || 0)}/yr`;
}

const FRONTEND_TAGS = new Set([
  "react",
  "reactjs",
  "frontend",
  "front-end",
  "typescript",
  "javascript",
  "nextjs",
  "next.js",
  "vue",
  "vuejs",
  "angular",
  "css",
  "html",
  "ui",
  "ux",
  "fullstack",
  "full-stack",
  "nodejs",
  "node",
  "redux",
  "svelte",
  "webpack",
  "vite",
]);

export async function fetchRemoteOK(): Promise<Job[]> {
  const results: Job[] = [];
  let rawTotal = 0;
  let totalFetched = 0;
  let withVisa = 0;
  let droppedNoVisa = 0;
  let droppedCitizenship = 0;
  let droppedNoSkills = 0;

  try {
    const res = await fetch("https://remoteok.com/api", {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) {
      console.warn(`[RemoteOK] HTTP ${res.status}`);
      return [];
    }

    const raw = (await res.json()) as RemoteOKJob[];
    rawTotal = raw.length;

    // Skip first item (metadata), filter to actual job objects
    // Filter out metadata item; don't check !j.legal as it may exist on all items
    const allJobs = raw.slice(1).filter((j) => j.position);

    // Pre-filter by frontend tags
    const jobs = allJobs.filter((j) =>
      (j.tags || []).some((t) => FRONTEND_TAGS.has(t.toLowerCase().replace(/[\s.]/g, "")))
    );

    totalFetched = jobs.length;
    console.log(`[RemoteOK] ${rawTotal} raw → ${allJobs.length} real jobs → ${totalFetched} frontend-relevant`);

    for (const job of jobs) {
      const descText = stripHtml(job.description || "");
      const tagsText = (job.tags || []).join(" ");
      const combinedText = `${job.position} ${tagsText} ${descText}`;

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

      // Title filter: reject clearly non-frontend roles
      if (isClearlyNonFrontend(job.position!)) {
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

      const epoch = job.epoch || 0;
      const postedAt = epoch ? new Date(epoch * 1000).toISOString() : new Date(job.date || Date.now()).toISOString();

      const recencyScore = computeRecencyScore(postedAt);
      const relocationBonus = computeRelocationBonus(descText);
      const totalScore = computeTotalScore(skillMatchScore, recencyScore, relocationBonus);

      const location = job.location || "Remote";
      const { country, flag } = getCountryFromLocation(location);

      results.push({
        id: `remoteok_${job.slug || Math.random().toString(36).slice(2)}`,
        source: "remoteok",
        title: job.position!,
        company: job.company || "Unknown",
        location,
        country,
        countryFlag: flag,
        url: job.apply_url || job.url || `https://remoteok.com/remote-jobs/${job.slug}`,
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
    `[RemoteOK] Pipeline: ${totalFetched} frontend → ${droppedNoVisa} no visa → ${withVisa} with visa → ${droppedCitizenship} citizenship → ${droppedNoSkills} no skills → ${results.length} passed`
  );
  return results;
}
