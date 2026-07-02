"use client";
// src/hooks/useSettingsForm.ts
//
// Owns the settings form's state: fetches the current settings on mount,
// tracks edits as a single fields object, and saves. All CSV parsing,
// hydration, and payload-building logic lives in lib/settings-form.ts so it
// can be unit tested without React — this hook is just the wiring.

import { useEffect, useState } from "react";
import type { SettingsData, SettingsFormFields, SeniorityLevel } from "@/lib/types";
import {
  DEFAULT_FORM_FIELDS,
  hydrateFormFields,
  buildSettingsPayload,
  computeRelocationWeight,
} from "@/lib/settings-form";

type Status =
  | { kind: "loading" }
  | { kind: "ready" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

export function useSettingsForm() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [fields, setFields] = useState<SettingsFormFields>(DEFAULT_FORM_FIELDS);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/settings");
      const json = await res.json();
      if (json.ok) {
        const d: SettingsData = json.data;
        setData(d);
        setFields(hydrateFormFields(d.resolved));
      }
      setStatus({ kind: "ready" });
    })();
  }, []);

  function update<K extends keyof SettingsFormFields>(key: K, value: SettingsFormFields[K]) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  function toggleSeniorityLevel(level: SeniorityLevel) {
    setFields((prev) => {
      const next = new Set(prev.seniorityLevels);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return { ...prev, seniorityLevels: next };
    });
  }

  async function save() {
    const result = buildSettingsPayload(fields);
    if (!result.ok) {
      setStatus({ kind: "error", message: result.error });
      return;
    }

    setStatus({ kind: "saving" });
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.payload),
      });
      const json = await res.json();
      if (!json.ok) {
        setStatus({ kind: "error", message: json.error });
        return;
      }

      const nextHasKey = fields.clearGeminiKey
        ? false
        : fields.geminiKey.trim()
          ? true
          : (data?.profile.has_gemini_key ?? false);
      setData((prev) =>
        prev ? { ...prev, profile: { ...prev.profile, has_gemini_key: nextHasKey } } : prev,
      );
      setFields((prev) => ({ ...prev, geminiKey: "", clearGeminiKey: false }));
      setStatus({ kind: "saved" });
    } catch {
      setStatus({ kind: "error", message: "Network error" });
    }
  }

  return {
    data,
    status,
    fields,
    update,
    toggleSeniorityLevel,
    save,
    relocationWeight: computeRelocationWeight(fields),
  };
}
