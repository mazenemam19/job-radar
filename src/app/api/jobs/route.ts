import { NextRequest, NextResponse } from "next/server";
import { getJobs, getMeta } from "@/lib/storage";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const country = searchParams.get("country") ?? "";
  const minScore = parseInt(searchParams.get("minScore") ?? "0");
  const visaOnly = searchParams.get("visaOnly") === "true";
  const relocationOnly = searchParams.get("relocationOnly") === "true";
  const search = (searchParams.get("search") ?? "").toLowerCase();
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = parseInt(searchParams.get("limit") ?? "30");

  let jobs = getJobs();

  // Apply filters
  if (country) {
    jobs = jobs.filter((j) => j.countryCode.toUpperCase() === country.toUpperCase());
  }
  if (minScore > 0) {
    jobs = jobs.filter((j) => j.totalScore >= minScore);
  }
  if (visaOnly) {
    jobs = jobs.filter((j) => j.hasVisaSponsorship);
  }
  if (relocationOnly) {
    jobs = jobs.filter((j) => j.hasRelocation);
  }
  if (search) {
    jobs = jobs.filter(
      (j) =>
        j.title.toLowerCase().includes(search) ||
        j.company.toLowerCase().includes(search) ||
        j.location.toLowerCase().includes(search)
    );
  }

  // Paginate
  const total = jobs.length;
  const start = (page - 1) * limit;
  const paginatedJobs = jobs.slice(start, start + limit);

  const meta = getMeta();

  return NextResponse.json({
    jobs: paginatedJobs,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    lastFetchedAt: meta.lastFetchedAt,
    totalFetched: meta.totalFetched,
  });
}
