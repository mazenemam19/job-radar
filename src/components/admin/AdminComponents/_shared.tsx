"use client";
// src/components/admin/AdminComponents/_shared.tsx
// Style constants and tiny presentational components shared across the admin
// panel files in this folder. Not exported from index.ts — internal only.

export const inputStyle: React.CSSProperties = {
  padding: "8px 12px",
  background: "#0a0a18",
  border: "1px solid #1e1e30",
  borderRadius: 8,
  color: "#e2e8f0",
  fontSize: 13,
  width: "100%",
  boxSizing: "border-box",
};

export const thStyle: React.CSSProperties = {
  padding: "10px 14px",
  textAlign: "left",
  fontSize: 11,
  color: "#64748b",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  borderBottom: "1px solid #1e1e30",
};

export const tdStyle: React.CSSProperties = {
  padding: "12px 14px",
  fontSize: 13,
  color: "#e2e8f0",
  borderBottom: "1px solid #0d0d1a",
};

export const labelSt: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  color: "#64748b",
  marginBottom: 5,
  fontWeight: 500,
};

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
      style={{
        padding: "4px 12px",
        background: "transparent",
        border: `1px solid ${color}`,
        borderRadius: 6,
        color,
        fontSize: 12,
        cursor: "pointer",
        marginRight: 6,
      }}
    >
      {label}
    </button>
  );
}

export function FormField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label style={labelSt}>{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle} />
    </div>
  );
}

export function Section2({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h3
        style={{
          margin: "0 0 10px",
          fontSize: 12,
          color: "#94a3b8",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}
