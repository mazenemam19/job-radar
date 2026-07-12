// src/lib/cron/dispatch-cursor.ts
// Rotation cursor for the "other" (non-Workable) dispatch bucket. Without
// this, ats_companies is walked in the same fixed order every run, so a
// time-budget skip always lands on whichever companies sit at the tail of
// that order — permanently, since nothing ever moves them off it. This
// module makes the starting point of that order rotate: each run resumes
// right after wherever the previous run actually stopped, so a company
// skipped this run gets dispatched first (or near-first) next run instead
// of being skipped again in the same spot. See
// docs/solutions/bugs/issue-52-dispatch-rotation-cursor.md.
import type { ATSCompanyRow } from "../types";
import type { Json } from "../database.types";
import type { DispatchCursor } from "@/types";

let cursorCache: DispatchCursor | null = null;
// Set only when recordDispatchCursor actually advances the cursor this run —
// distinguishes "nothing to persist" (empty bucket, or every task skipped
// before any dispatch happened) from "persist this value", the same way
// flushDomainCountsToDB/flushWorkable429sToDB already skip writing when
// there's nothing new.
let cursorDirty = false;

function compareRows(a: ATSCompanyRow, b: ATSCompanyRow): number {
  if (a.created_at !== b.created_at) return a.created_at < b.created_at ? -1 : 1;
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}

function isAfterCursor(row: ATSCompanyRow, cursor: DispatchCursor): boolean {
  if (row.created_at !== cursor.createdAt) return row.created_at > cursor.createdAt;
  return row.id > cursor.companyId;
}

/**
 * Sorts `rows` into FR1's stable order (created_at asc, id asc), then
 * rotates that order to begin right after the persisted cursor, wrapping to
 * the start once the order is exhausted.
 *
 * The rotation point is found by comparing sort-key *values*, not by
 * looking up the cursor's row by id — so a cursor company that's been
 * deactivated or deleted since it was persisted still resolves correctly:
 * the first row with a strictly greater sort key is "the next active
 * company after it", exactly per FR4, with no extra lookup and no special
 * case for "does this company still exist".
 */
export function sortAndRotate(rows: ATSCompanyRow[]): ATSCompanyRow[] {
  const sorted = [...rows].sort(compareRows);
  const cursor = cursorCache;
  if (!cursor) return sorted;

  const resumeIndex = sorted.findIndex((row) => isAfterCursor(row, cursor));
  if (resumeIndex === -1) return sorted; // cursor at/after the tail — wrap to start (FR4)
  return [...sorted.slice(resumeIndex), ...sorted.slice(0, resumeIndex)];
}

/**
 * Records this run's cursor: the last company, in `rotatedRows`' own order
 * (the actual sequence dispatch just used), that had at least one task
 * handed to fetchCompany. Deliberately scans the *rotated* order rather
 * than the canonical FR1 order — see the rotated-vs-canonical comparison in
 * the spec discussion this shipped with. Canonical-order cursors can get
 * stuck oscillating between only two companies under a sustained partial-
 * skip pattern; rotated-order cursors provably cycle through every company
 * once per full bucket-sized rotation instead.
 *
 * A run that dispatches everyone (no skip at all) leaves the cursor
 * pointing at the same company as before — harmless, since the rotation's
 * starting point only matters on a run where something actually gets
 * skipped.
 */
export function recordDispatchCursor(
  rotatedRows: ATSCompanyRow[],
  dispatchedCompanyIds: ReadonlySet<string>,
): void {
  let last: ATSCompanyRow | null = null;
  for (const row of rotatedRows) {
    if (dispatchedCompanyIds.has(row.id)) last = row;
  }
  if (!last) return; // bucket was empty, or nothing was ever dispatched — nothing to persist
  cursorCache = { companyId: last.id, createdAt: last.created_at };
  cursorDirty = true;
}

export async function loadDispatchCursorFromDB(): Promise<void> {
  const { createAdminClient } = await import("../supabase/admin");
  const db = createAdminClient();
  const { data, error } = await db
    .from("app_config")
    .select("dispatch_cursor")
    .eq("id", 1)
    .single();
  if (error) {
    console.error("[dispatch-cursor] loadDispatchCursorFromDB select failed:", error.message);
    return;
  }
  cursorCache = (data?.dispatch_cursor as unknown as DispatchCursor | null) ?? null;
  cursorDirty = false;
}

export async function flushDispatchCursorToDB(): Promise<void> {
  if (!cursorDirty) {
    console.log("[dispatch-cursor] flushDispatchCursorToDB: nothing to flush, skipping");
    return;
  }
  const { createAdminClient } = await import("../supabase/admin");
  const db = createAdminClient();
  const { error } = await db
    .from("app_config")
    .update({
      dispatch_cursor: cursorCache as unknown as Json,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  if (error) {
    console.error("[dispatch-cursor] flushDispatchCursorToDB update failed:", error.message);
    return; // keep cursorDirty true so a retry on a warm process can still send it
  }
  console.log(`[dispatch-cursor] flushDispatchCursorToDB: persisted ${cursorCache?.companyId}`);
  cursorDirty = false;
}
