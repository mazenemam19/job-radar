import { NextResponse } from "next/server";
import { readStore } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const store = await readStore();
  const id = params.id;

  // Robust matching: trim and case-insensitive
  const job = store.jobs.find((j) => {
    const jobID = j.id.trim();
    const targetID = id.trim();
    return jobID === targetID || jobID.toLowerCase() === targetID.toLowerCase();
  });

  if (!job) {
    console.error(`[api/jobs/[id]] Job NOT found: "${id}"`);
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(job, {
    headers: {
      "Cache-Control": "no-store, max-age=0, must-revalidate",
    },
  });
}
