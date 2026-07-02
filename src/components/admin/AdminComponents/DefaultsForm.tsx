"use client";
// src/components/admin/AdminComponents/DefaultsForm.tsx

import { INPUT_CLASS, Section2 } from "./_shared";
import { useDefaultsForm } from "@/hooks/useDefaultsForm";
import type { DefaultsFormFields } from "@/lib/defaults-form";

type CsvTextareaField = {
  field: keyof Pick<
    DefaultsFormFields,
    | "expertSkills"
    | "secondarySkills"
    | "juniorKeywords"
    | "midKeywords"
    | "seniorKeywords"
    | "staffKeywords"
    | "excludedKeywords"
    | "requiredKeywords"
    | "blacklistedLocations"
    | "globalBlockedRegions"
    | "globalAllowedLocations"
  >;
  title: string;
  rows: number;
  helperText?: string;
};

const CSV_TEXTAREA_FIELDS: CsvTextareaField[] = [
  { field: "expertSkills", title: "Expert skills (×3 weight, comma-separated)", rows: 3 },
  { field: "secondarySkills", title: "Secondary skills (×1 weight)", rows: 2 },
  { field: "juniorKeywords", title: "Default Junior keywords (comma-separated)", rows: 2 },
  { field: "midKeywords", title: "Default Mid keywords (comma-separated)", rows: 2 },
  { field: "seniorKeywords", title: "Default Senior keywords (comma-separated)", rows: 2 },
  { field: "staffKeywords", title: "Default Staff+ keywords (comma-separated)", rows: 2 },
  {
    field: "excludedKeywords",
    title: "Default Excluded keywords (Title blacklist)",
    rows: 2,
  },
  {
    field: "requiredKeywords",
    title: "Default Required keywords (Tech stack check)",
    rows: 2,
  },
  {
    field: "blacklistedLocations",
    title: "Default Location / Citizenship blacklist",
    rows: 2,
  },
  {
    field: "globalBlockedRegions",
    title: "Global mode — Blocked regions/timezones",
    rows: 2,
    helperText:
      "Comma-separated. Jobs in the Global pipeline matching these keywords are rejected.",
  },
  {
    field: "globalAllowedLocations",
    title: "Global mode — Always-allowed locations",
    rows: 2,
    helperText:
      "Comma-separated. Jobs matching these always pass the global mode filter (overrides blocked list).",
  },
];

export function DefaultsForm() {
  const { status, fields, update, save } = useDefaultsForm();

  if (status.kind === "loading") {
    return <div className="p-8 text-[#64748b]">Loading defaults...</div>;
  }

  const saving = status.kind === "saving";

  return (
    <div className="max-w-[640px] p-8">
      <h1 className="mb-2 text-[22px] font-bold text-[#e2e8f0]">Default Settings</h1>
      <p className="mb-7 text-[13px] text-[#64748b]">
        These are inherited by all users with &quot;use defaults&quot; enabled. Changes here
        invalidate all user caches.
      </p>

      {CSV_TEXTAREA_FIELDS.map(({ field, title, rows, helperText }) => (
        <Section2 key={field} title={title} htmlFor={`default-${field}`}>
          <textarea
            id={`default-${field}`}
            value={fields[field]}
            onChange={(e) => update(field, e.target.value)}
            rows={rows}
            className={`${INPUT_CLASS} resize-y`}
          />
          {helperText && <p className="mt-1 text-[11px] text-[#475569]">{helperText}</p>}
        </Section2>
      ))}

      <Section2 title={`Job age limit — ${fields.jobAgeDays} days`} htmlFor="default-job-age-days">
        <input
          id="default-job-age-days"
          type="range"
          min={1}
          max={60}
          value={fields.jobAgeDays}
          onChange={(e) => update("jobAgeDays", parseInt(e.target.value, 10))}
          className="w-full accent-[#6366f1]"
        />
      </Section2>

      <Section2 title="Gemini filter prompt" htmlFor="default-gemini-prompt">
        <textarea
          id="default-gemini-prompt"
          value={fields.geminiPrompt}
          onChange={(e) => update("geminiPrompt", e.target.value)}
          rows={10}
          className={`${INPUT_CLASS} resize-y font-mono text-xs`}
        />
      </Section2>

      <Section2
        title="Default Seniority levels (multi-select, comma-separated)"
        htmlFor="default-seniority-levels"
      >
        <input
          id="default-seniority-levels"
          value={fields.seniorityLevels}
          onChange={(e) => update("seniorityLevels", e.target.value)}
          className={`${INPUT_CLASS} w-full`}
          placeholder="senior, staff"
        />
        <p className="mt-1 text-[11px] text-[#475569]">
          Which levels a user sees by default. Users can override.
        </p>
      </Section2>

      <Section2 title="Score denominator" htmlFor="default-score-denominator">
        <input
          id="default-score-denominator"
          type="number"
          min={1}
          max={100}
          value={fields.scoreDenominator}
          onChange={(e) => update("scoreDenominator", parseInt(e.target.value, 10))}
          className={`${INPUT_CLASS} w-20`}
        />
        <p className="mt-1 text-[11px] text-[#475569]">
          Raw skill score is divided by this. Default 18 = (15 expert × 3 weight).
        </p>
      </Section2>

      {status.kind === "error" && (
        <div className="mb-3 text-[13px] text-[#f87171]">{status.message}</div>
      )}
      {status.kind === "saved" && (
        <div className="mb-3 text-[13px] text-[#4ade80]">✓ Saved. All user caches invalidated.</div>
      )}
      <button
        onClick={save}
        disabled={saving}
        className="cursor-pointer rounded-lg border-0 bg-[#6366f1] px-7 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed"
        style={{ opacity: saving ? 0.6 : 1 }}
      >
        {saving ? "Saving..." : "Save defaults"}
      </button>
    </div>
  );
}
