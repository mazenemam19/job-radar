"use client";
// src/components/admin/AdminComponents.tsx
// All four admin panel components in one file to reduce route clutter.
// Each is exported individually and used by its corresponding admin page.

import { useState, useEffect, useCallback } from "react";
import type { ATSType } from "@/lib/types";

const ATS_TYPES: ATSType[] = [
  "greenhouse",
  "lever",
  "ashby",
  "workable",
  "teamtailor",
  "breezy",
  "smartrecruiters",
  "bamboohr",
  "jazzhr",
];

// ── Shared helpers ────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  padding: "8px 12px",
  background: "#0a0a18",
  border: "1px solid #1e1e30",
  borderRadius: 8,
  color: "#e2e8f0",
  fontSize: 13,
  width: "100%",
  boxSizing: "border-box",
};

const thStyle: React.CSSProperties = {
  padding: "10px 14px",
  textAlign: "left",
  fontSize: 11,
  color: "#64748b",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  borderBottom: "1px solid #1e1e30",
};

const tdStyle: React.CSSProperties = {
  padding: "12px 14px",
  fontSize: 13,
  color: "#e2e8f0",
  borderBottom: "1px solid #0d0d1a",
};

function ActionBtn({
  onClick,
  label,
  color = "#6366f1",
}: {
  onClick: () => void;
  label: string;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "4px 12px",
        background: "transparent",
        border: `1px solid ${color}`,
        borderRadius: 6,
        color,
        fontSize: 12,
        cursor: "pointer",
        marginRight: 6,
      }}
    >
      {label}
    </button>
  );
}

// ── 1. Users Table ────────────────────────────────────────────

interface UserRow {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
  onboarding_complete: boolean;
  created_at: string;
  last_active_at: string | null;
  user_settings: { uses_defaults: boolean }[] | null;
}

