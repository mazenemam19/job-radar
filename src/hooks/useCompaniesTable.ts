"use client";
// src/hooks/useCompaniesTable.ts
//
// Owns CompaniesTable state: fetches the company list on mount, handles
// create/edit/delete operations, and tracks form/edit-id state.
// Pure transforms (filtering, form hydration) live in lib/companies-table.ts.

import { useState, useEffect, useCallback } from "react";
import type { ATSCompanyRow } from "@/lib/types";
import { EMPTY_FORM, formFromRow, type CompanyForm } from "@/lib/companies-table";

export function useCompaniesTable() {
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

  function startNew() {
    setShowNew(true);
    setEditId(null);
    setForm(EMPTY_FORM);
  }

  function startEdit(c: ATSCompanyRow) {
    setEditId(c.id);
    setForm(formFromRow(c));
    setShowNew(false);
  }

  function cancelForm() {
    setShowNew(false);
    setEditId(null);
    setForm(EMPTY_FORM);
  }

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
    const res = await fetch(`/api/admin/companies/${id}`, { method: "DELETE" });
    const d = await res.json();
    if (d.ok) {
      setCompanies((p) => p.filter((c) => c.id !== id));
    } else {
      alert(`Delete failed: ${d.error ?? "unknown error"}`);
    }
  }

  return {
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
  };
}
