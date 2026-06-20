"use client";
// src/app/submit/page.tsx
// Public page — no authentication required.
// HR managers submit their company ATS details for admin review.

import { useState } from "react";

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
      const res = await fetch("/api/v2/submit", {
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
      style={{
        minHeight: "100vh",
        background: "#08080f",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        fontFamily: "Inter, system-ui, sans-serif",
        padding: "48px 16px",
      }}
    >
      <div style={{ maxWidth: 540, width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🏢</div>
          <h1 style={{ margin: "0 0 8px", fontSize: 24, color: "#e2e8f0", fontWeight: 700 }}>
            Submit your company
          </h1>
          <p style={{ margin: 0, color: "#64748b", fontSize: 14, lineHeight: 1.6 }}>
            Help developers find open roles at your company by adding it to Job Radar&apos;s
            scraping list. Our team will review and test your submission within 48 hours.
          </p>
        </div>

        {submitted ? (
          <div
            style={{
              background: "#0d2a18",
              border: "1px solid #166534",
              borderRadius: 16,
              padding: 36,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
            <h2 style={{ margin: "0 0 8px", fontSize: 18, color: "#4ade80" }}>Submitted!</h2>
            <p style={{ margin: 0, color: "#86efac", fontSize: 14 }}>
              Our team will review your submission and test the integration. If you included your
              email, we&apos;ll notify you when it&apos;s live.
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            style={{
              background: "#0d0d1a",
              border: "1px solid #1e1e30",
              borderRadius: 16,
              padding: "32px 28px",
            }}
          >
            <Field label="Company name *" name="company_name" required />

            <div style={{ marginBottom: 18 }}>
              <label style={labelSt}>ATS platform *</label>
              <select
                name="ats_type"
                value={atsType}
                onChange={(e) => setAtsType(e.target.value)}
                style={inputSt}
                required
              >
                {ATS_TYPES.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={labelSt}>ATS slug / company ID *</label>
              <input name="slug" required style={inputSt} placeholder={slugHint} />
              <p style={{ margin: "4px 0 0", fontSize: 11, color: "#475569" }}>{slugHint}</p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <Field label="Country code *" name="country" placeholder="GB, DE, EG..." required />
              </div>
              <div>
                <Field label="City (optional)" name="city" placeholder="London" />
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={labelSt}>Which pipelines should this appear in?</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 6 }}>
                {[
                  [
                    "pipeline_visa",
                    "✈️ Visa pipeline",
                    "We offer visa sponsorship for international candidates",
                  ],
                  ["pipeline_local", "🇪🇬 Local pipeline", "We're based in Egypt or hire locally"],
                  ["pipeline_global", "🌐 Remote pipeline", "We hire fully remote worldwide"],
                ].map(([name, label, desc]) => (
                  <label
                    key={name}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      name={name}
                      style={{ marginTop: 2, accentColor: "#6366f1" }}
                    />
                    <div>
                      <div style={{ fontSize: 14, color: "#e2e8f0" }}>{label}</div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>{desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <Field
              label="Your email (optional — for follow-ups)"
              name="submitter_email"
              type="email"
              placeholder="hr@yourcompany.com"
            />

            {error && (
              <div style={{ color: "#f87171", fontSize: 13, marginBottom: 14 }}>{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "13px 0",
                background: "#6366f1",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 600,
                cursor: "pointer",
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? "Submitting..." : "Submit for review →"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

const labelSt: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  color: "#94a3b8",
  marginBottom: 6,
  fontWeight: 500,
};

const inputSt: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  background: "#0a0a18",
  border: "1px solid #1e1e30",
  borderRadius: 8,
  color: "#e2e8f0",
  fontSize: 14,
  boxSizing: "border-box",
};

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
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={labelSt}>{label}</label>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        style={inputSt}
      />
    </div>
  );
}
