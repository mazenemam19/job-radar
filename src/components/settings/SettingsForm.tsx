"use client";
// src/components/settings/SettingsForm.tsx

import type { SeniorityLevel } from "@/lib/types";
import { useSettingsForm } from "@/hooks/useSettingsForm";
import DeleteAccountSection from "@/components/settings/DeleteAccountSection";
import {
  Section,
  KeywordField,
  Toggle,
  GeminiKeySection,
  SeniorityLevelsSection,
  ScoringWeightsSection,
  SaveBar,
} from "./_shared";

const SENIORITY_LEVELS: { key: SeniorityLevel; label: string }[] = [
  { key: "junior", label: "Junior" },
  { key: "mid", label: "Mid" },
  { key: "senior", label: "Senior" },
  { key: "staff", label: "Staff+" },
];

const SENIORITY_KEYWORD_FIELDS = [
  {
    field: "juniorKeywords",
    title: "Junior keywords",
    placeholder: "junior, jr, entry-level, intern, graduate...",
    helperText: "Comma-separated terms that label a job as junior.",
  },
  {
    field: "midKeywords",
    title: "Mid keywords",
    placeholder: "mid-level, mid-senior, intermediate...",
    helperText: "Comma-separated terms that label a job as mid-level.",
  },
  {
    field: "seniorKeywords",
    title: "Senior keywords",
    placeholder: "senior, sr, principal, staff, lead...",
    helperText: "Comma-separated terms that label a job as senior.",
  },
  {
    field: "staffKeywords",
    title: "Staff+ keywords",
    placeholder: "lead, staff, principal, architect, director, vp, head...",
    helperText: "Comma-separated terms that label a job as staff+.",
  },
] as const;

const FILTER_KEYWORD_FIELDS = [
  {
    field: "excludedKeywords",
    title: "Excluded keywords (Title blacklist)",
    placeholder: "backend, fullstack, devops...",
    helperText: "Comma-separated. Auto-rejects if matched in title.",
  },
  {
    field: "requiredKeywords",
    title: "Required keywords (Tech stack check)",
    placeholder: "react, next.js...",
    helperText:
      "Comma-separated. The job must match at least one (falls back to Expert Skills if empty).",
  },
  {
    field: "blacklistedLocations",
    title: "Location / Citizenship blacklist",
    placeholder: "israel, us only, security clearance required...",
    helperText: "Comma-separated. Auto-rejects if matched anywhere in job details.",
  },
  {
    field: "globalBlockedRegions",
    title: "Global mode — Blocked regions/timezones",
    placeholder: "us only, usa only, pst, est, remote us...",
    helperText:
      "Comma-separated. Jobs in the Global pipeline matching these keywords are rejected.",
  },
  {
    field: "globalAllowedLocations",
    title: "Global mode — Always-allowed locations",
    placeholder: "remote, worldwide, anywhere, emea, europe...",
    helperText:
      "Comma-separated. Jobs matching these always pass the global mode filter (overrides blocked list).",
  },
] as const;

export default function SettingsForm() {
  const { data, status, fields, update, toggleSeniorityLevel, save, relocationWeight } =
    useSettingsForm();

  if (status.kind === "loading") {
    return <div className="p-8 text-[#64748b]">Loading settings...</div>;
  }

  const hasGeminiKey = data?.profile.has_gemini_key ?? false;

  return (
    <div className="max-w-[640px] p-8">
      <h1 className="mb-2 text-[22px] font-bold text-[#e2e8f0]">Settings</h1>
      <p className="mb-7 text-sm text-[#64748b]">{data?.profile.email}</p>

      <GeminiKeySection
        geminiKey={fields.geminiKey}
        onGeminiKeyChange={(v) => update("geminiKey", v)}
        clearGeminiKey={fields.clearGeminiKey}
        onClearGeminiKeyChange={(v) => update("clearGeminiKey", v)}
        hasGeminiKey={hasGeminiKey}
      />

      <KeywordField
        id="expert-skills"
        title="Expert skills (×3 weight)"
        value={fields.expertSkills}
        onChange={(v) => update("expertSkills", v)}
        rows={3}
        placeholder="React, TypeScript, Next.js, Tailwind..."
        helperText="Comma-separated"
      />

      <KeywordField
        id="secondary-skills"
        title="Secondary skills (×1 weight)"
        value={fields.secondarySkills}
        onChange={(v) => update("secondarySkills", v)}
        placeholder="Jest, Vitest, GraphQL..."
      />

      <KeywordField
        id="gemini-prompt"
        title="Gemini evaluation criteria"
        value={fields.geminiPrompt}
        onChange={(v) => update("geminiPrompt", v)}
        rows={8}
        placeholder="You are a job filter for..."
        monospace
        helperText="Describe what makes a job a good fit. Response formatting is handled automatically — no need to specify JSON shape here."
      />

      <Section title="Pipelines">
        <Toggle
          checked={fields.pipelineLocal}
          onChange={(v) => update("pipelineLocal", v)}
          label="🇪🇬 Local pipeline"
          description="Egypt-based companies"
        />
        <Toggle
          checked={fields.pipelineGlobal}
          onChange={(v) => update("pipelineGlobal", v)}
          label="🌐 Global pipeline"
          description="Worldwide remote companies"
        />
      </Section>

      <SeniorityLevelsSection
        levels={SENIORITY_LEVELS}
        selected={fields.seniorityLevels}
        onToggle={toggleSeniorityLevel}
      />

      {SENIORITY_KEYWORD_FIELDS.map(({ field, title, placeholder, helperText }) => (
        <KeywordField
          key={field}
          id={field}
          title={title}
          value={fields[field]}
          onChange={(v) => update(field, v)}
          placeholder={placeholder}
          helperText={helperText}
        />
      ))}

      <Section title="Email Alerts">
        <Toggle
          checked={fields.emailAlerts}
          onChange={(v) => update("emailAlerts", v)}
          label="Email alerts"
          description="Get notified when new matching jobs are found after each dashboard refresh"
        />
        <Toggle
          checked={fields.salaryReminders}
          onChange={(v) => update("salaryReminders", v)}
          label="Monthly salary update reminder"
          description="A nudge to keep your salary report current, sent once a month"
        />
      </Section>

      <Section title={`Job age limit — ${fields.jobAgeDays} days`} htmlFor="job-age-days">
        <input
          id="job-age-days"
          type="range"
          min={1}
          max={60}
          value={fields.jobAgeDays}
          onChange={(e) => update("jobAgeDays", parseInt(e.target.value, 10))}
          className="w-full accent-[#6366f1]"
        />
        <div className="mt-1 flex justify-between text-[11px] text-[#475569]">
          <span>1 day</span>
          <span>60 days</span>
        </div>
      </Section>

      {FILTER_KEYWORD_FIELDS.map(({ field, title, placeholder, helperText }) => (
        <KeywordField
          key={field}
          id={field}
          title={title}
          value={fields[field]}
          onChange={(v) => update(field, v)}
          placeholder={placeholder}
          helperText={helperText}
        />
      ))}

      <ScoringWeightsSection
        skillWeight={fields.skillWeight}
        recencyWeight={fields.recencyWeight}
        relocationWeight={relocationWeight}
        onSkillWeightChange={(v) => update("skillWeight", v)}
        onRecencyWeightChange={(v) => update("recencyWeight", v)}
      />

      <SaveBar status={status} onSave={save} disabled={relocationWeight < 0} />

      <div className="mt-10 border-t border-[#1e1e30] pt-7">
        <DeleteAccountSection />
      </div>
    </div>
  );
}
