"use client";
// src/components/dashboard/ScoreBar.tsx

export default function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 overflow-hidden rounded-sm bg-[#1e1e30]">
        <div
          className="h-full rounded-sm transition-[width] duration-300 ease-in-out"
          style={{ width: `${value}%`, background: color }}
        />
      </div>
      <span className="min-w-[28px] text-right text-[11px] text-[#64748b]">{value}%</span>
    </div>
  );
}
