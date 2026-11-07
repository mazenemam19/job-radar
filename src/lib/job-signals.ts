export type WorkAuthorizationStatus =
  | "sponsorship_available"
  | "sponsorship_unavailable"
  | "authorization_required"
  | "unclear";

export interface WorkAuthorizationSignal {
  status: WorkAuthorizationStatus;
  evidence: string | null;
}

function findEvidence(text: string, pattern: RegExp): string | null {
  const sentence = text.split(/(?<=[.!?])\s+|\n+/).find((part) => pattern.test(part));
  return sentence?.trim().slice(0, 320) ?? null;
}

const SPONSORSHIP_UNAVAILABLE =
  /\bno (?:visa )?sponsorship\b|\b(?:visa )?sponsorship (?:is )?(?:not available|unavailable|not offered|not provided)\b|\b(?:cannot|can't|unable to|will not|do not) sponsor\b|\bnot (?:able|willing) to sponsor\b|\bwithout (?:visa )?sponsorship\b/i;

const SPONSORSHIP_AVAILABLE =
  /\b(?:visa )?sponsorship (?:is )?(?:available|offered|provided|supported)\b|\b(?:we|the company) (?:can|will|do) sponsor\b|\b(?:can|will) sponsor (?:a )?visa\b|\beligible for (?:visa )?sponsorship\b/i;

const AUTHORIZATION_REQUIRED =
  /\b(?:must|need to|required to) (?:already )?(?:be )?(?:legally )?authorized to work\b|\bwork authorization (?:is )?required\b|\bright to work (?:is )?required\b|\bmust have (?:valid )?work authorization\b|\bmust be eligible to work in\b/i;

export function detectWorkAuthorizationSignal(text: string): WorkAuthorizationSignal {
  const unavailableEvidence = findEvidence(text, SPONSORSHIP_UNAVAILABLE);
  if (unavailableEvidence) {
    return { status: "sponsorship_unavailable", evidence: unavailableEvidence };
  }

  const availableEvidence = findEvidence(text, SPONSORSHIP_AVAILABLE);
  if (availableEvidence) {
    return { status: "sponsorship_available", evidence: availableEvidence };
  }

  const requiredEvidence = findEvidence(text, AUTHORIZATION_REQUIRED);
  if (requiredEvidence) {
    return { status: "authorization_required", evidence: requiredEvidence };
  }

  return { status: "unclear", evidence: null };
}

const RELOCATION_AVAILABLE =
  /\brelocation (?:support|assistance|package|allowance)\b|\bwe (?:will|can) assist with relocation\b/i;
const RELOCATION_UNAVAILABLE =
  /\bno relocation (?:support|assistance|package|allowance)\b|\brelocation (?:support|assistance|package) (?:is )?(?:not available|not offered|not provided)\b/i;

export function hasRelocationSupportEvidence(text: string): boolean {
  return !RELOCATION_UNAVAILABLE.test(text) && RELOCATION_AVAILABLE.test(text);
}
