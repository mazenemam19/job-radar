"use client";
// src/components/dashboard/ScoreBar.tsx

export default function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div
        style={{
          flex: 1,
          height: 4,
          background: "#1e1e30",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${value}%`,
            height: "100%",
            background: color,
            borderRadius: 2,
            transition: "width 0.3s ease",
          }}
        />
      </div>
      <span style={{ fontSize: 11, color: "#64748b", minWidth: 28, textAlign: "right" }}>
        {value}%
      </span>
    </div>
  );
}
