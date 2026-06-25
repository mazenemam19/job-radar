"use client";
// src/components/settings/SettingsForm.tsx

import { useState, useEffect, type ReactNode } from "react";
import type { ResolvedSettings, UserSettingsRow } from "@/lib/types";

interface SettingsData {
  resolved: ResolvedSettings;
  raw: UserSettingsRow | null;
  profile: { email: string; has_gemini_key: boolean; onboarding_complete: boolean };
}

const INPUT_CLASS =
  "w-full rounded-lg border border-[#1e1e30] bg-[#0a0a18] px-3 py-2.5 text-sm text-[#e2e8f0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366f1]";

export default function SettingsForm() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [geminiKey, setGeminiKey] = useState("");
  const [expertSkills, setExpertSkills] = useState("");
  const [secSkills, setSecSkills] = useState("");
  const [jobAgeDays, setJobAgeDays] = useState(7);
  const [visa, setVisa] = useState(true);
  const [local, setLocal] = useState(true);
  const [global, setGlobal] = useState(true);
  const [allowMid, setAllowMid] = useState(false);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [salaryReminders, setSalaryReminders] = useState(true);
  const [prompt, setPrompt] = useState("");
  const [usesDefaults, setUsesDefaults] = useState(true);
  const [skillWeight, setSkillWeight] = useState(60);
  const [recencyWeight, setRecencyWeight] = useState(30);
  const [excludedKeywords, setExcludedKeywords] = useState("");
  const [blacklistedLocations, setBlacklistedLocations] = useState("");
  const [requiredKeywords, setRequiredKeywords] = useState("");

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/settings");
      const json = await res.json();
      if (json.ok) {
        const d: SettingsData = json.data;
        setData(d);
        const r = d.resolved;
        setUsesDefaults(d.raw?.uses_defaults ?? true);
        setExpertSkills((r.expert_skills ?? []).join(", "));
        setSecSkills((r.secondary_skills ?? []).join(", "));
        setJobAgeDays(r.job_age_days ?? 7);
        setVisa(r.pipeline_visa ?? true);
        setLocal(r.pipeline_local ?? true);
        setGlobal(r.pipeline_global ?? true);
        setAllowMid(r.seniority_allow_mid ?? false);
        setEmailAlerts(r.email_alerts_enabled ?? true);
        setSalaryReminders(r.salary_reminder_enabled ?? true);
        setPrompt(r.gemini_filter_prompt ?? "");
        setExcludedKeywords((r.excluded_keywords ?? []).join(", "));
        setBlacklistedLocations((r.blacklisted_locations ?? []).join(", "));
        setRequiredKeywords((r.required_keywords ?? []).join(", "));
        if (r.scoring_weights) {
          setSkillWeight(Math.round(r.scoring_weights.skill * 100));
          setRecencyWeight(Math.round(r.scoring_weights.recency * 100));
        }
      }
      setLoading(false);
    })();
  }, []);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);

    const relocationWeight = 100 - skillWeight - recencyWeight;
    if (relocationWeight < 0) {
      setError("Skill + recency weights cannot exceed 100%");
      setSaving(false);
      return;
    }

    const body: Record<string, unknown> = {
      uses_defaults: usesDefaults,
      job_age_days: jobAgeDays,
      pipeline_visa: visa,
      pipeline_local: local,
      pipeline_global: global,
      seniority_allow_mid: allowMid,
      email_alerts_enabled: emailAlerts,
      salary_reminder_enabled: salaryReminders,
      scoring_weights: {
        skill: skillWeight / 100,
        recency: recencyWeight / 100,
        relocation: relocationWeight / 100,
      },
      excluded_keywords: excludedKeywords
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      blacklisted_locations: blacklistedLocations
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      required_keywords: requiredKeywords
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    };

    if (!usesDefaults) {
      body.expert_skills = expertSkills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      body.secondary_skills = secSkills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      body.gemini_filter_prompt = prompt;
    }

    if (geminiKey.trim()) body.gemini_api_key = geminiKey.trim();

    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.ok) {
        setSaved(true);
        setGeminiKey("");
      } else {
        setError(json.error);
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-8 text-[#64748b]">Loading settings...</div>;

  const relocationWeight = 100 - skillWeight - recencyWeight;

  return (
    <div className="max-w-[640px] p-8">
      <h1 className="mb-2 text-[22px] font-bold text-[#e2e8f0]">Settings</h1>
      <p className="mb-7 text-sm text-[#64748b]">{data?.profile.email}</p>

      {/* Gemini API Key */}
      <Section title="Gemini API Key" htmlFor="gemini-key">
        <p className="mb-3 text-[13px] text-[#64748b]">
          {data?.profile.has_gemini_key
            ? "✓ API key configured."
            : "⚠️ No key set. Required for filtering and strategy."}
        </p>
        <input
          id="gemini-key"
          type="password"
          value={geminiKey}
          onChange={(e) => setGeminiKey(e.target.value)}
          placeholder="Enter new key to replace (leave blank to keep current)"
          className={INPUT_CLASS}
        />
      </Section>

      {/* Profile mode */}
      <Section title="Profile mode">
        <Toggle
          checked={usesDefaults}
          onChange={setUsesDefaults}
          label="Use platform defaults"
          description="Inherit the admin's default skill list, prompt, and weights"
        />
      </Section>

      {/* Skills — only shown when not using defaults */}
      {!usesDefaults && (
        <>
          <Section title="Expert skills (×3 weight)" htmlFor="expert-skills">
            <textarea
              id="expert-skills"
              value={expertSkills}
              onChange={(e) => setExpertSkills(e.target.value)}
              rows={3}
              placeholder="React, TypeScript, Next.js, Tailwind..."
              className={`${INPUT_CLASS} resize-y`}
            />
            <p className="mt-1 text-[11px] text-[#475569]">Comma-separated</p>
          </Section>

          <Section title="Secondary skills (×1 weight)" htmlFor="secondary-skills">
            <textarea
              id="secondary-skills"
              value={secSkills}
              onChange={(e) => setSecSkills(e.target.value)}
              rows={2}
              placeholder="Jest, Vitest, GraphQL..."
              className={`${INPUT_CLASS} resize-y`}
            />
          </Section>

          <Section title="Gemini evaluation criteria" htmlFor="gemini-prompt">
            <textarea
              id="gemini-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={8}
              placeholder="You are a job filter for..."
              className={`${INPUT_CLASS} resize-y font-mono text-xs`}
            />
            <p className="mt-1.5 text-xs text-[#94a3b8]">
              Describe what makes a job a good fit. Response formatting is handled automatically —
              no need to specify JSON shape here.
            </p>
          </Section>
        </>
      )}

      {/* Pipelines */}
      <Section title="Pipelines">
        <Toggle
          checked={visa}
          onChange={setVisa}
          label="✈️ Visa pipeline"
          description="EU/UK companies offering visa sponsorship"
        />
        <Toggle
          checked={local}
          onChange={setLocal}
          label="🇪🇬 Local pipeline"
          description="Egypt-based companies"
        />
        <Toggle
          checked={global}
          onChange={setGlobal}
          label="🌐 Global pipeline"
          description="Worldwide remote companies"
        />
      </Section>

      {/* Seniority */}
      <Section title="Seniority">
        <Toggle
          checked={allowMid}
          onChange={setAllowMid}
          label="Allow mid-level roles"
          description="By default only Senior+ roles pass the gate"
        />
      </Section>

      {/* Email Alerts */}
      <Section title="Email Alerts">
        <Toggle
          checked={emailAlerts}
          onChange={setEmailAlerts}
          label="Email alerts"
          description="Get notified when new matching jobs are found after each dashboard refresh"
        />
        <Toggle
          checked={salaryReminders}
          onChange={setSalaryReminders}
          label="Monthly salary update reminder"
          description="A nudge to keep your salary report current, sent once a month"
        />
      </Section>

      {/* Job age */}
      <Section title={`Job age limit — ${jobAgeDays} days`} htmlFor="job-age-days">
        <input
          id="job-age-days"
          type="range"
          min={1}
          max={60}
          value={jobAgeDays}
          onChange={(e) => setJobAgeDays(parseInt(e.target.value, 10))}
          className="w-full accent-[#6366f1]"
        />
        <div className="mt-1 flex justify-between text-[11px] text-[#475569]">
          <span>1 day</span>
          <span>60 days</span>
        </div>
      </Section>

      {/* Excluded keywords */}
      <Section title="Excluded keywords (Title blacklist)" htmlFor="excluded-keywords">
        <textarea
          id="excluded-keywords"
          value={excludedKeywords}
          onChange={(e) => setExcludedKeywords(e.target.value)}
          rows={2}
          placeholder="backend, fullstack, devops..."
          className={`${INPUT_CLASS} resize-y`}
        />
        <p className="mt-1 text-[11px] text-[#475569]">
          Comma-separated. Auto-rejects if matched in title.
        </p>
      </Section>

      {/* Required keywords */}
      <Section title="Required keywords (Tech stack check)" htmlFor="required-keywords">
        <textarea
          id="required-keywords"
          value={requiredKeywords}
          onChange={(e) => setRequiredKeywords(e.target.value)}
          rows={2}
          placeholder="react, next.js..."
          className={`${INPUT_CLASS} resize-y`}
        />
        <p className="mt-1 text-[11px] text-[#475569]">
          Comma-separated. The job must match at least one (falls back to Expert Skills if empty).
        </p>
      </Section>

      {/* Blacklisted locations */}
      <Section title="Location / Citizenship blacklist" htmlFor="blacklisted-locations">
        <textarea
          id="blacklisted-locations"
          value={blacklistedLocations}
          onChange={(e) => setBlacklistedLocations(e.target.value)}
          rows={2}
          placeholder="israel, us only, security clearance required..."
          className={`${INPUT_CLASS} resize-y`}
        />
        <p className="mt-1 text-[11px] text-[#475569]">
          Comma-separated. Auto-rejects if matched anywhere in job details.
        </p>
      </Section>

      {/* Scoring weights */}
      <Section title="Scoring weights">
        <div className="flex flex-col gap-2.5">
          <WeightSlider
            id="weight-skill"
            label="Skill match"
            value={skillWeight}
            onChange={setSkillWeight}
            color="#6366f1"
          />
          <WeightSlider
            id="weight-recency"
            label="Recency"
            value={recencyWeight}
            onChange={setRecencyWeight}
            color="#22c55e"
          />
          <div className="text-[13px] text-[#64748b]">
            Relocation bonus: <strong className="text-[#f59e0b]">{relocationWeight}%</strong>
            {relocationWeight < 0 && (
              <span className="text-[#ef4444]"> (invalid — reduce above)</span>
            )}
          </div>
        </div>
      </Section>

      {error && <div className="mb-4 text-[13px] text-[#f87171]">{error}</div>}
      {saved && (
        <div className="mb-4 text-[13px] text-[#4ade80]">
          ✓ Settings saved. Your next dashboard load will rebuild your cache.
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving || relocationWeight < 0}
        className="cursor-pointer rounded-lg border-0 bg-[#6366f1] px-7 py-3 text-[15px] font-semibold text-white disabled:cursor-not-allowed"
        style={{ opacity: saving ? 0.6 : 1 }}
      >
        {saving ? "Saving..." : "Save settings"}
      </button>
    </div>
  );
}

function Section({
  title,
  children,
  htmlFor,
}: {
  title: ReactNode;
  children: ReactNode;
  htmlFor?: string;
}) {
  const headingClass =
    "mb-3 block text-[13px] font-semibold uppercase tracking-wide text-[#94a3b8]";
  return (
    <div className="mb-7">
      {htmlFor ? (
        <label htmlFor={htmlFor} className={headingClass}>
          {title}
        </label>
      ) : (
        <h3 className={headingClass}>{title}</h3>
      )}
      {children}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={description ? `${label}. ${description}` : label}
      onClick={() => onChange(!checked)}
      className="mb-2.5 flex w-full cursor-pointer items-center gap-3 border-0 bg-transparent p-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366f1]"
    >
      <span
        className="relative h-5 w-[38px] flex-shrink-0 rounded-full transition-colors"
        style={{ background: checked ? "#6366f1" : "#1e1e30" }}
      >
        <span
          className="absolute top-[3px] h-3.5 w-3.5 rounded-full bg-white transition-[left]"
          style={{ left: checked ? 20 : 3 }}
        />
      </span>
      <span>
        <span className="block text-sm text-[#e2e8f0]">{label}</span>
        {description && <span className="block text-xs text-[#64748b]">{description}</span>}
      </span>
    </button>
  );
}

function WeightSlider({
  id,
  label,
  value,
  onChange,
  color,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  color: string;
}) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-[13px]">
        <label htmlFor={id} className="text-[#94a3b8]">
          {label}
        </label>
        <span style={{ color }}>{value}%</span>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="w-full"
        style={{ accentColor: color }}
      />
    </div>
  );
}
