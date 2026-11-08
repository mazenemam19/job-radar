/** Public, non-secret contact point for company-directory requests. */
export const COMPANY_DIRECTORY_SUPPORT_EMAIL = "jobradarnoreply@gmail.com";

const REMOVAL_REQUEST_SUBJECT = "Job Radar company directory removal request";
const REMOVAL_REQUEST_BODY = `Hello Job Radar team,

Please remove our company from the public Job Radar company directory.

Company name:
Reason (optional):

Thank you.`;

/**
 * Creates the public mailto link for a directory removal request. The app does
 * not send, store, or track the request; the visitor's mail client handles it.
 */
export function companyDirectoryRemovalMailto(): string {
  const params = new URLSearchParams({
    subject: REMOVAL_REQUEST_SUBJECT,
    body: REMOVAL_REQUEST_BODY,
  });

  return `mailto:${COMPANY_DIRECTORY_SUPPORT_EMAIL}?${params.toString()}`;
}
