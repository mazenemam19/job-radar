"use client";
// src/app/submit/page.tsx
// Public page — no authentication required.
// HR managers submit their company ATS details for admin review.

import { useState } from "react";
import Link from "next/link";

const ATS_TYPES = [
  {
    value: "greenhouse",
    label: "Greenhouse",
    slug_hint: 'Your Greenhouse board token (e.g. "acmecorp")',
  },
  { value: "lever", label: "Lever", slug_hint: 'Your Lever company slug (e.g. "acme")' },
  { value: "ashby", label: "Ashby", slug_hint: "Your Ashby organisation slug" },
  {
    value: "workable",
    label: "Workable",
    slug_hint: 'Your Workable subdomain (e.g. "acme" from acme.workable.com)',
  },
  { value: "teamtailor", label: "Teamtailor", slug_hint: "Your Teamtailor company slug" },
  { value: "breezy", label: "Breezy HR", slug_hint: "Your Breezy company slug" },
  {
    value: "smartrecruiters",
    label: "SmartRecruiters",
    slug_hint: "Your SmartRecruiters company ID",
  },
  {
    value: "bamboohr",
    label: "BambooHR",
    slug_hint: 'Your BambooHR subdomain (e.g. "acme" from acme.bamboohr.com)',
  },
  { value: "jazzhr", label: "JazzHR", slug_hint: "Your JazzHR company subdomain" },
];

const LABEL_CLASS = "mb-1.5 block text-[13px] font-medium text-[#94a3b8]";
const INPUT_CLASS =
  "w-full rounded-lg border border-[#1e1e30] bg-[#0a0a18] px-3 py-2.5 text-sm text-[#e2e8f0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366f1]";

export default function SubmitPage() {
  const [atsType, setAtsType] = useState("greenhouse");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slugHint = ATS_TYPES.find((a) => a.value === atsType)?.slug_hint ?? "";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const body = {
      company_name: fd.get("company_name"),
      ats_type: fd.get("ats_type"),
      slug: fd.get("slug"),
      country: fd.get("country"),
      city: fd.get("city"),
      pipeline_visa: fd.get("pipeline_visa") === "on",
      pipeline_local: fd.get("pipeline_local") === "on",
      pipeline_global: fd.get("pipeline_global") === "on",
      submitter_email: fd.get("submitter_email"),
    };

    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.ok) {
        setSubmitted(true);
      } else {
        setError(data.error);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="flex min-h-screen items-start justify-center px-4 py-12 font-sans"
      style={{ background: "#08080f" }}
    >
      <div className="w-full max-w-[540px]">
        <Link
          href="/"
          className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-[#64748b] no-underline"
        >
          ← Back
        </Link>
        <div className="mb-9 text-center">
          <div className="mb-2.5 text-4xl">🏢</div>
          <h1 className="mb-2 text-2xl font-bold text-[#e2e8f0]">Submit your company</h1>
          <p className="text-sm leading-relaxed text-[#64748b]">
            Help developers find open roles at your company by adding it to Job Radar&apos;s
            scraping list. Our team will review and test your submission within 48 hours.
          </p>
        </div>

        {submitted ? (
          <div className="rounded-2xl border border-[#166534] bg-[#0d2a18] p-9 text-center">
            <div className="mb-3 text-4xl">✅</div>
            <h2 className="mb-2 text-lg text-[#4ade80]">Submitted!</h2>
            <p className="text-sm text-[#86efac]">
              Our team will review your submission and test the integration. If you included your
              email, we&apos;ll notify you when it&apos;s live.
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-[#1e1e30] bg-[#0d0d1a] px-7 py-8"
          >
            <Field label="Company name *" name="company_name" required />

            <div className="mb-[18px]">
              <label htmlFor="submit-ats-type" className={LABEL_CLASS}>
                ATS platform *
              </label>
              <select
                id="submit-ats-type"
                name="ats_type"
                value={atsType}
                onChange={(e) => setAtsType(e.target.value)}
                className={INPUT_CLASS}
                required
              >
                {ATS_TYPES.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-[18px]">
              <label htmlFor="submit-slug" className={LABEL_CLASS}>
                ATS slug / company ID *
              </label>
              <input
                id="submit-slug"
                name="slug"
                required
                className={INPUT_CLASS}
                placeholder={slugHint}
              />
              <p className="mt-1 text-[11px] text-[#475569]">{slugHint}</p>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <Field label="Country code *" name="country" placeholder="GB, DE, EG..." required />
              <Field label="City (optional)" name="city" placeholder="London" />
            </div>

            <fieldset className="mb-5 mt-[18px] border-0 p-0">
              <legend className={LABEL_CLASS}>Which pipelines should this appear in?</legend>
              <div className="mt-1.5 flex flex-col gap-2.5">
                {[
                  [
                    "pipeline_visa",
                    "✈️ Visa pipeline",
                    "We offer visa sponsorship for international candidates",
                  ],
                  ["pipeline_local", "🇪🇬 Local pipeline", "We're based in Egypt or hire locally"],
                  ["pipeline_global", "🌐 Remote pipeline", "We hire fully remote worldwide"],
                ].map(([name, label, desc]) => (
                  <label key={name} className="flex cursor-pointer items-start gap-2.5">
                    <input type="checkbox" name={name} className="mt-0.5 accent-[#6366f1]" />
                    <div>
                      <div className="text-sm text-[#e2e8f0]">{label}</div>
                      <div className="text-xs text-[#64748b]">{desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </fieldset>

            <Field
              label="Your email (optional — for follow-ups)"
              name="submitter_email"
              type="email"
              placeholder="hr@yourcompany.com"
            />

            {error && <div className="mb-3.5 text-[13px] text-[#f87171]">{error}</div>}

            <button
              type="submit"
              disabled={loading}
              className="w-full cursor-pointer rounded-[10px] border-0 bg-[#6366f1] py-[13px] text-[15px] font-semibold text-white disabled:cursor-not-allowed"
              style={{ opacity: loading ? 0.6 : 1 }}
            >
              {loading ? "Submitting..." : "Submit for review →"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  required,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  const id = `submit-${name}`;
  return (
    <div className="mb-[18px]">
      <label htmlFor={id} className={LABEL_CLASS}>
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        className={INPUT_CLASS}
      />
    </div>
  );
}