export function UsersTable() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/users");
      const d = await res.json();
      if (d.ok) setUsers(d.data);
      setLoading(false);
    })();
  }, []);

  async function toggleActive(user: UserRow) {
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !user.is_active }),
    });
    const d = await res.json();
    if (d.ok)
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, is_active: !u.is_active } : u)),
      );
  }

  if (loading) return <div style={{ padding: 32, color: "#64748b" }}>Loading users...</div>;

  return (
    <div style={{ padding: 32 }}>
      <h1 style={{ margin: "0 0 24px", fontSize: 22, color: "#e2e8f0", fontWeight: 700 }}>
        Users ({users.length})
      </h1>
      <div
        style={{
          background: "#0d0d1a",
          border: "1px solid #1e1e30",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Email", "Role", "Active", "Onboarded", "Profile", "Last active", "Actions"].map(
                (h) => (
                  <th key={h} style={thStyle}>
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td style={tdStyle}>{u.email}</td>
                <td style={tdStyle}>
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: 12,
                      fontSize: 11,
                      background: u.role === "admin" ? "#6366f120" : "#1e1e30",
                      color: u.role === "admin" ? "#818cf8" : "#64748b",
                    }}
                  >
                    {u.role}
                  </span>
                </td>
                <td style={tdStyle}>
                  <span style={{ color: u.is_active ? "#4ade80" : "#ef4444" }}>
                    {u.is_active ? "✓" : "✗"}
                  </span>
                </td>
                <td style={tdStyle}>
                  <span style={{ color: u.onboarding_complete ? "#4ade80" : "#64748b" }}>
                    {u.onboarding_complete ? "✓" : "—"}
                  </span>
                </td>
                <td style={tdStyle}>
                  {u.user_settings?.[0]?.uses_defaults ? (
                    <span style={{ color: "#64748b", fontSize: 11 }}>Default</span>
                  ) : (
                    <span style={{ color: "#818cf8", fontSize: 11 }}>Custom</span>
                  )}
                </td>
                <td style={{ ...tdStyle, fontSize: 11, color: "#64748b" }}>
                  {u.last_active_at ? new Date(u.last_active_at).toLocaleDateString() : "—"}
                </td>
                <td style={tdStyle}>
                  <ActionBtn
                    onClick={() => toggleActive(u)}
                    label={u.is_active ? "Block" : "Activate"}
                    color={u.is_active ? "#ef4444" : "#22c55e"}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── 2. Companies Table ────────────────────────────────────────

interface CompanyRow {
  id: string;
  name: string;
  ats: ATSType;
  slug: string;
  country: string;
  country_flag: string;
  city: string | null;
  pipeline_visa: boolean;
  pipeline_local: boolean;
  pipeline_global: boolean;
  is_active: boolean;
}

type CompanyForm = Omit<CompanyRow, "id">;

const EMPTY_FORM: CompanyForm = {
  name: "",
  ats: "greenhouse",
  slug: "",
  country: "",
  country_flag: "🌍",
  city: "",
  pipeline_visa: false,
  pipeline_local: false,
  pipeline_global: false,
  is_active: true,
};

export function CompaniesTable() {
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<CompanyForm>(EMPTY_FORM);
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/companies");
    const d = await res.json();
    if (d.ok) setCompanies(d.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function saveNew() {
    const res = await fetch("/api/admin/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const d = await res.json();
    if (d.ok) {
      setShowNew(false);
      setForm(EMPTY_FORM);
      load();
    }
  }

  async function saveEdit() {
    if (!editId) return;
    const res = await fetch(`/api/admin/companies/${editId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const d = await res.json();
    if (d.ok) {
      setEditId(null);
      setForm(EMPTY_FORM);
      load();
    }
  }

  async function deleteCompany(id: string) {
    if (!confirm("Delete this company?")) return;
    await fetch(`/api/admin/companies/${id}`, { method: "DELETE" });
    setCompanies((p) => p.filter((c) => c.id !== id));
  }

  function startEdit(c: CompanyRow) {
    setEditId(c.id);
    setForm({
      name: c.name,
      ats: c.ats,
      slug: c.slug,
      country: c.country,
      country_flag: c.country_flag,
      city: c.city ?? "",
      pipeline_visa: c.pipeline_visa,
      pipeline_local: c.pipeline_local,
      pipeline_global: c.pipeline_global,
      is_active: c.is_active,
    });
    setShowNew(false);
  }

  const filtered = companies.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.country.toLowerCase().includes(search.toLowerCase()) ||
      c.ats.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div style={{ padding: 32 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 22, color: "#e2e8f0", fontWeight: 700 }}>
          ATS Companies ({companies.length})
        </h1>
        <button
          onClick={() => {
            setShowNew(true);
            setEditId(null);
            setForm(EMPTY_FORM);
          }}
          style={{
            padding: "9px 18px",
            background: "#6366f1",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          + Add company
        </button>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name, country, ATS..."
        style={{ ...inputStyle, marginBottom: 16 }}
      />

      {(showNew || editId) && (
        <CompanyFormPanel
          form={form}
          setForm={setForm}
          onSave={editId ? saveEdit : saveNew}
          onCancel={() => {
            setShowNew(false);
            setEditId(null);
            setForm(EMPTY_FORM);
          }}
          isEdit={Boolean(editId)}
        />
      )}

      {loading ? (
        <div style={{ color: "#64748b", padding: 16 }}>Loading...</div>
      ) : (
        <div
          style={{
            background: "#0d0d1a",
            border: "1px solid #1e1e30",
            borderRadius: 12,
            overflow: "auto",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
            <thead>
              <tr>
                {["Company", "ATS", "Country", "Pipelines", "Active", "Actions"].map((h) => (
                  <th key={h} style={thStyle}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td style={tdStyle}>
                    <strong>{c.name}</strong>
                    <div style={{ fontSize: 11, color: "#64748b" }}>{c.slug}</div>
                  </td>
                  <td
                    style={{ ...tdStyle, fontFamily: "monospace", fontSize: 12, color: "#818cf8" }}
                  >
                    {c.ats}
                  </td>
                  <td style={tdStyle}>
                    {c.country_flag} {c.country}
                  </td>
                  <td style={tdStyle}>
                    {c.pipeline_visa && (
                      <span style={{ fontSize: 10, marginRight: 4, color: "#818cf8" }}>✈️Visa</span>
                    )}
                    {c.pipeline_local && (
                      <span style={{ fontSize: 10, marginRight: 4, color: "#22c55e" }}>
                        🇪🇬Local
                      </span>
                    )}
                    {c.pipeline_global && (
                      <span style={{ fontSize: 10, color: "#f59e0b" }}>🌐Global</span>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <span style={{ color: c.is_active ? "#4ade80" : "#ef4444" }}>
                      {c.is_active ? "✓" : "✗"}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <ActionBtn onClick={() => startEdit(c)} label="Edit" />
                    <ActionBtn onClick={() => deleteCompany(c.id)} label="Delete" color="#ef4444" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CompanyFormPanel({
  form,
  setForm,
  onSave,
  onCancel,
  isEdit,
}: {
  form: CompanyForm;
  setForm: (f: CompanyForm) => void;
  onSave: () => void;
  onCancel: () => void;
  isEdit: boolean;
}) {
  const set = (key: keyof CompanyForm, val: unknown) => setForm({ ...form, [key]: val });
  return (
    <div
      style={{
        background: "#0a0a18",
        border: "1px solid #1e1e30",
        borderRadius: 12,
        padding: 20,
        marginBottom: 20,
      }}
    >
      <h3 style={{ margin: "0 0 16px", fontSize: 14, color: "#e2e8f0" }}>
        {isEdit ? "Edit" : "New"} company
      </h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <FormField label="Company name" value={form.name} onChange={(v) => set("name", v)} />
        <div>
          <label style={labelSt}>ATS type</label>
          <select value={form.ats} onChange={(e) => set("ats", e.target.value)} style={inputStyle}>
            {ATS_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <FormField
          label="Slug (ATS company ID)"
          value={form.slug}
          onChange={(v) => set("slug", v)}
        />
        <FormField
          label="Country code (e.g. GB)"
          value={form.country}
          onChange={(v) => set("country", v.toUpperCase())}
        />
        <FormField
          label="City (optional)"
          value={form.city ?? ""}
          onChange={(v) => set("city", v)}
        />
        <div>
          <label style={labelSt}>Pipelines</label>
          <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
            {(
              [
                ["pipeline_visa", "✈️ Visa"],
                ["pipeline_local", "🇪🇬 Local"],
                ["pipeline_global", "🌐 Global"],
              ] as [keyof CompanyForm, string][]
            ).map(([k, l]) => (
              <label
                key={k}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 13,
                  color: "#94a3b8",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={form[k] as boolean}
                  onChange={(e) => set(k, e.target.checked)}
                />
                {l}
              </label>
            ))}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <button
          onClick={onCancel}
          style={{
            padding: "8px 16px",
            background: "#1e1e30",
            color: "#94a3b8",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          style={{
            padding: "8px 20px",
            background: "#6366f1",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {isEdit ? "Save changes" : "Add company"}
        </button>
      </div>
    </div>
  );
}

// ── 3. Default Settings Form ──────────────────────────────────

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

// ── 4. Submissions Table ──────────────────────────────────────

interface SubmissionRow {
  id: string;
  company_name: string;
  ats_type: string;
  slug: string;
  country: string;
  country_flag: string;
  pipeline_visa: boolean;
  pipeline_local: boolean;
  pipeline_global: boolean;
  submitter_email: string | null;
  status: string;
  test_result: { ok: boolean; jobs_found: number; error: string | null; tested_at: string } | null;
  submitted_at: string;
}

export function SubmissionsTable() {
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/submissions");
    const d = await res.json();
    if (d.ok) setSubmissions(d.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function runTest(id: string) {
    setTesting(id);
    const res = await fetch("/api/admin/test-ats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submission_id: id }),
    });
    const d = await res.json();
    if (d.ok) {
      setSubmissions((p) => p.map((s) => (s.id === id ? { ...s, test_result: d.data } : s)));
    }
    setTesting(null);
  }

  async function reviewSubmission(id: string, status: "approved" | "rejected") {
    const res = await fetch(`/api/admin/submissions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const d = await res.json();
    if (d.ok) setSubmissions((p) => p.map((s) => (s.id === id ? { ...s, status } : s)));
  }

  if (loading) return <div style={{ padding: 32, color: "#64748b" }}>Loading...</div>;

  const pending = submissions.filter((s) => s.status === "pending");
  const reviewed = submissions.filter((s) => s.status !== "pending");

  return (
    <div style={{ padding: 32 }}>
      <h1 style={{ margin: "0 0 24px", fontSize: 22, color: "#e2e8f0", fontWeight: 700 }}>
        ATS Submissions ({pending.length} pending)
      </h1>

      {[
        { label: "🟡 Pending", rows: pending },
        { label: "✓ Reviewed", rows: reviewed },
      ].map(
        ({ label, rows }) =>
          rows.length > 0 && (
            <div key={label} style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 14, color: "#94a3b8", margin: "0 0 12px" }}>{label}</h2>
              <div
                style={{
                  background: "#0d0d1a",
                  border: "1px solid #1e1e30",
                  borderRadius: 12,
                  overflow: "hidden",
                }}
              >
                {rows.map((sub) => (
                  <div
                    key={sub.id}
                    style={{ padding: "16px 20px", borderBottom: "1px solid #0d0d1a" }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0" }}>
                          {sub.company_name}
                        </div>
                        <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>
                          {sub.ats_type} · slug:{" "}
                          <code style={{ color: "#818cf8" }}>{sub.slug}</code> · {sub.country_flag}{" "}
                          {sub.country}
                          {sub.submitter_email && ` · ${sub.submitter_email}`}
                        </div>
                        <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
                          {new Date(sub.submitted_at).toLocaleString()}
                          {sub.pipeline_visa && " · ✈️ Visa"}
                          {sub.pipeline_local && " · 🇪🇬 Local"}
                          {sub.pipeline_global && " · 🌐 Global"}
                        </div>
                        {sub.test_result && (
                          <div
                            style={{
                              marginTop: 8,
                              padding: "6px 10px",
                              borderRadius: 6,
                              fontSize: 12,
                              background: sub.test_result.ok ? "#0d2a18" : "#2a0d0d",
                              color: sub.test_result.ok ? "#4ade80" : "#f87171",
                              border: `1px solid ${sub.test_result.ok ? "#166534" : "#991b1b"}`,
                              display: "inline-block",
                            }}
                          >
                            {sub.test_result.ok
                              ? `✅ Working — ${sub.test_result.jobs_found} jobs found`
                              : `❌ Failed — ${sub.test_result.error}`}
                          </div>
                        )}
                      </div>

                      {sub.status === "pending" && (
                        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                          <ActionBtn
                            onClick={() => runTest(sub.id)}
                            label={testing === sub.id ? "Testing..." : "🧪 Test"}
                            color="#f59e0b"
                          />
                          <ActionBtn
                            onClick={() => reviewSubmission(sub.id, "approved")}
                            label="✓ Approve"
                            color="#22c55e"
                          />
                          <ActionBtn
                            onClick={() => reviewSubmission(sub.id, "rejected")}
                            label="✗ Reject"
                            color="#ef4444"
                          />
                        </div>
                      )}
                      {sub.status !== "pending" && (
                        <span
                          style={{
                            padding: "4px 12px",
                            borderRadius: 20,
                            fontSize: 12,
                            background: sub.status === "approved" ? "#0d2a18" : "#2a0d0d",
                            color: sub.status === "approved" ? "#4ade80" : "#f87171",
                          }}
                        >
                          {sub.status}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ),
      )}

      {submissions.length === 0 && (
        <div style={{ padding: 48, textAlign: "center", color: "#64748b" }}>No submissions yet</div>
      )}
    </div>
  );
}

// ── Shared helpers (private) ──────────────────────────────────

function FormField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label style={labelSt}>{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle} />
    </div>
  );
}

function Section2({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h3
        style={{
          margin: "0 0 10px",
          fontSize: 12,
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

const labelSt: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  color: "#64748b",
  marginBottom: 5,
  fontWeight: 500,
};
