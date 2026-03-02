import { fetchHimalayas } from "../lib/sources/himalayas";
import { JobMode } from "../lib/types";

async function main() {
  const boardName = "Himalayas";
  console.log("Starting standalone test for " + boardName + "...");

  try {
    const jobs = await fetchHimalayas("global" as JobMode);

    console.log("Results: " + jobs.length + " React jobs total (after filtering).");

    if (jobs.length > 0) {
      console.log("Sample Job (First Match):");
      console.log("Title: " + jobs[0].title);
      console.log("Company: " + jobs[0].company);
      console.log("Score: " + jobs[0].totalScore);
    } else {
      console.log("No React jobs found on Himalayas after extensive search.");
    }
  } catch (error) {
    console.error("Test failed:", error);
    process.exit(1);
  }
}

main().catch(console.error);
