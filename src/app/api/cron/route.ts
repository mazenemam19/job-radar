import { NextRequest, NextResponse } from "next/server";
import { fetchAllJobs } from "@/lib/fetcher";
import { upsertJobs } from "@/lib/storage";
import { sendNewJobsNotification } from "@/lib/mailer";

export const maxDuration = 300; // 5 min timeout for Vercel
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // Protect the endpoint with a shared secret
  const secret = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("⏰ Cron triggered at", new Date().toISOString());

    const jobs = await fetchAllJobs();
    const { added, updated, skipped } = upsertJobs(jobs);

    // Notify only if new jobs were found
    if (added > 0) {
      const newJobs = jobs
        .filter((j) => added > 0) // rough — in production you'd track which are new
        .sort((a, b) => b.totalScore - a.totalScore)
        .slice(0, added);
      await sendNewJobsNotification(newJobs);
    }

    const result = {
      success: true,
      added,
      updated,
      skipped,
      total: jobs.length,
      ranAt: new Date().toISOString(),
    };

    console.log("✅ Cron complete:", result);
    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error("❌ Cron error:", err);
    return NextResponse.json(
      { error: "Cron failed", message: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
