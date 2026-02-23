import {
  computeRecencyScore,
  computeRelocationBonus,
  computeSkillMatch,
  computeTotalScore,
  getCountryFromLocation,
  requiresCitizenshipOrClearance,
} from "../scoring";
import { Job } from "../types";
import { checkArbeitnowTags, detectVisaSponsorship } from "../visa";

interface ArbeitnowJob {
  slug: string;
  company_name: string;
  title: string;
  description: string;
  remote: boolean;
  url: string;
  tags: string[];
  job_types: string[];
  location: string;
  created_at: number;
  visa_sponsorship: boolean | undefined;
  salary?: string;
}

interface ArbeitnowResponse {
  data: ArbeitnowJob[];
  links?: unknown;
  meta?: unknown;
}

export async function fetchArbeitnow(): Promise<Job[]> {
  const results: Job[] = [];
  let totalFetched = 0;
  let withVisa = 0;
  let droppedCitizenship = 0;
  let droppedNoSkills = 0;
  let droppedNoVisa = 0;

  for (let page = 1; page <= 5; page++) {
    try {
      const res = await fetch(`https://www.arbeitnow.com/api/job-board-api?page=${page}`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        console.warn(`[Arbeitnow] Page ${page} returned HTTP ${res.status}`);
        break;
      }

      const json = (await res.json()) as ArbeitnowResponse;

      if (!json || !Array.isArray(json.data)) {
        console.warn(`[Arbeitnow] Page ${page}: unexpected response shape`);
        break;
      }

      if (json.data.length === 0) break;

      console.log(`[Arbeitnow] Page ${page}: ${json.data.length} raw jobs`);
      totalFetched += json.data.length;

      for (const raw of json.data) {
        const descText = raw.description || "";
        const combinedText = `${raw.title} ${descText}`;

        // Visa check: boolean field (if present and true) OR tags OR keyword detection on full description
        const booleanVisa = raw.visa_sponsorship === true;
        const tagVisa = checkArbeitnowTags(raw.tags || []);
        const keywordVisa = detectVisaSponsorship(combinedText);

        if (!booleanVisa && !tagVisa && !keywordVisa.sponsored) {
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
          console.log(
            `[Arbeitnow] Dropped (no skill match): "${raw.title}" @ ${raw.company_name} | tags: ${(raw.tags || []).join(
              ", "
            )}`
          );
          continue;
        }

        const postedAt = new Date(raw.created_at * 1000).toISOString();
        const recencyScore = computeRecencyScore(postedAt);
        const relocationBonus = computeRelocationBonus(descText);
        const totalScore = computeTotalScore(skillMatchScore, recencyScore, relocationBonus);

        const location = raw.remote ? "Remote" : raw.location || "Unknown";
        const { country, flag } = getCountryFromLocation(location);

        results.push({
          id: `arbeitnow_${raw.slug}`,
          source: "arbeitnow",
          title: raw.title,
          company: raw.company_name,
          location,
          country,
          countryFlag: flag,
          url: raw.url,
          description: descText,
          salary: raw.salary,
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
      console.warn(`[Arbeitnow] Error on page ${page}:`, err);
      break;
    }
  }

  console.log(
    `[Arbeitnow] Pipeline: ${totalFetched} fetched → ${droppedNoVisa} no visa → ${withVisa} with visa → ${droppedCitizenship} dropped (citizenship) → ${droppedNoSkills} dropped (no skill match) → ${results.length} passed`
  );

  return results;
}
