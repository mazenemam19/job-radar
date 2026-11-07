import { detectWorkAuthorizationSignal, type WorkAuthorizationStatus } from "./job-signals";
import { extractLanguageClues } from "./job-normalization";
import type { RawJob } from "./types";

export interface JobEligibilityClues {
  languages: string[];
  languageEvidence: string | null;
  workAuthorizationStatus: WorkAuthorizationStatus;
  workAuthorizationEvidence: string | null;
  authorizationSourceFlag: boolean;
}

export function getJobEligibilityClues(
  job: Pick<
    RawJob,
    | "title"
    | "description"
    | "language_requirements"
    | "language_evidence"
    | "work_authorization_status"
    | "work_authorization_evidence"
    | "visa_sponsorship"
  >,
): JobEligibilityClues {
  const text = `${job.title}\n${job.description}`;
  const detectedLanguage = extractLanguageClues(text);
  const detectedAuthorization = detectWorkAuthorizationSignal(text);
  const workAuthorizationStatus = job.work_authorization_evidence
    ? (job.work_authorization_status ?? detectedAuthorization.status)
    : detectedAuthorization.status !== "unclear"
      ? detectedAuthorization.status
      : (job.work_authorization_status ??
        (job.visa_sponsorship ? "sponsorship_available" : "unclear"));

  return {
    languages: job.language_requirements?.length
      ? job.language_requirements
      : detectedLanguage.requirements,
    languageEvidence: job.language_evidence ?? detectedLanguage.evidence,
    workAuthorizationStatus,
    workAuthorizationEvidence: job.work_authorization_evidence ?? detectedAuthorization.evidence,
    authorizationSourceFlag: Boolean(job.visa_sponsorship),
  };
}
