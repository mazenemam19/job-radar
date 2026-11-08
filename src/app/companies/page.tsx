import Link from "next/link";
import { loadPublicFeaturedCompanies } from "@/lib/featured-companies";
import { companyDirectoryRemovalMailto } from "@/lib/public-contact";

export const dynamic = "force-dynamic";

export default async function CompaniesPage() {
  const { companies, error } = await loadPublicFeaturedCompanies();

  if (error) {
    console.error("[companies:page]", error.message);
  }

  return (
    <main className="min-h-screen bg-[#08080f] px-6 py-12 text-[#e2e8f0] sm:px-10">
      <div className="mx-auto max-w-4xl">
        <div className="mb-12 flex items-center justify-between gap-6">
          <Link href="/" className="text-sm font-semibold text-[#a5b4fc] no-underline">
            ← Job Radar
          </Link>
          <span className="text-xs text-[#64748b]">Public company directory</span>
        </div>

        <section aria-labelledby="featured-companies-heading">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-[#818cf8]">
            Featured employers
          </p>
          <h1 id="featured-companies-heading" className="mb-4 text-4xl font-bold tracking-tight">
            Companies hiring through Job Radar
          </h1>
          <p className="max-w-2xl text-base leading-7 text-[#94a3b8]">
            This opt-in directory highlights employers whose career pages Job Radar monitors.
            Listings show only public company and location information.
          </p>
        </section>

        {error ? (
          <p
            role="status"
            className="mt-12 rounded-xl border border-[#7f1d1d] bg-[#1f1118] p-5 text-[#fca5a5]"
          >
            The company directory is temporarily unavailable. Please try again later.
          </p>
        ) : companies.length === 0 ? (
          <p className="mt-12 rounded-xl border border-[#1e1e30] bg-[#0d0d1a] p-8 text-[#94a3b8]">
            No companies are featured yet. Check back soon.
          </p>
        ) : (
          <ul
            className="mt-12 grid list-none gap-4 p-0 sm:grid-cols-2"
            aria-label="Featured companies"
          >
            {companies.map((company) => (
              <li key={company.id} className="rounded-xl border border-[#1e1e30] bg-[#0d0d1a] p-6">
                <h2 className="m-0 text-lg font-semibold text-[#e2e8f0]">{company.name}</h2>
                <p className="mb-0 mt-3 text-sm text-[#94a3b8]">
                  {company.country_flag} {company.city ? `${company.city}, ` : ""}
                  {company.country}
                </p>
              </li>
            ))}
          </ul>
        )}

        <section
          aria-labelledby="company-removal-heading"
          className="mt-12 rounded-xl border border-[#1e1e30] bg-[#0d0d1a] p-6"
        >
          <h2 id="company-removal-heading" className="m-0 text-lg font-semibold text-[#e2e8f0]">
            Is this your company?
          </h2>
          <p className="mb-0 mt-3 max-w-2xl text-sm leading-6 text-[#94a3b8]">
            If your company appears in this directory and you want it removed, contact us by email.
            Job Radar does not store or track your request.
          </p>
          <a
            href={companyDirectoryRemovalMailto()}
            className="mt-4 inline-block text-sm font-semibold text-[#a5b4fc]"
          >
            Request company removal by email
          </a>
        </section>
      </div>
    </main>
  );
}
