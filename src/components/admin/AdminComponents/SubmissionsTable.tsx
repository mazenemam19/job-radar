"use client";
// src/components/admin/AdminComponents/SubmissionsTable.tsx

import { useState, useEffect, useCallback } from "react";
import type { ATSSubmission } from "@/lib/types";
import SubmissionRow from "./SubmissionRow";

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
                  <SubmissionRow
                    key={sub.id}
                    sub={sub}
                    testing={testing}
                    onTest={runTest}
                    onReview={reviewSubmission}
                  />
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
