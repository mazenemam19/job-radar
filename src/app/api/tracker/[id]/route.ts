// src/app/api/tracker/[id]/route.ts
// Pure patch-building logic is extracted to lib/tracker-route.ts.

import { NextResponse, type NextRequest } from "next/server";
import { getUser, createServerClient } from "@/lib/supabase/server";
import { dbErrorResponse } from "@/lib/api-errors";
import { buildTrackerPatch, type TrackerPatchBody } from "@/lib/tracker-route";

// ── PATCH /api/tracker/[id] ───────────────────────────────

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  let body: TrackerPatchBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const patch = buildTrackerPatch(body, new Date().toISOString());
  const db = createServerClient();

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
