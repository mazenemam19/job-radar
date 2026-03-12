export interface ScoreInput {
  title: string;
  description: string;
  location: string;
  postedAt: string;
}

export interface ScoreResult {
  matchedSkills: string[];
  bonusSkills: string[];
  missingSkills: string[];
  skillMatchScore: number;
  recencyScore: number;
  relocationBonus: number;
  totalScore: number;
  redFlags: string[];
}
