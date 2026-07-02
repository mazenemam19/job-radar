"use client";
// src/components/admin/AdminComponents/SubmissionRow.tsx
// Single row in the ATS submissions table: metadata, test-result badge,
// and either the pending-review actions or the final status badge.

import type { ATSSubmission } from "@/lib/types";
import { ActionBtn } from "./_shared";

function TestResultBadge({ result }: { result: NonNullable<ATSSubmission["test_result"]> }) {
  return (
    <div
      className="mt-2 inline-block rounded-md border px-2.5 py-1.5 text-xs"
      style={{
        background: result.ok ? "#0d2a18" : "#2a0d0d",
        color: result.ok ? "#4ade80" : "#f87171",
        borderColor: result.ok ? "#166534" : "#991b1b",
      }}
    >
      {result.ok ? `✅ Working — ${result.jobs_found} jobs found` : `❌ Failed — ${result.error}`}
    </div>
  );
}

function StatusBadge({ status }: { status: ATSSubmission["status"] }) {
  return (
    <span
      className="rounded-full px-3 py-1 text-xs"
      style={{
        background: status === "approved" ? "#0d2a18" : "#2a0d0d",
        color: status === "approved" ? "#4ade80" : "#f87171",
      }}
    >
      {status}
    </span>
  );
}

interface Props {
  sub: ATSSubmission;
  testing: string | null;
  onTest: (id: string) => void;
  onReview: (id: string, status: "approved" | "rejected") => void;
}

export default function SubmissionRow({ sub, testing, onTest, onReview }: Props) {
  return (
    <div className="border-b border-[#0d0d1a] px-5 py-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[15px] font-semibold text-[#e2e8f0]">{sub.company_name}</div>
          <div className="mt-[3px] text-xs text-[#64748b]">
            {sub.ats_type} · slug: <code className="text-[#818cf8]">{sub.slug}</code> ·{" "}
            {sub.country_flag} {sub.country}
            {sub.submitter_email && ` · ${sub.submitter_email}`}
          </div>
          <div className="mt-0.5 text-[11px] text-[#475569]">
            {new Date(sub.submitted_at).toLocaleString()}
            {sub.pipeline_local && " · 🇪🇬 Local"}
            {sub.pipeline_global && " · 🌐 Global"}
          </div>
          {sub.test_result && <TestResultBadge result={sub.test_result} />}
        </div>

        {sub.status === "pending" ? (
          <div className="flex flex-shrink-0 gap-2">
            <ActionBtn
              onClick={() => onTest(sub.id)}
              label={testing === sub.id ? "Testing..." : "🧪 Test"}
              color="#f59e0b"
            />
            <ActionBtn
              onClick={() => onReview(sub.id, "approved")}
              label="✓ Approve"
              color="#22c55e"
            />
            <ActionBtn
              onClick={() => onReview(sub.id, "rejected")}
              label="✗ Reject"
              color="#ef4444"
            />
          </div>
        ) : (
          <StatusBadge status={sub.status} />
        )}
      </div>
    </div>
  );
}
