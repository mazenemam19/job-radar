// src/app/api/tracker/[id]/route.ts

import { NextResponse, type NextRequest } from "next/server";
import { getUser, createServerClient } from "@/lib/supabase/server";
import { dbErrorResponse } from "@/lib/api-errors";
import { VALID_STATUSES } from "@/lib/constants";
import type { TrackerStatus } from "@/lib/types";
import type { Database } from "@/lib/database.types";

// ── PATCH /api/tracker/[id] ───────────────────────────────

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  let body: { status?: string; notes?: string; applied_at?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const db = createServerClient();
  const now = new Date().toISOString();

  const patch: Database["public"]["Tables"]["tracker_entries"]["Update"] = { updated_at: now };
  if (body.status && VALID_STATUSES.includes(body.status as TrackerStatus)) {
    patch.status = body.status;
    patch.last_status_change = now;
  }
  if ("notes" in body) patch.notes = typeof body.notes === "string" ? body.notes : null;
  if ("applied_at" in body)
    patch.applied_at = typeof body.applied_at === "string" ? body.applied_at : null;

  const { data, error } = await db
    .from("tracker_entries")
    .update(patch)
    .eq("id", params.id)
    .eq("user_id", user.id) // RLS-equivalent guard at app layer
    .select()
    .single();

  if (error) return dbErrorResponse("tracker/[id]:PATCH", error);
  if (!data) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  return NextResponse.json({ ok: true, data });
}

// ── DELETE /api/tracker/[id] ──────────────────────────────

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const db = createServerClient();
  const { error } = await db
    .from("tracker_entries")
    .delete()
    .eq("id", params.id)
    .eq("user_id", user.id);

  if (error) return dbErrorResponse("tracker/[id]:DELETE", error);

  return NextResponse.json({ ok: true });
}
