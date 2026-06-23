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
