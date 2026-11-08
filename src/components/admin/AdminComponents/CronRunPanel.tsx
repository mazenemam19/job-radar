"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Json } from "@/lib/database.types";

type CronLog = {
  id: string;
  run_at: string;
  total_fetched: number | null;
  duration_ms: number | null;
  errors: string[] | null;
  warnings: string[] | null;
  source_health: Json | null;
  trigger: string | null;
};

type CronResponse = {
  ok: boolean;
  error?: string;
  data?: CronRunData;
};

type CronRunData = {
  total_fetched: number;
  duration_ms: number;
  error_count: number;
  warning_count: number;
  email_sent_count: number;
  email_failed_count: number;
};

function formatDuration(durationMs: number | null): string {
  return `${((durationMs ?? 0) / 1000).toFixed(1)}s`;
}

function MessageList({ title, messages, color }: { title: string; messages: string[]; color: string }) {
  if (messages.length === 0) return null;

  return (
    <div className="mt-4">
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color }}>
        {title} ({messages.length})
      </h3>
      <ul className="m-0 list-disc space-y-1 pl-5 text-xs leading-relaxed text-slate-400">
        {messages.map((message, index) => (
          <li key={`${index}-${message}`}>{message}</li>
        ))}
      </ul>
    </div>
  );
}

function completedRun(payload: CronResponse, response: Response): CronRunData {
  if (!response.ok || !payload.ok || !payload.data) {
    throw new Error(payload.error ?? "The cron run did not complete.");
  }

  return payload.data;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The cron run did not complete.";
}

function logDetails(lastRun: CronLog | null) {
  const errors = lastRun?.errors ?? [];
  const warnings = lastRun?.warnings ?? [];

  return {
    errors,
    warnings,
    sourceHealth: lastRun?.source_health ? JSON.stringify(lastRun.source_health, null, 2) : null,
  };
}

function useCronRerun() {
  const router = useRouter();
  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  async function rerunCron() {
    if (
      !window.confirm(
        "Run the live job scan now? This fetches every active source and may send scan-complete emails.",
      )
    ) {
      return;
    }

    setIsRunning(true);
    setStatus("Starting the live cron run. It can take up to five minutes.");
    setIsError(false);

    try {
      const response = await fetch("/api/cron", { method: "POST" });
      const payload = (await response.json()) as CronResponse;
      const data = completedRun(payload, response);
      setStatus(
        `Completed: ${data.total_fetched} jobs fetched in ${formatDuration(data.duration_ms)}; ` +
          `${data.email_sent_count} emails sent, ${data.email_failed_count} failed; ` +
          `${data.error_count} errors and ${data.warning_count} warnings. Refreshing the run log.`,
      );
      router.refresh();
    } catch (error) {
      setIsError(true);
      setStatus(errorMessage(error));
    } finally {
      setIsRunning(false);
    }
  }

  return { isRunning, status, isError, rerunCron };
}

/** Displays the last structured cron log and safely starts an admin-only run. */
export function CronRunPanel({ lastRun }: { lastRun: CronLog | null }) {
  const { isRunning, status, isError, rerunCron } = useCronRerun();
  const { errors, warnings, sourceHealth } = logDetails(lastRun);

  return (
    <section className="mb-7 rounded-xl border border-[#1e1e30] bg-[#0d0d1a] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="m-0 text-sm text-slate-400">Most recent cron run</h2>
          <p className="mb-0 mt-1 text-xs leading-relaxed text-slate-500">
            Manual runs use the same protected endpoint as the scheduled job and can send job-alert
            emails.
          </p>
        </div>
        <button
          type="button"
          onClick={rerunCron}
          disabled={isRunning}
          className="cursor-pointer rounded-md border border-indigo-400 bg-indigo-500/10 px-3 py-1.5 text-xs font-medium text-indigo-300 disabled:cursor-wait disabled:opacity-60"
        >
          {isRunning ? "Running cron…" : "Run cron now"}
        </button>
      </div>

      {status && (
        <p
          role={isError ? "alert" : "status"}
          className={`mb-0 mt-4 rounded-md px-3 py-2 text-xs leading-relaxed ${
            isError ? "bg-rose-500/10 text-rose-300" : "bg-indigo-500/10 text-indigo-200"
          }`}
        >
          {status}
        </p>
      )}

      {!lastRun ? (
        <p className="mb-0 mt-4 text-[13px] text-slate-500">No completed cron run has been logged yet.</p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-6">
            <Stat label="Ran at" value={new Date(lastRun.run_at).toLocaleString()} />
            <Stat label="Trigger" value={lastRun.trigger ?? "—"} />
            <Stat label="Jobs fetched" value={String(lastRun.total_fetched ?? 0)} />
            <Stat label="Duration" value={formatDuration(lastRun.duration_ms)} />
            <Stat label="Errors" value={String(errors.length)} />
            <Stat label="Warnings" value={String(warnings.length)} />
          </div>
          <MessageList title="Errors" messages={errors} color="#fda4af" />
          <MessageList title="Warnings" messages={warnings} color="#fcd34d" />
          {sourceHealth && (
            <details className="mt-4 rounded-md border border-[#1e1e30] bg-[#08080f] p-3">
              <summary className="cursor-pointer text-xs font-medium text-slate-300">
                Source health details
              </summary>
              <pre className="mb-0 mt-3 overflow-x-auto whitespace-pre-wrap text-[11px] leading-relaxed text-slate-400">
                {sourceHealth}
              </pre>
            </details>
          )}
        </>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="mt-0.5 text-sm font-medium text-slate-200">{value}</div>
    </div>
  );
}
