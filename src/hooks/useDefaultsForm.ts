"use client";
// src/hooks/useDefaultsForm.ts
//
// Owns the admin defaults form's state: fetches the current defaults on
// mount, tracks edits as a single fields object, and saves. All CSV
// parsing, hydration, and payload-building logic lives in
// lib/defaults-form.ts so it can be unit tested without React — this hook
// is just the wiring.

import { useEffect, useState } from "react";
import type { DefaultSettings } from "@/lib/types";
import {
  DEFAULT_FORM_FIELDS,
  hydrateFormFields,
  buildDefaultsPayload,
  type DefaultsFormFields,
} from "@/lib/defaults-form";

type Status =
  | { kind: "loading" }
  | { kind: "ready" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

export function useDefaultsForm() {
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [fields, setFields] = useState<DefaultsFormFields>(DEFAULT_FORM_FIELDS);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/defaults");
        const json = await res.json();
        if (json.ok) {
          const data: DefaultSettings = json.data;
          setFields(hydrateFormFields(data));
        }
        setStatus({ kind: "ready" });
      } catch {
        setStatus({ kind: "error", message: "Network error" });
      }
    })();
  }, []);

  function update<K extends keyof DefaultsFormFields>(key: K, value: DefaultsFormFields[K]) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    setStatus({ kind: "saving" });
    try {
      const res = await fetch("/api/admin/defaults", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildDefaultsPayload(fields)),
      });
      const json = await res.json();
      if (!json.ok) {
        setStatus({ kind: "error", message: json.error });
        return;
      }
      setStatus({ kind: "saved" });
    } catch {
      setStatus({ kind: "error", message: "Network error" });
    }
  }

  return { status, fields, update, save };
}
