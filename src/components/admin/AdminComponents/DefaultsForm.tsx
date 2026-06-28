"use client";
// src/components/admin/AdminComponents/DefaultsForm.tsx

import { useState, useEffect } from "react";
import { INPUT_CLASS, Section2 } from "./_shared";

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

  if (loading) return <div className="p-8 text-[#64748b]">Loading defaults...</div>;

  return (
    <div className="max-w-[640px] p-8">
      <h1 className="mb-2 text-[22px] font-bold text-[#e2e8f0]">Default Settings</h1>
      <p className="mb-7 text-[13px] text-[#64748b]">
        These are inherited by all users with &quot;use defaults&quot; enabled. Changes here
        invalidate all user caches.
      </p>

      <Section2 title="Expert skills (×3 weight, comma-separated)" htmlFor="default-expert-skills">
        <textarea
          id="default-expert-skills"
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
          className={`${INPUT_CLASS} resize-y`}
        />
      </Section2>

      <Section2 title="Secondary skills (×1 weight)" htmlFor="default-secondary-skills">
        <textarea
          id="default-secondary-skills"
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
          className={`${INPUT_CLASS} resize-y`}
        />
      </Section2>

      <Section2
        title={`Job age limit — ${form.job_age_days ?? 7} days`}
        htmlFor="default-job-age-days"
      >
        <input
          id="default-job-age-days"
          type="range"
          min={1}
          max={60}
          value={(form.job_age_days as number) ?? 7}
          onChange={(e) => setField("job_age_days", parseInt(e.target.value, 10))}
          className="w-full accent-[#6366f1]"
        />
      </Section2>

      <Section2 title="Gemini filter prompt" htmlFor="default-gemini-prompt">
        <textarea
          id="default-gemini-prompt"
          value={(form.gemini_filter_prompt as string) ?? ""}
          onChange={(e) => setField("gemini_filter_prompt", e.target.value)}
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
          value={((form.seniority_levels ?? []) as string[]).join(", ")}
          onChange={(e) =>
            setField(
              "seniority_levels",
              e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            )
          }
          className={`${INPUT_CLASS} w-full`}
          placeholder="senior, staff"
        />
        <p className="mt-1 text-[11px] text-[#475569]">
          Which levels a user sees by default. Users can override.
        </p>
      </Section2>

      <Section2 title="Default Junior keywords (comma-separated)" htmlFor="default-junior-keywords">
        <textarea
          id="default-junior-keywords"
          value={((form.junior_keywords ?? []) as string[]).join(", ")}
          onChange={(e) =>
            setField(
              "junior_keywords",
              e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            )
          }
          rows={2}
          className={`${INPUT_CLASS} resize-y`}
        />
      </Section2>

      <Section2 title="Default Mid keywords (comma-separated)" htmlFor="default-mid-keywords">
        <textarea
          id="default-mid-keywords"
          value={((form.mid_keywords ?? []) as string[]).join(", ")}
          onChange={(e) =>
            setField(
              "mid_keywords",
              e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            )
          }
          rows={2}
          className={`${INPUT_CLASS} resize-y`}
        />
      </Section2>

      <Section2 title="Default Senior keywords (comma-separated)" htmlFor="default-senior-keywords">
        <textarea
          id="default-senior-keywords"
          value={((form.senior_keywords ?? []) as string[]).join(", ")}
          onChange={(e) =>
            setField(
              "senior_keywords",
              e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            )
          }
          rows={2}
          className={`${INPUT_CLASS} resize-y`}
        />
      </Section2>

      <Section2 title="Default Staff+ keywords (comma-separated)" htmlFor="default-staff-keywords">
        <textarea
          id="default-staff-keywords"
          value={((form.staff_keywords ?? []) as string[]).join(", ")}
          onChange={(e) =>
            setField(
              "staff_keywords",
              e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            )
          }
          rows={2}
          className={`${INPUT_CLASS} resize-y`}
        />
      </Section2>

      <Section2
        title="Default Excluded keywords (Title blacklist)"
        htmlFor="default-excluded-keywords"
      >
        <textarea
          id="default-excluded-keywords"
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
          className={`${INPUT_CLASS} resize-y`}
        />
      </Section2>

      <Section2
        title="Default Required keywords (Tech stack check)"
        htmlFor="default-required-keywords"
      >
        <textarea
          id="default-required-keywords"
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
          className={`${INPUT_CLASS} resize-y`}
        />
      </Section2>

      <Section2
        title="Default Location / Citizenship blacklist"
        htmlFor="default-blacklisted-locations"
      >
        <textarea
          id="default-blacklisted-locations"
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
          className={`${INPUT_CLASS} resize-y`}
        />
      </Section2>

      <Section2
        title="Global mode — Blocked regions/timezones"
        htmlFor="default-global-blocked-regions"
      >
        <textarea
          id="default-global-blocked-regions"
          value={((form.global_mode_blocked_regions ?? []) as string[]).join(", ")}
          onChange={(e) =>
            setField(
              "global_mode_blocked_regions",
              e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            )
          }
          rows={2}
          className={`${INPUT_CLASS} resize-y`}
        />
        <p className="mt-1 text-[11px] text-[#475569]">
          Comma-separated. Jobs in the Global pipeline matching these keywords are rejected.
        </p>
      </Section2>

      <Section2
        title="Global mode — Always-allowed locations"
        htmlFor="default-global-allowed-locations"
      >
        <textarea
          id="default-global-allowed-locations"
          value={((form.global_mode_allowed_locations ?? []) as string[]).join(", ")}
          onChange={(e) =>
            setField(
              "global_mode_allowed_locations",
              e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            )
          }
          rows={2}
          className={`${INPUT_CLASS} resize-y`}
        />
        <p className="mt-1 text-[11px] text-[#475569]">
          Comma-separated. Jobs matching these always pass the global mode filter (overrides blocked
          list).
        </p>
      </Section2>

      <Section2 title="Score denominator" htmlFor="default-score-denominator">
        <input
          id="default-score-denominator"
          type="number"
          min={1}
          max={100}
          value={(form.score_denominator as number) ?? 18}
          onChange={(e) => setField("score_denominator", parseInt(e.target.value, 10))}
          className={`${INPUT_CLASS} w-20`}
        />
        <p className="mt-1 text-[11px] text-[#475569]">
          Raw skill score is divided by this. Default 18 = (15 expert × 3 weight).
        </p>
      </Section2>

      {saved && (
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
