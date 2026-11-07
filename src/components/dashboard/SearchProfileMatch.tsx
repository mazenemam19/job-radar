import type { ScoredJob } from "@/lib/types";

export default function SearchProfileMatch({ job }: { job: ScoredJob }) {
  const match = job.search_profile_match;
  if (!match || (match.reasons.length === 0 && match.uncertainties.length === 0)) return null;

  return (
    <div
      aria-label="Search profile match"
      className="mt-2 text-[11px] leading-relaxed text-slate-400"
    >
      {match.reasons.length > 0 && (
        <p>
          <span className="font-semibold text-slate-300">Matched your profile:</span>{" "}
          {match.reasons.join(" · ")}
        </p>
      )}
      {match.uncertainties.map((uncertainty) => (
        <p key={uncertainty} className="text-amber-400">
          Review: {uncertainty}
        </p>
      ))}
    </div>
  );
}
