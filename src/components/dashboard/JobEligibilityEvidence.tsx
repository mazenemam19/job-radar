import { getJobEligibilityClues } from "@/lib/job-context";
import type { WorkAuthorizationStatus } from "@/lib/job-signals";
import type { ScoredJob } from "@/lib/types";

const AUTHORIZATION_LABELS: Record<WorkAuthorizationStatus, string> = {
  sponsorship_available: "Sponsorship stated as available",
  sponsorship_unavailable: "Sponsorship stated as unavailable",
  authorization_required: "Work authorization is required",
  unclear: "Work authorization is unclear",
};

export default function JobEligibilityEvidence({ job }: { job: ScoredJob }) {
  const clues = getJobEligibilityClues(job);

  return (
    <details className="mt-2 rounded-md border border-slate-800 bg-slate-950/40 px-3 py-2 text-[11px] text-slate-400">
      <summary className="cursor-pointer font-medium text-slate-300">
        Language and work-authorization clues
      </summary>
      <div className="mt-2 space-y-2 leading-relaxed">
        <section>
          <h3 className="m-0 text-[11px] font-semibold text-slate-300">Language</h3>
          {clues.languages.length > 0 ? (
            <p className="m-0">
              Mentioned: {clues.languages.join(", ")}. A mention does not always mean the language
              is required.
            </p>
          ) : (
            <p className="m-0">No clear language clue found; language fit is uncertain.</p>
          )}
          {clues.languageEvidence && (
            <blockquote className="m-0 border-l border-slate-700 pl-2">
              “{clues.languageEvidence}”
            </blockquote>
          )}
        </section>
        <section>
          <h3 className="m-0 text-[11px] font-semibold text-slate-300">Work authorization</h3>
          <p className="m-0">{AUTHORIZATION_LABELS[clues.workAuthorizationStatus]}</p>
          {clues.workAuthorizationEvidence ? (
            <blockquote className="m-0 border-l border-slate-700 pl-2">
              “{clues.workAuthorizationEvidence}”
            </blockquote>
          ) : clues.authorizationSourceFlag &&
            clues.workAuthorizationStatus === "sponsorship_available" ? (
            <p className="m-0">
              The ATS source marks sponsorship; no supporting sentence was captured.
            </p>
          ) : (
            <p className="m-0">
              No supporting statement was captured. Review the employer posting.
            </p>
          )}
          <p className="m-0 text-slate-500">This clue does not determine your legal eligibility.</p>
        </section>
      </div>
    </details>
  );
}
