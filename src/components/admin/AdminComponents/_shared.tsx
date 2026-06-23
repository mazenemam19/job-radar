"use client";
// src/components/admin/AdminComponents/_shared.tsx
// Style constants and tiny presentational components shared across the admin
// panel files in this folder. Not exported from index.ts — internal only.

export const INPUT_CLASS =
  "w-full rounded-lg border border-[#1e1e30] bg-[#0a0a18] px-3 py-2 text-[13px] text-[#e2e8f0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366f1]";

export const TH_CLASS =
  "border-b border-[#1e1e30] px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-[#64748b]";

export const TD_CLASS = "border-b border-[#0d0d1a] px-3.5 py-3 text-[13px] text-[#e2e8f0]";

export const LABEL_CLASS = "mb-1.5 block text-[11px] font-medium text-[#64748b]";

export function ActionBtn({
  onClick,
  label,
  color = "#6366f1",
}: {
  onClick: () => void;
  label: string;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="mr-1.5 cursor-pointer rounded-md border bg-transparent px-3 py-1 text-xs"
      style={{ borderColor: color, color }}
    >
      {label}
    </button>
  );
}

export function FormField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className={LABEL_CLASS}>
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={INPUT_CLASS}
      />
    </div>
  );
}

export function Section2({
  title,
  children,
  htmlFor,
}: {
  title: string;
  children: React.ReactNode;
  /** When the section wraps exactly one form control, pass its id to render
   *  an associated <label> instead of a plain heading. */
  htmlFor?: string;
}) {
  const headingClass = "mb-2.5 block text-xs font-semibold uppercase tracking-wide text-[#94a3b8]";
  return (
    <div className="mb-6">
      {htmlFor ? (
        <label htmlFor={htmlFor} className={headingClass}>
          {title}
        </label>
      ) : (
        <h3 className={headingClass}>{title}</h3>
      )}
      {children}
    </div>
  );
}
