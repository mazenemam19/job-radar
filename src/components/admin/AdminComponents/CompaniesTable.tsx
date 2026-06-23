"use client";
// src/components/admin/AdminComponents/CompaniesTable.tsx

import { useState, useEffect, useCallback } from "react";
import type { ATSCompanyRow } from "@/lib/types";
import { VALID_ATS } from "@/lib/constants";
import { ActionBtn, FormField, INPUT_CLASS, TH_CLASS, TD_CLASS, LABEL_CLASS } from "./_shared";

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
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-[22px] font-bold text-[#e2e8f0]">ATS Companies ({companies.length})</h1>
        <button
          onClick={() => {
            setShowNew(true);
            setEditId(null);
            setForm(EMPTY_FORM);
          }}
          className="cursor-pointer rounded-lg border-0 bg-[#6366f1] px-[18px] py-2.5 text-[13px] font-semibold text-white"
        >
          + Add company
        </button>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name, country, ATS..."
        className={`${INPUT_CLASS} mb-4`}
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
        <div className="p-4 text-[#64748b]">Loading...</div>
      ) : (
        <div className="overflow-auto rounded-xl border border-[#1e1e30] bg-[#0d0d1a]">
          <table className="w-full min-w-[700px] border-collapse">
            <thead>
              <tr>
                {["Company", "ATS", "Country", "Pipelines", "Active", "Actions"].map((h) => (
                  <th key={h} className={TH_CLASS}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td className={TD_CLASS}>
                    <strong>{c.name}</strong>
                    <div className="text-[11px] text-[#64748b]">{c.slug}</div>
                  </td>
                  <td className={`${TD_CLASS} font-mono text-xs text-[#818cf8]`}>{c.ats}</td>
                  <td className={TD_CLASS}>
                    {c.country_flag} {c.country}
                  </td>
                  <td className={TD_CLASS}>
                    {c.pipeline_visa && (
                      <span className="mr-1 text-[10px] text-[#818cf8]">✈️Visa</span>
                    )}
                    {c.pipeline_local && (
                      <span className="mr-1 text-[10px] text-[#22c55e]">🇪🇬Local</span>
                    )}
                    {c.pipeline_global && (
                      <span className="text-[10px] text-[#f59e0b]">🌐Global</span>
                    )}
                  </td>
                  <td className={TD_CLASS}>
                    <span style={{ color: c.is_active ? "#4ade80" : "#ef4444" }}>
                      {c.is_active ? "✓" : "✗"}
                    </span>
                  </td>
                  <td className={TD_CLASS}>
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
    <div className="mb-5 rounded-xl border border-[#1e1e30] bg-[#0a0a18] p-5">
      <h3 className="mb-4 text-sm text-[#e2e8f0]">{isEdit ? "Edit" : "New"} company</h3>
      <div className="grid grid-cols-2 gap-3">
        <FormField
          id="company-name"
          label="Company name"
          value={form.name}
          onChange={(v) => set("name", v)}
        />
        <div>
          <label htmlFor="company-ats" className={LABEL_CLASS}>
            ATS type
          </label>
          <select
            id="company-ats"
            value={form.ats}
            onChange={(e) => set("ats", e.target.value)}
            className={INPUT_CLASS}
          >
            {VALID_ATS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <FormField
          id="company-slug"
          label="Slug (ATS company ID)"
          value={form.slug}
          onChange={(v) => set("slug", v)}
        />
        <FormField
          id="company-country"
          label="Country code (e.g. GB)"
          value={form.country}
          onChange={(v) => set("country", v.toUpperCase())}
        />
        <FormField
          id="company-city"
          label="City (optional)"
          value={form.city ?? ""}
          onChange={(v) => set("city", v)}
        />
        <fieldset className="border-0 p-0">
          <legend className={LABEL_CLASS}>Pipelines</legend>
          <div className="mt-1 flex gap-3">
            {(
              [
                ["pipeline_visa", "✈️ Visa"],
                ["pipeline_local", "🇪🇬 Local"],
                ["pipeline_global", "🌐 Global"],
              ] as [keyof CompanyForm, string][]
            ).map(([k, l]) => (
              <label
                key={k}
                className="flex cursor-pointer items-center gap-1.5 text-[13px] text-[#94a3b8]"
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
        </fieldset>
      </div>
      <div className="mt-4 flex gap-2.5">
        <button
          onClick={onCancel}
          className="cursor-pointer rounded-lg border-0 bg-[#1e1e30] px-4 py-2 text-[13px] text-[#94a3b8]"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          className="cursor-pointer rounded-lg border-0 bg-[#6366f1] px-5 py-2 text-[13px] font-semibold text-white"
        >
          {isEdit ? "Save changes" : "Add company"}
        </button>
      </div>
    </div>
  );
}
