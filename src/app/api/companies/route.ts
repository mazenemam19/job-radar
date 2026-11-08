import { NextResponse } from "next/server";
import { dbErrorResponse } from "@/lib/api-errors";
import { loadPublicFeaturedCompanies } from "@/lib/featured-companies";

/** Public, read-only directory data. The helper deliberately selects and maps
 * only display-safe fields; do not add ATS slugs or admin state here. */
export async function GET() {
  const { companies, error } = await loadPublicFeaturedCompanies();
  if (error) return dbErrorResponse("companies:GET", error);

  return NextResponse.json({ ok: true, data: companies });
}
