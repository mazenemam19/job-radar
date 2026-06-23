"use client";
// src/components/admin/AdminComponents/CompaniesTable.tsx

import { useState, useEffect, useCallback } from "react";
import type { ATSCompanyRow } from "@/lib/types";
import { VALID_ATS } from "@/lib/constants";
import { ActionBtn, FormField, inputStyle, thStyle, tdStyle, labelSt } from "./_shared";

type CompanyForm = Omit<ATSCompanyRow, "id" | "created_at" | "updated_at">;

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
  const [companies, setCompanies] = useState<ATSCompanyRow[]>([]);
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

  function startEdit(c: ATSCompanyRow) {
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
            {VALID_ATS.map((t) => (
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
