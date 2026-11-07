// src/app/api/jobs/[id]/route.ts
// Returns a single scored job for the detail page, looked up from the
// requesting user's own cached jobs (the same data their dashboard shows).
// This guarantees the detail page always matches what the user saw on their
// dashboard — same score, same gemini_reason — rather than recomputing with
// settings that may have changed since.

import { NextResponse, type NextRequest } from "next/server";
import { getUser, createServerClient } from "@/lib/supabase/server";
import type { ScoredJob } from "@/lib/types";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const db = await createServerClient();

  const { data: cache } = await db
    .from("user_jobs_cache")
    .select("jobs")
    .eq("user_id", user.id)
    .single();

  const jobs = (cache?.jobs as unknown as ScoredJob[]) ?? [];
  const job = jobs.find((j) => j.id === id);

  if (!job) {
    return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, data: job });
}
