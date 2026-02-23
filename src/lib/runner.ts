import { fetchArbeitnow } from "./sources/arbeitnow";
import { fetchRemotive } from "./sources/remotive";
import { fetchJobicy } from "./sources/jobicy";
import { fetchRemoteOK } from "./sources/remoteok";
import { readStore, writeStore, mergeJobs } from "./storage";
import { sendNewJobsEmail } from "./email";
import { CronLog, Job } from "./types";

export async function runFetch(): Promise<CronLog> {
  console.log("\n========== Job Radar Fetch Started ==========");
  console.log(new Date().toISOString());

  const [arbeitnowJobs, remotiveJobs, jobicyJobs, remoteokJobs] = await Promise.all([
    fetchArbeitnow().catch((err) => {
      console.error("[Arbeitnow] Fatal:", err);
      return [] as Job[];
    }),
    fetchRemotive().catch((err) => {
      console.error("[Remotive] Fatal:", err);
      return [] as Job[];
    }),
    fetchJobicy().catch((err) => {
      console.error("[Jobicy] Fatal:", err);
      return [] as Job[];
    }),
    fetchRemoteOK().catch((err) => {
      console.error("[RemoteOK] Fatal:", err);
      return [] as Job[];
    }),
  ]);

  const allNew = [...arbeitnowJobs, ...remotiveJobs, ...jobicyJobs, ...remoteokJobs];

  console.log(
    `[Fetch] Arbeitnow: ${arbeitnowJobs.length} | Remotive: ${remotiveJobs.length} | Jobicy: ${jobicyJobs.length} | RemoteOK: ${remoteokJobs.length} | Total: ${allNew.length}`
  );

  const store = readStore();
  const existingIds = new Set(store.jobs.map((j) => j.id));

  const { store: updatedStore, added, skipped } = mergeJobs(store, allNew);

  console.log(`[Store] Added: ${added}, Skipped (duplicates): ${skipped}`);
  writeStore(updatedStore);
  console.log(`[Store] Saved ${updatedStore.jobs.length} total jobs`);

  if (added > 0) {
    const newJobsForEmail = allNew.filter((j) => !existingIds.has(j.id)).sort((a, b) => b.totalScore - a.totalScore);
    console.log(`[Email] Sending notification for ${newJobsForEmail.length} new jobs`);
    await sendNewJobsEmail(newJobsForEmail);
  } else {
    console.log("[Email] No new jobs — skipping notification");
  }

  console.log("========== Job Radar Fetch Complete ==========\n");

  return {
    arbeitnowFetched: arbeitnowJobs.length,
    remotiveFetched: remotiveJobs.length + jobicyJobs.length + remoteokJobs.length,
    passedFilters: allNew.length,
    added,
    skipped,
  };
}
