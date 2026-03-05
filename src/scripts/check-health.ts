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
  console.log("--- Full Egyptian Tech Health ---");
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
    "Trella",
    "ExpandCart",
    "Rabbit",
    "Siemens EDA",
    "Orange Business",
    "Speer",
    "Yassir",
    "Algoriza",
    "Khazna Tech",
    "valU",
    "Homzmart",
    "Swvl",
    "Klivvr",
    "Nawy",
    "Dubizzle",
    "Rubikal",
    "Blink22",
    "Squadio",
    "Vezeeta",
    "Moneyfellows",
    "Flextock",
    "Sideup",
    "Cartona",
    "Taager",
    "NearPay",
    "Lean Technologies",
    "Atomica",
    "Advansys",
    "Sumerge",
    "Integrant",
    "Eva Pharma",
    "SWATX",
    "ArpuPlus",
    "Instabug",
    "MaxAB",
  ];
  Object.entries(log.sourceDetails || {}).forEach(([name, health]) => {
    if (egy.includes(name)) {
      console.log(`  - ${name}: ${health.count} jobs | ${health.error || "No error"}`);
    }
  });
}

main().catch(console.error);
