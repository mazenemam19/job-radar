/**
 * Keyword-based visa sponsorship detector.
 * Works reliably on full job descriptions (Arbeitnow + Remotive both return complete text).
 * The original "never use keyword matching" rule was specific to Adzuna's 200-char truncation.
 */

// Strong positive signals — any one of these = sponsored
const POSITIVE_PATTERNS: RegExp[] = [
  /visa\s+sponsor(ship|ed|ing|s)?/i,
  /sponsor\s+(a\s+)?visa/i,
  /work\s+permit\s+sponsor/i,
  /sponsor\s+work\s+permit/i,
  /we\s+(will\s+)?(provide|support|offer|cover|assist\s+with)\s+.{0,30}visa/i,
  /visa\s+(support|assistance|provided|included|covered)/i,
  /relocation\s+(package|support|assistance).{0,100}visa/i,
  /visa.{0,100}relocation\s+(package|support|assistance)/i,
  /immigration\s+support/i,
  /we\s+(help|assist|support)\s+(with\s+)?(your\s+)?immigration/i,
  /work\s+authoris?ation\s+(support|provided|sponsored)/i,
  /candidate[s]?\s+(from|outside).{0,60}(visa|sponsor)/i,
  /open\s+to\s+.{0,30}(visa|relocation)/i,
  /\bsponsor(ing|ed)?\b.{0,40}\b(candidates?|applicants?|workers?|engineers?|developers?)\b/i,
  /\b(candidates?|applicants?|workers?|engineers?|developers?)\b.{0,40}\bsponsor(ing|ed)?\b/i,
  /international\s+candidates?\s+(are\s+)?(welcome|encouraged|considered)/i,
  /we\s+welcome\s+international\s+(candidates?|applicants?)/i,
  /open\s+to\s+(candidates?\s+)?(from|worldwide|globally|across\s+the\s+world)/i,
  /visa\s+stamping/i,
  /h[-\s]?1b/i,
  /tier\s+2\s+visa/i,
  /skilled\s+worker\s+visa/i,
  /blue\s+card/i,
  /work\s+visa\s+(provided|sponsored|supported|covered)/i,
];

// Hard negative signals — checked FIRST, any match = not sponsored
const NEGATIVE_PATTERNS: RegExp[] = [
  /no\s+visa\s+sponsor/i,
  /not\s+able\s+to\s+sponsor/i,
  /unable\s+to\s+(provide\s+)?sponsor/i,
  /cannot\s+sponsor/i,
  /won'?t\s+sponsor/i,
  /does\s+not\s+sponsor/i,
  /sponsorship\s+(is\s+)?(not|unavailable)/i,
  /must\s+(already\s+)?(have|hold|possess).{0,40}(right\s+to\s+work|work\s+authoris|eligib)/i,
  /right\s+to\s+work\s+in.{0,40}(required|must|only)/i,
  /must\s+be\s+eligible\s+to\s+work/i,
  /eu\s+(citizens?|nationals?)\s+only/i,
  /uk\s+(citizens?|nationals?)\s+only/i,
  /us\s+(citizens?|nationals?)\s+only/i,
  /citizens?\s+or\s+permanent\s+residents?\s+only/i,
  /authorized\s+to\s+work\s+without\s+sponsor/i,
  /no\s+relocation/i,
];

export interface VisaCheckResult {
  sponsored: boolean;
  matchedPattern?: string;
  negativeMatch?: string;
}

export function detectVisaSponsorship(text: string): VisaCheckResult {
  for (const neg of NEGATIVE_PATTERNS) {
    if (neg.test(text)) {
      return { sponsored: false, negativeMatch: neg.source };
    }
  }
  for (const pos of POSITIVE_PATTERNS) {
    if (pos.test(text)) {
      return { sponsored: true, matchedPattern: pos.source };
    }
  }
  return { sponsored: false };
}

export function checkArbeitnowTags(tags: string[]): boolean {
  const visaTags = ["visa-sponsorship", "visa_sponsorship", "visa", "sponsorship", "relocation", "work-permit"];
  return tags.some((tag) => visaTags.includes(tag.toLowerCase()));
}
