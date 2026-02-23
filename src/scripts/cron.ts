// Load env vars for standalone script
import path from "path";
// eslint-disable-next-line @typescript-eslint/no-var-requires
require("dotenv").config({ path: path.join(process.cwd(), ".env.local") });

import { runFetch } from "../lib/runner";

async function main() {
  try {
    const log = await runFetch();
    console.log("Summary:", log);
    process.exit(0);
  } catch (err) {
    console.error("Cron failed:", err);
    process.exit(1);
  }
}

main();
