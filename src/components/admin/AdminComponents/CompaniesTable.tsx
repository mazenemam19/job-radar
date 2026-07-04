"use client";
// src/components/admin/AdminComponents/CompaniesTable.tsx
// Thin render layer — all state and fetch logic lives in hooks/useCompaniesTable.ts;
// filtering and form helpers live in lib/companies-table.ts.

import { VALID_ATS } from "@/lib/constants";
import { filterCompanies, type CompanyForm } from "@/lib/companies-table";
import { useCompaniesTable } from "@/hooks/useCompaniesTable";
import { ActionBtn, FormField, INPUT_CLASS, TH_CLASS, TD_CLASS, LABEL_CLASS } from "./_shared";

export function CompaniesTable() {
  const {
    companies,
    loading,
    search,
    setSearch,
    editId,
    form,
    setForm,
    showNew,
    startNew,
    startEdit,
    cancelForm,
    saveNew,
    saveEdit,
    deleteCompany,
  } = useCompaniesTable();

  const filtered = filterCompanies(companies, search);

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-[22px] font-bold text-[#e2e8f0]">ATS Companies ({companies.length})</h1>
        <button
          onClick={startNew}
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
          onCancel={cancelForm}
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
