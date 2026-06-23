// src/app/api/tracker/route.ts

import { NextResponse, type NextRequest } from "next/server";
import { getUser, createServerClient } from "@/lib/supabase/server";
import { VALID_STATUSES } from "@/lib/constants";
import type { TrackerStatus, TrackerJobSnapshot } from "@/lib/types";
import type { Json } from "@/lib/database.types";

// ── GET /api/tracker ──────────────────────────────────────

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const db = createServerClient();
  const { data, error } = await db
    .from("tracker_entries")
    .select("*")
    .eq("user_id", user.id)
    .order("last_status_change", { ascending: false });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, data });
}

// ── POST /api/tracker ─────────────────────────────────────

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  let body: {
    job_id?: string;
    job_snapshot?: TrackerJobSnapshot;
    status?: TrackerStatus;
    notes?: string;
    applied_at?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.job_id || !body.job_snapshot) {
    return NextResponse.json(
      { ok: false, error: "job_id and job_snapshot are required" },
      { status: 400 },
    );
  }

  const status: TrackerStatus = VALID_STATUSES.includes(body.status as TrackerStatus)
    ? (body.status as TrackerStatus)
    : "saved";

  const db = createServerClient();
  const now = new Date().toISOString();

  const { data, error } = await db
    .from("tracker_entries")
    .upsert(
      {
        user_id: user.id,
        job_id: body.job_id,
        job_snapshot: body.job_snapshot as unknown as Json,
        status,
        notes: body.notes ?? null,
        applied_at: body.applied_at ?? null,
        last_status_change: now,
        updated_at: now,
      },
      { onConflict: "user_id,job_id" },
    )
    .select()
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, data });
}
