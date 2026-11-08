"use client";

import { useState, type FormEvent } from "react";
import type { Pipeline, SalaryCurrency } from "@/lib/types";

const CURRENCIES: SalaryCurrency[] = ["EGP", "USD", "EUR", "GBP"];
const PIPELINES: Pipeline[] = ["local", "global"];
const FIELD_LABEL_CLASS = "mb-1.5 block text-xs text-[#64748b]";
const FIELD_INPUT_CLASS =
  "w-full rounded-lg border border-[#1e1e30] bg-[#0a0a18] px-3 py-2.5 text-[13px] text-[#e2e8f0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366f1]";

export function SalarySubmissionForm({ onSubmitted }: { onSubmitted: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const body = {
      role_title: form.get("role_title"),
      years_experience: parseInt(form.get("years_experience") as string, 10),
      amount: parseFloat(form.get("amount") as string),
      currency: form.get("currency"),
      employment_type: form.get("employment_type"),
      work_arrangement: form.get("work_arrangement"),
      pipeline: form.get("pipeline"),
    };

    try {
      const response = await fetch("/api/salary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (data.ok) {
        onSubmitted();
      } else {
        setError(data.error ?? "Salary report could not be submitted.");
      }
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-7 rounded-xl border border-[#1e1e30] bg-[#0d0d1a] p-6"
    >
      <h3 className="mb-5 text-[15px] text-[#e2e8f0]">Submit a salary report</h3>

      <div className="grid grid-cols-2 gap-3.5">
        <Field
          label="Role title"
          name="role_title"
          type="text"
          placeholder="Senior Frontend Engineer"
          required
        />
        <Field
          label="Years of experience"
          name="years_experience"
          type="number"
          placeholder="5"
          required
        />
        <Field
          label="Monthly salary (gross)"
          name="amount"
          type="number"
          placeholder="15000"
          min="0.01"
          step="0.01"
          required
        />
        <SelectField
          label="Currency"
          name="currency"
          options={CURRENCIES.map((currency) => ({ v: currency, l: currency }))}
        />
        <SelectField
          label="Employment type"
          name="employment_type"
          options={[
            { v: "full-time", l: "Full-time" },
            { v: "part-time", l: "Part-time" },
            { v: "contract", l: "Contract" },
            { v: "freelance", l: "Freelance" },
          ]}
        />
        <SelectField
          label="Work arrangement"
          name="work_arrangement"
          options={[
            { v: "onsite", l: "On-site" },
            { v: "remote", l: "Remote" },
            { v: "hybrid", l: "Hybrid" },
          ]}
        />
        <SelectField
          label="Pipeline"
          name="pipeline"
          options={PIPELINES.map((pipeline) => ({
            v: pipeline,
            l: pipeline.charAt(0).toUpperCase() + pipeline.slice(1),
          }))}
        />
      </div>

      {error && <div className="mt-2.5 text-[13px] text-[#f87171]">{error}</div>}

      <p className="mb-0 mt-3 text-xs text-[#64748b]">
        Your original amount and the server-recorded USD conversion are kept together. Your report
        date is set by the server.
      </p>

      <button
        type="submit"
        disabled={submitting}
        className="mt-5 cursor-pointer rounded-lg border-0 bg-[#6366f1] px-6 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed"
        style={{ opacity: submitting ? 0.6 : 1 }}
      >
        {submitting ? "Submitting..." : "Submit anonymously"}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  type,
  placeholder,
  min,
  step,
  required,
}: {
  label: string;
  name: string;
  type: string;
  placeholder?: string;
  min?: string;
  step?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={`salary-${name}`} className={FIELD_LABEL_CLASS}>
        {label}
      </label>
      <input
        id={`salary-${name}`}
        name={name}
        type={type}
        placeholder={placeholder}
        min={min}
        step={step}
        required={required}
        className={FIELD_INPUT_CLASS}
      />
    </div>
  );
}

function SelectField({
  label,
  name,
  options,
}: {
  label: string;
  name: string;
  options: { v: string; l: string }[];
}) {
  return (
    <div>
      <label htmlFor={`salary-${name}`} className={FIELD_LABEL_CLASS}>
        {label}
      </label>
      <select id={`salary-${name}`} name={name} className={FIELD_INPUT_CLASS}>
        {options.map((option) => (
          <option key={option.v} value={option.v}>
            {option.l}
          </option>
        ))}
      </select>
    </div>
  );
}
