// src/app/api/jobs/[id]/route.ts
// Returns a single scored job for the detail page, looked up from the
// requesting user's own cached jobs (the same data their dashboard shows).
// This guarantees the detail page always matches what the user saw on their
// dashboard — same score, same gemini_reason — rather than recomputing with
// settings that may have changed since.

import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ScoredJob } from "@/lib/types";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();

  const { data: cache } = await db
    .from("user_jobs_cache")
    .select("jobs")
    .eq("user_id", user.id)
    .single();

  const jobs = (cache?.jobs as unknown as ScoredJob[]) ?? [];
  const job = jobs.find((j) => j.id === params.id);

  if (!job) {
    return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, data: job });
}
