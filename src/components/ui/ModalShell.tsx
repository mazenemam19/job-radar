"use client";
// src/components/ui/ModalShell.tsx
//
// Shared chrome for modal dialogs (TrackerModal, StrategyModal): overlay,
// panel, header row with title/subtitle/close button, and the focus-trap /
// Escape / focus-return behavior from useDialogA11y. Centralizes the
// role="dialog" / aria-modal / aria-labelledby wiring so it's correct in one
// place instead of two.

import type { ReactNode } from "react";
import { useDialogA11y } from "@/hooks/useDialogA11y";

interface Props {
  titleId: string;
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  /** Tailwind classes for panel sizing — defaults to a 480px-max compact modal. */
  panelClassName?: string;
}

export default function ModalShell({
  titleId,
  title,
  subtitle,
  onClose,
  children,
  panelClassName,
}: Props) {
  // ModalShell only ever mounts while its modal is open, so isOpen is always true here.
  const dialogRef = useDialogA11y(true, onClose);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className={`w-full rounded-xl border border-[#1e1e30] bg-[#0d0d1a] p-7 ${
          panelClassName ?? "max-w-[480px]"
        }`}
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 id={titleId} className="m-0 text-base font-semibold text-[#e2e8f0]">
              {title}
            </h2>
            {subtitle && <p className="mt-1 text-[13px] text-[#64748b]">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="cursor-pointer border-0 bg-transparent p-1 text-xl leading-none text-[#64748b] hover:text-[#94a3b8]"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
