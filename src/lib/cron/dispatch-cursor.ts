// Durable rotation cursor for individual scheduled fetch tasks. A company can
// have both local and global pipelines, so the cursor includes its mode and
// never skips one pipeline merely because the other one started first.
import type { ATSCompanyRow, JobMode } from "../types";
import type { Json } from "../database.types";
import type { DispatchCursor } from "@/types";

export interface ScheduledFetchTask {
  row: ATSCompanyRow;
  mode: JobMode;
}

let cursorCache: DispatchCursor | null = null;
let cursorDirty = false;

function compareRows(a: ATSCompanyRow, b: ATSCompanyRow): number {
  if (a.created_at !== b.created_at) return a.created_at < b.created_at ? -1 : 1;
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}

function compareModes(a: JobMode, b: JobMode): number {
  if (a === b) return 0;
  return a === "local" ? -1 : 1;
}

function compareTasks(a: ScheduledFetchTask, b: ScheduledFetchTask): number {
  const rowComparison = compareRows(a.row, b.row);
  return rowComparison === 0 ? compareModes(a.mode, b.mode) : rowComparison;
}

function isAfterCursor(task: ScheduledFetchTask, cursor: DispatchCursor): boolean {
  if (task.row.created_at !== cursor.createdAt) return task.row.created_at > cursor.createdAt;
  if (task.row.id !== cursor.companyId) return task.row.id > cursor.companyId;
  // Old persisted cursors did not include a mode. They refer to the whole
  // company, so resume at the following company rather than re-running it.
  return cursor.mode ? compareModes(task.mode, cursor.mode) > 0 : false;
}

export function buildScheduledTasks(rows: ATSCompanyRow[]): ScheduledFetchTask[] {
  return rows.flatMap((row) => {
    const tasks: ScheduledFetchTask[] = [];
    if (row.pipeline_local) tasks.push({ row, mode: "local" });
    if (row.pipeline_global) tasks.push({ row, mode: "global" });
    return tasks;
  });
}

/** Sort tasks deterministically and resume after the last completed task. */
export function sortAndRotateTasks(tasks: ScheduledFetchTask[]): ScheduledFetchTask[] {
  const sorted = [...tasks].sort(compareTasks);
  const cursor = cursorCache;
  if (!cursor) return sorted;
  const resumeIndex = sorted.findIndex((task) => isAfterCursor(task, cursor));
  return resumeIndex === -1
    ? sorted
    : [...sorted.slice(resumeIndex), ...sorted.slice(0, resumeIndex)];
}

/** Compatibility helper for company-level callers. */
export function sortAndRotate(rows: ATSCompanyRow[]): ATSCompanyRow[] {
  const unique = new Map<string, ATSCompanyRow>();
  for (const task of sortAndRotateTasks(buildScheduledTasks(rows)))
    unique.set(task.row.id, task.row);
  return [...unique.values()];
}

/** Advance only through the contiguous completed prefix. A cancelled task is
 * left for the next run; a completed request that returns an ATS error moves
 * past that source instead of permanently blocking the schedule. */
export function recordDispatchCursor(
  orderedTasks: ScheduledFetchTask[],
  completedTaskKeys: ReadonlySet<string>,
): void;
export function recordDispatchCursor(
  orderedRows: ATSCompanyRow[],
  completedCompanyIds: ReadonlySet<string>,
): void;
export function recordDispatchCursor(
  ordered: ScheduledFetchTask[] | ATSCompanyRow[],
  completed: ReadonlySet<string>,
): void {
  const tasksWereProvided = ordered.length > 0 && "row" in ordered[0];
  if (!tasksWereProvided) {
    let lastRow: ATSCompanyRow | null = null;
    for (const row of ordered as ATSCompanyRow[]) {
      if (completed.has(row.id)) lastRow = row;
    }
    if (!lastRow) return;
    cursorCache = { companyId: lastRow.id, createdAt: lastRow.created_at };
    cursorDirty = true;
    return;
  }
  const orderedTasks = ordered as ScheduledFetchTask[];
  const completedTaskKeys = completed;
  let last: ScheduledFetchTask | null = null;
  for (const task of orderedTasks) {
    if (!completedTaskKeys.has(`${task.row.id}:${task.mode}`)) break;
    last = task;
  }
  if (!last) return;
  cursorCache = { companyId: last.row.id, createdAt: last.row.created_at, mode: last.mode };
  cursorDirty = true;
}

function isDispatchCursor(value: unknown): value is DispatchCursor {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.companyId === "string" &&
    typeof candidate.createdAt === "string" &&
    (candidate.mode === undefined || candidate.mode === "global" || candidate.mode === "local")
  );
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
  cursorCache = isDispatchCursor(data?.dispatch_cursor) ? data.dispatch_cursor : null;
  cursorDirty = false;
}

export async function flushDispatchCursorToDB(): Promise<string | null> {
  if (!cursorDirty) return null;
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
    return `Failed to persist dispatch cursor: ${error.message}`;
  }
  console.log(
    `[dispatch-cursor] persisted ${cursorCache?.companyId}:${cursorCache?.mode ?? "company"}`,
  );
  cursorDirty = false;
  return null;
}
