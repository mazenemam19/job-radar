// src/lib/sources/ats-utils.ts
// Barrel re-export. The implementation lives in src/lib/sources/ats/ — split
// out of this single 962-line file per AUDIT_STATUS.md row #2 (815 lines,
// complexity 16 → per-fetcher files, each under the max-lines/complexity
// limits in .eslintrc.json). This file exists only so every existing
// `from "@/lib/sources/ats-utils"` import keeps working unchanged; the
// public API (every exported name below) is identical to before the split.
//
// Do not add new code here — add it to the relevant file under ./ats/.
export {
  resetWorkableUsed,
  setWorkableBudgetConfig,
  loadWorkableStateFromDB,
  flushDomainCountsToDB,
  flushWorkable429sToDB,
  getWorkable429SlugsThisRun,
  markWorkableSlugsBlocked24h,
} from "./ats/run-state";

export { safeFetch } from "./ats/http";

export { parseRelativeDate, stripHtml, processJobs, pLimit } from "./ats/job-processing";

export { fetchGreenhouse } from "./ats/greenhouse";
export { fetchLever } from "./ats/lever";
export { fetchAshby } from "./ats/ashby";
export { fetchWorkable } from "./ats/workable";
export { fetchTeamtailor } from "./ats/teamtailor";
export { fetchBreezy } from "./ats/breezy";
export { fetchSmartRecruiters } from "./ats/smart-recruiters";
export { fetchBambooHR } from "./ats/bamboohr";
export { fetchJazzHR } from "./ats/jazzhr";
