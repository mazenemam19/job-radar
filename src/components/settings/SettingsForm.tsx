"use client";
// src/components/settings/SettingsForm.tsx

import { useState, useEffect } from "react";
import type { ResolvedSettings, UserSettingsRow } from "@/lib/types";

interface SettingsData {
  resolved: ResolvedSettings;
  raw: UserSettingsRow | null;
  profile: { email: string; has_gemini_key: boolean; onboarding_complete: boolean };
}

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

  if (loading) return <div style={{ padding: 32, color: "#64748b" }}>Loading settings...</div>;

  const relocationWeight = 100 - skillWeight - recencyWeight;

  return (
    <div style={{ padding: 32, maxWidth: 640 }}>
      <h1 style={{ margin: "0 0 8px", fontSize: 22, color: "#e2e8f0", fontWeight: 700 }}>
        Settings
      </h1>
      <p style={{ margin: "0 0 28px", fontSize: 14, color: "#64748b" }}>{data?.profile.email}</p>

      {/* Gemini API Key */}
      <Section title="Gemini API Key">
        <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 12px" }}>
          {data?.profile.has_gemini_key
            ? "✓ API key configured."
            : "⚠️ No key set. Required for filtering and strategy."}
        </p>
        <input
          type="password"
          value={geminiKey}
          onChange={(e) => setGeminiKey(e.target.value)}
          placeholder="Enter new key to replace (leave blank to keep current)"
          style={inputStyle}
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
          <Section title="Expert skills (×3 weight)">
            <textarea
              value={expertSkills}
              onChange={(e) => setExpertSkills(e.target.value)}
              rows={3}
              placeholder="React, TypeScript, Next.js, Tailwind..."
              style={{ ...inputStyle, resize: "vertical" }}
            />
            <p style={{ fontSize: 11, color: "#475569", margin: "4px 0 0" }}>Comma-separated</p>
          </Section>

          <Section title="Secondary skills (×1 weight)">
            <textarea
              value={secSkills}
              onChange={(e) => setSecSkills(e.target.value)}
              rows={2}
              placeholder="Jest, Vitest, GraphQL..."
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </Section>

          <Section title="Gemini filter prompt">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={8}
              placeholder="You are a job filter for..."
              style={{ ...inputStyle, resize: "vertical", fontFamily: "monospace", fontSize: 12 }}
            />
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
          label="Email me when new matches are found"
          description="Also includes a monthly reminder to update your salary report"
        />
      </Section>

      {/* Job age */}
      <Section title={`Job age limit — ${jobAgeDays} days`}>
        <input
          type="range"
          min={1}
          max={60}
          value={jobAgeDays}
          onChange={(e) => setJobAgeDays(parseInt(e.target.value, 10))}
          style={{ width: "100%", accentColor: "#6366f1" }}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 11,
            color: "#475569",
            marginTop: 4,
          }}
        >
          <span>1 day</span>
          <span>60 days</span>
        </div>
      </Section>

      {/* Excluded keywords */}
      <Section title="Excluded keywords (Title blacklist)">
        <textarea
          value={excludedKeywords}
          onChange={(e) => setExcludedKeywords(e.target.value)}
          rows={2}
          placeholder="backend, fullstack, devops..."
          style={{ ...inputStyle, resize: "vertical" }}
        />
        <p style={{ fontSize: 11, color: "#475569", margin: "4px 0 0" }}>
          Comma-separated. Auto-rejects if matched in title.
        </p>
      </Section>

      {/* Required keywords */}
      <Section title="Required keywords (Tech stack check)">
        <textarea
          value={requiredKeywords}
          onChange={(e) => setRequiredKeywords(e.target.value)}
          rows={2}
          placeholder="react, next.js..."
          style={{ ...inputStyle, resize: "vertical" }}
        />
        <p style={{ fontSize: 11, color: "#475569", margin: "4px 0 0" }}>
          Comma-separated. The job must match at least one (falls back to Expert Skills if empty).
        </p>
      </Section>

      {/* Blacklisted locations */}
      <Section title="Location / Citizenship blacklist">
        <textarea
          value={blacklistedLocations}
          onChange={(e) => setBlacklistedLocations(e.target.value)}
          rows={2}
          placeholder="israel, us only, security clearance required..."
          style={{ ...inputStyle, resize: "vertical" }}
        />
        <p style={{ fontSize: 11, color: "#475569", margin: "4px 0 0" }}>
          Comma-separated. Auto-rejects if matched anywhere in job details.
        </p>
      </Section>

      {/* Scoring weights */}
      <Section title="Scoring weights">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <WeightSlider
            label="Skill match"
            value={skillWeight}
            onChange={setSkillWeight}
            color="#6366f1"
          />
          <WeightSlider
            label="Recency"
            value={recencyWeight}
            onChange={setRecencyWeight}
            color="#22c55e"
          />
          <div style={{ fontSize: 13, color: "#64748b" }}>
            Relocation bonus: <strong style={{ color: "#f59e0b" }}>{relocationWeight}%</strong>
            {relocationWeight < 0 && (
              <span style={{ color: "#ef4444" }}> (invalid — reduce above)</span>
            )}
          </div>
        </div>
      </Section>

      {error && <div style={{ color: "#f87171", fontSize: 13, margin: "0 0 16px" }}>{error}</div>}
      {saved && (
        <div style={{ color: "#4ade80", fontSize: 13, margin: "0 0 16px" }}>
          ✓ Settings saved. Your next dashboard load will rebuild your cache.
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving || relocationWeight < 0}
        style={{
          padding: "12px 28px",
          background: "#6366f1",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          fontSize: 15,
          fontWeight: 600,
          cursor: "pointer",
          opacity: saving ? 0.6 : 1,
        }}
      >
        {saving ? "Saving..." : "Save settings"}
      </button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h3
        style={{
          margin: "0 0 12px",
          fontSize: 13,
          color: "#94a3b8",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {title}
      </h3>
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
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginBottom: 10,
        cursor: "pointer",
      }}
      onClick={() => onChange(!checked)}
    >
      <div
        style={{
          width: 38,
          height: 20,
          borderRadius: 10,
          background: checked ? "#6366f1" : "#1e1e30",
          position: "relative",
          transition: "background 0.2s",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 3,
            width: 14,
            height: 14,
            borderRadius: "50%",
            background: "#fff",
            transition: "left 0.2s",
            left: checked ? 20 : 3,
          }}
        />
      </div>
      <div>
        <div style={{ fontSize: 14, color: "#e2e8f0" }}>{label}</div>
        {description && <div style={{ fontSize: 12, color: "#64748b" }}>{description}</div>}
      </div>
    </div>
  );
}

function WeightSlider({
  label,
  value,
  onChange,
  color,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  color: string;
}) {
  return (
    <div>
      <div
        style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 13 }}
      >
        <span style={{ color: "#94a3b8" }}>{label}</span>
        <span style={{ color }}>{value}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        style={{ width: "100%", accentColor: color }}
      />
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  background: "#0a0a18",
  border: "1px solid #1e1e30",
  borderRadius: 8,
  color: "#e2e8f0",
  fontSize: 14,
  boxSizing: "border-box",
};
