// src/app/api/strategy/route.ts

import { NextResponse, type NextRequest } from "next/server";
import { getUser, createServerClient } from "@/lib/supabase/server";
import { generateApplicationStrategy } from "@/lib/gemini";
import { resolveUserSettings } from "@/lib/settings";

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  let body: {
    job?: { title: string; company: string; description: string };
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.job?.title || !body.job?.description) {
    return NextResponse.json(
      { ok: false, error: "job.title and job.description are required" },
      { status: 400 },
    );
  }

  const db = createServerClient();
  const { data: profile } = await db
    .from("user_profiles")
    .select("gemini_api_key")
    .eq("id", user.id)
    .single();

  if (!profile?.gemini_api_key) {
    return NextResponse.json({ ok: false, error: "No Gemini API key configured" }, { status: 422 });
  }

  const settings = await resolveUserSettings(user.id);
  const userSkills = [...settings.expert_skills, ...settings.secondary_skills];

  try {
    const result = await generateApplicationStrategy(profile.gemini_api_key, body.job, userSkills);
    return NextResponse.json({ ok: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
