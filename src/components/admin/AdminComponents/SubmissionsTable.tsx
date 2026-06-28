"use client";
// src/components/admin/AdminComponents/SubmissionsTable.tsx

import { useState, useEffect, useCallback } from "react";
import type { ATSSubmission } from "@/lib/types";
import { ActionBtn } from "./_shared";

export function SubmissionsTable() {
  const [submissions, setSubmissions] = useState<ATSSubmission[]>([]);
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

  if (loading) return <div className="p-8 text-[#64748b]">Loading...</div>;

  const pending = submissions.filter((s) => s.status === "pending");
  const reviewed = submissions.filter((s) => s.status !== "pending");

  return (
    <div className="p-8">
      <h1 className="mb-6 text-[22px] font-bold text-[#e2e8f0]">
        ATS Submissions ({pending.length} pending)
      </h1>

      {[
        { label: "🟡 Pending", rows: pending },
        { label: "✓ Reviewed", rows: reviewed },
      ].map(
        ({ label, rows }) =>
          rows.length > 0 && (
            <div key={label} className="mb-8">
              <h2 className="mb-3 text-sm text-[#94a3b8]">{label}</h2>
              <div className="overflow-hidden rounded-xl border border-[#1e1e30] bg-[#0d0d1a]">
                {rows.map((sub) => (
                  <div key={sub.id} className="border-b border-[#0d0d1a] px-5 py-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-[15px] font-semibold text-[#e2e8f0]">
                          {sub.company_name}
                        </div>
                        <div className="mt-[3px] text-xs text-[#64748b]">
                          {sub.ats_type} · slug: <code className="text-[#818cf8]">{sub.slug}</code>{" "}
                          · {sub.country_flag} {sub.country}
                          {sub.submitter_email && ` · ${sub.submitter_email}`}
                        </div>
                        <div className="mt-0.5 text-[11px] text-[#475569]">
                          {new Date(sub.submitted_at).toLocaleString()}
                          {sub.pipeline_local && " · 🇪🇬 Local"}
                          {sub.pipeline_global && " · 🌐 Global"}
                        </div>
                        {sub.test_result && (
                          <div
                            className="mt-2 inline-block rounded-md border px-2.5 py-1.5 text-xs"
                            style={{
                              background: sub.test_result.ok ? "#0d2a18" : "#2a0d0d",
                              color: sub.test_result.ok ? "#4ade80" : "#f87171",
                              borderColor: sub.test_result.ok ? "#166534" : "#991b1b",
                            }}
                          >
                            {sub.test_result.ok
                              ? `✅ Working — ${sub.test_result.jobs_found} jobs found`
                              : `❌ Failed — ${sub.test_result.error}`}
                          </div>
                        )}
                      </div>

                      {sub.status === "pending" && (
                        <div className="flex flex-shrink-0 gap-2">
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
                          className="rounded-full px-3 py-1 text-xs"
                          style={{
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
        <div className="p-12 text-center text-[#64748b]">No submissions yet</div>
      )}
    </div>
  );
}
