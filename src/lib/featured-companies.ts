import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/database.types";

const FEATURED_COMPANY_COLUMNS = "id, name, country, country_flag, city";

type FeaturedCompanyRow = Pick<
  Database["public"]["Tables"]["ats_companies"]["Row"],
  "id" | "name" | "country" | "country_flag" | "city"
>;

/** The only company fields safe to expose from the public directory. */
export type PublicFeaturedCompany = FeaturedCompanyRow;

export async function loadPublicFeaturedCompanies() {
  const db = createAdminClient();
  const { data, error } = await db
    .from("ats_companies")
    .select(FEATURED_COMPANY_COLUMNS)
    .eq("is_featured", true)
    .order("name", { ascending: true });

  return {
    companies: (data ?? []).map(toPublicFeaturedCompany),
    error,
  };
}

/** Explicitly strips ATS identifiers and management fields from any response. */
export function toPublicFeaturedCompany(row: FeaturedCompanyRow): PublicFeaturedCompany {
  return {
    id: row.id,
    name: row.name,
    country: row.country,
    country_flag: row.country_flag,
    city: row.city,
  };
}
