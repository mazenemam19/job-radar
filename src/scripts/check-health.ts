// src/scripts/check-health.ts
import { config } from "dotenv";
import path from "path";
config({ path: path.resolve(process.cwd(), ".env.local") });
import { readStore } from "../lib/storage";

async function main() {
  const store = await readStore();
  const log = store.cronLogs[0];
  if (!log) {
    console.log("No logs found.");
    return;
  }
  console.log("Run At:", log.runAt);
  console.log("--- Egyptian Company Health ---");
  const egy = [
    "Bosta",
    "Paymob",
    "Lucky",
    "Yodawy",
    "Sary",
    "Breadfast",
    "Thndr",
    "MoneyHash",
    "Robosta",
    "Robusta",
    "Brimore",
    "Koinz",
    "Trella",
    "ExpandCart",
    "Rabbit",
  ];
  Object.entries(log.sourceDetails || {}).forEach(([name, health]) => {
    if (egy.includes(name)) {
      console.log(`  - ${name}: ${health.count} jobs | ${health.error || "No error"}`);
    }
  });
}

main().catch(console.error);
