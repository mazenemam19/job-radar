// src/lib/tracker-route.ts
// Pure utility for PATCH /api/tracker/[id].
// Decoupled from Next.js and Supabase for direct unit testing.

import { VALID_STATUSES } from "@/lib/constants";
import type { TrackerStatus } from "@/lib/types";
import type { Database } from "@/lib/database.types";

export type TrackerUpdatePatch = Database["public"]["Tables"]["tracker_entries"]["Update"];

/**
 * The parsed JSON body of PATCH /api/tracker/[id].
 * Matches the original inline body type in the route handler so TypeScript
 * can check usage before and after validation.
 */
export type TrackerPatchBody = {
  status?: string;
  notes?: string;
  applied_at?: string;
};

/**
 * Builds the update payload for a tracker entry from the request body.
 * Normalizes inputs and sets proper timestamps.
 */
export function buildTrackerPatch(body: TrackerPatchBody, now: string): TrackerUpdatePatch {
  const patch: TrackerUpdatePatch = { updated_at: now };

  if (body.status && VALID_STATUSES.includes(body.status as TrackerStatus)) {
    patch.status = body.status;
    patch.last_status_change = now;
  }

  if ("notes" in body) {
    patch.notes = typeof body.notes === "string" ? body.notes : null;
  }

  if ("applied_at" in body) {
    patch.applied_at = typeof body.applied_at === "string" ? body.applied_at : null;
  }

  return patch;
}
