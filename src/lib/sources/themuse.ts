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

interface MuseJob {
  id: number;
  name: string;
  contents: string;
  publication_date: string;
  refs: { landing_page: string };
  company: { name: string };
  locations: { name: string }[];
  levels: { name: string }[];
  categories: { name: string }[];
}

interface MuseResponse {
  results: MuseJob[];
  page_count: number;
}

function stripHtml(html: string): string {
  return (html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const API_KEY = process.env.THEMUSE_API_KEY || "";
// Fetch Mid Level + Senior Level — 5 yrs exp fits both
const LEVELS = ["Mid Level", "Senior Level"];
const CATEGORIES = ["Engineering", "Software Engineer"];

export async function fetchTheMuse(): Promise<Job[]> {
  const results: Job[] = [];
  const seen = new Set<number>();
  let totalFetched = 0,
    withVisa = 0,
    droppedNoVisa = 0;
  let droppedCitizenship = 0,
    droppedNoSkills = 0;

  for (const level of LEVELS) {
    for (const category of CATEGORIES) {
      // Fetch 3 pages per combo (100 jobs each)
      for (let page = 0; page < 3; page++) {
        try {
          const params = new URLSearchParams({
            category,
            level,
            page: String(page),
            api_key: API_KEY,
            descended: "true",
          });
          const res = await fetch(`https://www.themuse.com/api/public/jobs?${params}`, {
            headers: { Accept: "application/json" },
            signal: AbortSignal.timeout(15000),
          });
          if (!res.ok) {
            console.warn(`[TheMuse] HTTP ${res.status} level=${level} cat=${category} page=${page}`);
            break;
          }
          const json = (await res.json()) as MuseResponse;
          const jobs = json.results || [];
          if (jobs.length === 0) break;

          for (const raw of jobs) {
            if (seen.has(raw.id)) continue;
            seen.add(raw.id);
            totalFetched++;

            const descText = stripHtml(raw.contents || "");
            const combinedText = `${raw.name} ${descText}`;

            if (isClearlyNonFrontend(raw.name)) {
              droppedNoSkills++;
              continue;
            }

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
            const coreMatches = matchedSkills.filter((s) => CORE_FRONTEND_SKILLS.has(s));
            if (coreMatches.length < MIN_CORE_SKILLS_REQUIRED) {
              droppedNoSkills++;
              continue;
            }

            const postedAt = new Date(raw.publication_date).toISOString();
            const recencyScore = computeRecencyScore(postedAt);
            const relocationBonus = computeRelocationBonus(descText);
            const totalScore = computeTotalScore(skillMatchScore, recencyScore, relocationBonus);

            const location = raw.locations?.[0]?.name || "Remote";
            const { country, flag } = getCountryFromLocation(location);

            results.push({
              id: `themuse_${raw.id}`,
              source: "themuse" as const,
              title: raw.name,
              company: raw.company?.name || "Unknown",
              location,
              country,
              countryFlag: flag,
              url: raw.refs?.landing_page || "",
              description: descText,
              salary: undefined,
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
          console.warn(`[TheMuse] Error:`, err);
          break;
        }
      }
    }
  }

  console.log(
    `[TheMuse] Pipeline: ${totalFetched} fetched → ${droppedNoVisa} no visa → ${withVisa} with visa → ${droppedCitizenship} citizenship → ${droppedNoSkills} no skills → ${results.length} passed`
  );
  return results;
}
