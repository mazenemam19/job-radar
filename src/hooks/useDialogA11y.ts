"use client";
// src/hooks/useDialogA11y.ts
//
// Shared keyboard/focus behavior for modal dialogs (StrategyModal, TrackerModal):
// traps Tab focus inside the dialog while open, closes on Escape, moves focus
// into the dialog on open, and returns focus to whatever triggered it on close.

import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR =
  'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function useDialogA11y(isOpen: boolean, onClose: () => void) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  // Track the latest onClose via a ref instead of an effect dependency.
  // Callers often pass an inline closure that captures local state (e.g. a
  // confirm-text input inside the dialog itself), which gets a new identity
  // on every keystroke. If onClose were a dependency, every keystroke would
  // re-run this effect and re-focus the dialog's first focusable element —
  // which visibly steals focus away from whatever the user is typing into.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    triggerRef.current = document.activeElement as HTMLElement | null;

    const dialog = dialogRef.current;
    const initialFocusable = dialog?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    initialFocusable?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }

      if (e.key !== "Tab" || !dialog) return;

      const focusables = Array.from(
        dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => !el.hasAttribute("disabled"));
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      triggerRef.current?.focus();
    };
  }, [isOpen]);

  return dialogRef;
}
