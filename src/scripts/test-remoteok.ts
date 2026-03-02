import { fetchRemoteOK } from "../lib/sources/ats-utils";
import { JobMode } from "../lib/types";

async function main() {
  const boardName = "RemoteOK";
  console.log("Starting standalone test for " + boardName + "...");

  try {
    const jobs = await fetchRemoteOK("global" as JobMode);

    console.log("Results: Fetched " + jobs.length + " jobs total.");

    if (jobs.length > 0) {
      console.log("Sample Job (First Match):");
      console.log("Title: " + jobs[0].title);
      console.log("Company: " + jobs[0].company);
      console.log("Score: " + jobs[0].totalScore);
    } else {
      console.log("No jobs found on RemoteOK.");
    }
  } catch (error) {
    console.error("Test failed:", error);
    process.exit(1);
  }
}

main().catch(console.error);
