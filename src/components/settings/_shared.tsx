"use client";
// src/components/settings/_shared.tsx
// Style constants and tiny presentational components shared across the
// settings form. Not exported from an index — internal to this folder.

import type { ReactNode } from "react";

export const INPUT_CLASS =
  "w-full rounded-lg border border-[#1e1e30] bg-[#0a0a18] px-3 py-2.5 text-sm text-[#e2e8f0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366f1]";

export function Section({
  title,
  children,
  htmlFor,
}: {
  title: ReactNode;
  children: ReactNode;
  htmlFor?: string;
}) {
  const headingClass =
    "mb-3 block text-[13px] font-semibold uppercase tracking-wide text-[#94a3b8]";
  return (
    <div className="mb-7">
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

/** A Section wrapping a single comma-separated-list textarea. Covers the
 *  ~9 near-identical keyword/skill fields in the settings form. */
export function KeywordField({
  id,
  title,
  value,
  onChange,
  rows = 2,
  placeholder,
  helperText,
  monospace = false,
}: {
  id: string;
  title: ReactNode;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
  helperText?: ReactNode;
  monospace?: boolean;
}) {
  return (
    <Section title={title} htmlFor={id}>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className={`${INPUT_CLASS} resize-y${monospace ? " font-mono text-xs" : ""}`}
      />
      {helperText && <p className="mt-1 text-[11px] text-[#475569]">{helperText}</p>}
    </Section>
  );
}

/** The Gemini API key field: shows configured/missing status, lets the user
 *  enter a replacement, and offers a "clear on save" checkbox once a key
 *  exists. Pulled out because its disable/placeholder logic branches on
 *  three states (has key / entering new key / clearing). */
export function GeminiKeySection({
  geminiKey,
  onGeminiKeyChange,
  clearGeminiKey,
  onClearGeminiKeyChange,
  hasGeminiKey,
}: {
  geminiKey: string;
  onGeminiKeyChange: (v: string) => void;
  clearGeminiKey: boolean;
  onClearGeminiKeyChange: (v: boolean) => void;
  hasGeminiKey: boolean;
}) {
  return (
    <Section title="Gemini API Key" htmlFor="gemini-key">
      <p className="mb-3 text-[13px] text-[#64748b]">
        {clearGeminiKey
          ? "Key will be cleared on save."
          : hasGeminiKey
            ? "✓ API key configured."
            : "⚠️ No key set. Required for filtering and strategy."}
      </p>
      <input
        id="gemini-key"
        type="password"
        value={geminiKey}
        disabled={clearGeminiKey}
        onChange={(e) => onGeminiKeyChange(e.target.value)}
        placeholder={
          clearGeminiKey
            ? ""
            : hasGeminiKey
              ? "•••••••••••••••••• (enter a new key to replace)"
              : "Enter your Gemini API key"
        }
        className={`${INPUT_CLASS} disabled:opacity-50`}
      />
      {hasGeminiKey && (
        <label className="mt-2 flex items-center gap-2 text-[12px] text-[#94a3b8]">
          <input
            type="checkbox"
            checked={clearGeminiKey}
            onChange={(e) => {
              onClearGeminiKeyChange(e.target.checked);
              if (e.target.checked) onGeminiKeyChange("");
            }}
          />
          Clear key on save
        </label>
      )}
    </Section>
  );
}

/** Toggle-grid for seniority levels; pulled out because the active/inactive
 *  styling is a 3-way ternary per level and would otherwise inflate the
 *  parent's complexity for zero readability gain. */
export function SeniorityLevelsSection<Level extends string>({
  levels,
  selected,
  onToggle,
}: {
  levels: { key: Level; label: string }[];
  selected: Set<Level>;
  onToggle: (level: Level) => void;
}) {
  return (
    <Section title="Seniority levels">
      <p className="mb-3 text-[13px] text-[#64748b]">
        Select which seniority levels to include. Jobs matching none always pass (unlabelled).
      </p>
      <div className="mb-4 flex flex-wrap gap-2">
        {levels.map(({ key, label }) => {
          const active = selected.has(key);
          return (
            <button
              key={key}
              type="button"
              role="switch"
              aria-checked={active}
              onClick={() => onToggle(key)}
              className="cursor-pointer rounded-full px-4 py-1.5 text-[13px] transition-colors"
              style={{
                border: `1px solid ${active ? "#6366f1" : "#1e1e30"}`,
                background: active ? "rgba(99,102,241,0.15)" : "transparent",
                color: active ? "#818cf8" : "#64748b",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
    </Section>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={description ? `${label}. ${description}` : label}
      onClick={() => onChange(!checked)}
      className="mb-2.5 flex w-full cursor-pointer items-center gap-3 border-0 bg-transparent p-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366f1]"
    >
      <span
        className="relative h-5 w-[38px] flex-shrink-0 rounded-full transition-colors"
        style={{ background: checked ? "#6366f1" : "#1e1e30" }}
      >
        <span
          className="absolute top-[3px] h-3.5 w-3.5 rounded-full bg-white transition-[left]"
          style={{ left: checked ? 20 : 3 }}
        />
      </span>
      <span>
        <span className="block text-sm text-[#e2e8f0]">{label}</span>
        {description && <span className="block text-xs text-[#64748b]">{description}</span>}
      </span>
    </button>
  );
}

export function ScoringWeightsSection({
  skillWeight,
  recencyWeight,
  relocationWeight,
  onSkillWeightChange,
  onRecencyWeightChange,
}: {
  skillWeight: number;
  recencyWeight: number;
  relocationWeight: number;
  onSkillWeightChange: (v: number) => void;
  onRecencyWeightChange: (v: number) => void;
}) {
  return (
    <Section title="Scoring weights">
      <div className="flex flex-col gap-2.5">
        <WeightSlider
          id="weight-skill"
          label="Skill match"
          value={skillWeight}
          onChange={onSkillWeightChange}
          color="#6366f1"
        />
        <WeightSlider
          id="weight-recency"
          label="Recency"
          value={recencyWeight}
          onChange={onRecencyWeightChange}
          color="#22c55e"
        />
        <div className="text-[13px] text-[#64748b]">
          Relocation bonus: <strong className="text-[#f59e0b]">{relocationWeight}%</strong>
          {relocationWeight < 0 && (
            <span className="text-[#ef4444]"> (invalid — reduce above)</span>
          )}
        </div>
      </div>
    </Section>
  );
}

/** Save button plus the error/saved status line above it. */
export function SaveBar({
  status,
  onSave,
  disabled,
}: {
  status: { kind: "ready" | "saving" | "saved" | "error"; message?: string };
  onSave: () => void;
  disabled: boolean;
}) {
  const saving = status.kind === "saving";
  return (
    <>
      {status.kind === "error" && (
        <div className="mb-4 text-[13px] text-[#f87171]">{status.message}</div>
      )}
      {status.kind === "saved" && (
        <div className="mb-4 text-[13px] text-[#4ade80]">
          ✓ Settings saved. Your next dashboard load will rebuild your cache.
        </div>
      )}
      <button
        onClick={onSave}
        disabled={saving || disabled}
        className="cursor-pointer rounded-lg border-0 bg-[#6366f1] px-7 py-3 text-[15px] font-semibold text-white disabled:cursor-not-allowed"
        style={{ opacity: saving ? 0.6 : 1 }}
      >
        {saving ? "Saving..." : "Save settings"}
      </button>
    </>
  );
}

export function WeightSlider({
  id,
  label,
  value,
  onChange,
  color,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  color: string;
}) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-[13px]">
        <label htmlFor={id} className="text-[#94a3b8]">
          {label}
        </label>
        <span style={{ color }}>{value}%</span>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="w-full"
        style={{ accentColor: color }}
      />
    </div>
  );
}
