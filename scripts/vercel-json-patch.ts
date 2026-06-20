// IMPORTANT: This file shows the ADDITIONS needed to vercel.json.
// Do NOT replace your existing vercel.json — merge these cron entries with yours.
//
// Your current vercel.json likely has:
//   { "crons": [{ "path": "/api/cron", "schedule": "0 16 * * *" }] }
//
// Add the v2 cron alongside it:

/*
{
  "crons": [
    { "path": "/api/cron",    "schedule": "0 16 * * *" },  // existing — DO NOT REMOVE
    { "path": "/api/v2/cron", "schedule": "0 9 * * *"  }   // new v2 cron at 09:00 UTC
  ]
}
*/

// Paste the merged vercel.json manually. Never overwrite the existing /api/cron entry.
export {};
