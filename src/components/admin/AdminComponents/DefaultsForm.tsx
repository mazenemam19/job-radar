"use client";
// src/components/admin/AdminComponents/DefaultsForm.tsx

import { useState, useEffect } from "react";
import { inputStyle, Section2 } from "./_shared";

export function DefaultsForm() {
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/defaults");
      const d = await res.json();
      if (d.ok) setForm(d.data);
      setLoading(false);
    })();
  }, []);

  async function save() {
    setSaving(true);
    setSaved(false);
    const res = await fetch("/api/admin/defaults", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const d = await res.json();
    if (d.ok) setSaved(true);
    setSaving(false);
  }

  const setField = (k: string, v: unknown) => setForm((p) => ({ ...p, [k]: v }));

  if (loading) return <div style={{ padding: 32, color: "#64748b" }}>Loading defaults...</div>;

  return (
    <div style={{ padding: 32, maxWidth: 640 }}>
      <h1 style={{ margin: "0 0 8px", fontSize: 22, color: "#e2e8f0", fontWeight: 700 }}>
        Default Settings
      </h1>
      <p style={{ margin: "0 0 28px", fontSize: 13, color: "#64748b" }}>
        These are inherited by all users with &quot;use defaults&quot; enabled. Changes here
        invalidate all user caches.
      </p>

      <Section2 title="Expert skills (×3 weight, comma-separated)">
        <textarea
          value={((form.expert_skills ?? []) as string[]).join(", ")}
          onChange={(e) =>
            setField(
              "expert_skills",
              e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            )
          }
          rows={3}
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </Section2>

      <Section2 title="Secondary skills (×1 weight)">
        <textarea
          value={((form.secondary_skills ?? []) as string[]).join(", ")}
          onChange={(e) =>
            setField(
              "secondary_skills",
              e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            )
          }
          rows={2}
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </Section2>

      <Section2 title={`Job age limit — ${form.job_age_days ?? 7} days`}>
        <input
          type="range"
          min={1}
          max={60}
          value={(form.job_age_days as number) ?? 7}
          onChange={(e) => setField("job_age_days", parseInt(e.target.value, 10))}
          style={{ width: "100%", accentColor: "#6366f1" }}
        />
      </Section2>

      <Section2 title="Gemini filter prompt">
        <textarea
          value={(form.gemini_filter_prompt as string) ?? ""}
          onChange={(e) => setField("gemini_filter_prompt", e.target.value)}
          rows={10}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "monospace", fontSize: 12 }}
        />
      </Section2>

      <Section2 title="Default Excluded keywords (Title blacklist)">
        <textarea
          value={((form.excluded_keywords ?? []) as string[]).join(", ")}
          onChange={(e) =>
            setField(
              "excluded_keywords",
              e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            )
          }
          rows={2}
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </Section2>

      <Section2 title="Default Required keywords (Tech stack check)">
        <textarea
          value={((form.required_keywords ?? []) as string[]).join(", ")}
          onChange={(e) =>
            setField(
              "required_keywords",
              e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            )
          }
          rows={2}
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </Section2>

      <Section2 title="Default Location / Citizenship blacklist">
        <textarea
          value={((form.blacklisted_locations ?? []) as string[]).join(", ")}
          onChange={(e) =>
            setField(
              "blacklisted_locations",
              e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            )
          }
          rows={2}
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </Section2>

      <Section2 title="Score denominator">
        <input
          type="number"
          min={1}
          max={100}
          value={(form.score_denominator as number) ?? 18}
          onChange={(e) => setField("score_denominator", parseInt(e.target.value, 10))}
          style={{ ...inputStyle, width: 80 }}
        />
        <p style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>
          Raw skill score is divided by this. Default 18 = (15 expert × 3 weight).
        </p>
      </Section2>

      {saved && (
        <div style={{ color: "#4ade80", fontSize: 13, marginBottom: 12 }}>
          ✓ Saved. All user caches invalidated.
        </div>
      )}
      <button
        onClick={save}
        disabled={saving}
        style={{
          padding: "12px 28px",
          background: "#6366f1",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 600,
          cursor: "pointer",
          opacity: saving ? 0.6 : 1,
        }}
      >
        {saving ? "Saving..." : "Save defaults"}
      </button>
    </div>
  );
}
