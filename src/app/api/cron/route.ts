import { NextRequest, NextResponse } from "next/server";
import { runFetch } from "@/lib/runner";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const log = await runFetch();
    return NextResponse.json({ success: true, ...log });
  } catch (err) {
    console.error("[/api/cron] Error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
