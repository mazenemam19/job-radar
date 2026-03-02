import { readStore } from "../lib/storage";
import "dotenv/config"; // Load .env file

async function getSourceHealth() {
  const store = await readStore();
  if (store.cronLogs && store.cronLogs.length > 0) {
    if (store.cronLogs[0].sourceDetails) {
      console.log(JSON.stringify(store.cronLogs[0].sourceDetails, null, 2));
    } else {
      console.log("Latest cron log found, but no source details in it.");
      console.log("Full latest cron log:", JSON.stringify(store.cronLogs[0], null, 2));
    }
  } else {
    console.log("No cron logs found in the store. Store content:", JSON.stringify(store, null, 2));
  }
}

getSourceHealth();
