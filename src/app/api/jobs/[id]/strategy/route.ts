// src/app/api/jobs/[id]/strategy/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getJobById } from "@/lib/storage";
import { generateApplicationStrategy } from "@/lib/gemini";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;

  // Validate secret in production
  if (process.env.NODE_ENV === "production") {
    const secret = req.headers.get("x-cron-secret");
    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (!id) {
    return NextResponse.json({ error: "Job ID is required" }, { status: 400 });
  }

  const job = await getJobById(decodeURIComponent(id));

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  try {
    const strategy = await generateApplicationStrategy(job);
    return NextResponse.json({ strategy });
  } catch (err) {
    console.error("Strategy API error:", err);
    return NextResponse.json({ error: "Failed to generate strategy" }, { status: 500 });
  }
}
