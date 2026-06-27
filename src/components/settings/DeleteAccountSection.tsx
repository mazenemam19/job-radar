"use client";
// src/components/settings/DeleteAccountSection.tsx
//
// "Danger zone" on the settings page — lets a user permanently delete their
// own profile and everything linked to it (settings, salary reports, tracker
// entries, cached jobs). Requires typing DELETE to confirm, since this is
// irreversible.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ModalShell from "@/components/ui/ModalShell";

const CONFIRM_PHRASE = "DELETE";

export default function DeleteAccountSection() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    if (deleting) return; // don't allow closing mid-request
    setOpen(false);
    setConfirmText("");
    setError(null);
  }

  async function handleDelete() {
    setDeleting(true);
    setError(null);

    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      const json = await res.json();

      if (!json.ok) {
        setError(json.error || "Something went wrong. Please try again.");
        setDeleting(false);
        return;
      }

      // The account no longer exists server-side — clear the local session
      // too, then send them back to the landing page.
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/");
    } catch {
      setError("Network error. Please try again.");
      setDeleting(false);
    }
  }

  return (
    <div className="mb-7 rounded-lg border border-[#5b1717] bg-[#1a0a0a] p-5">
      <h3 className="mb-1.5 text-[13px] font-semibold uppercase tracking-wide text-[#f87171]">
        Danger zone
      </h3>
      <p className="mb-3.5 text-[13px] text-[#94a3b8]">
        Permanently delete your profile, settings, salary reports, and tracker history. This
        can&apos;t be undone.
      </p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="cursor-pointer rounded-lg border border-[#5b1717] bg-transparent px-4 py-2 text-[13px] font-semibold text-[#f87171] hover:bg-[#2a0e0e]"
      >
        Delete my account
      </button>

      {open && (
        <ModalShell
          titleId="delete-account-title"
          title="Delete your account?"
          subtitle="This permanently deletes your profile, settings, salary reports, and tracker history. This can't be undone."
          onClose={close}
        >
          <label htmlFor="delete-confirm" className="mb-1.5 block text-[13px] text-[#94a3b8]">
            Type <strong className="text-[#e2e8f0]">{CONFIRM_PHRASE}</strong> to confirm
          </label>
          <input
            id="delete-confirm"
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={CONFIRM_PHRASE}
            autoComplete="off"
            className="mb-3 w-full rounded-lg border border-[#1e1e30] bg-[#0a0a18] px-3 py-2.5 text-sm text-[#e2e8f0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ef4444]"
          />

          {error && <div className="mb-3 text-[13px] text-[#f87171]">{error}</div>}

          <div className="flex justify-end gap-2.5">
            <button
              type="button"
              onClick={close}
              disabled={deleting}
              className="cursor-pointer rounded-lg border border-[#1e1e30] bg-transparent px-4 py-2.5 text-sm text-[#94a3b8] disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting || confirmText !== CONFIRM_PHRASE}
              className="cursor-pointer rounded-lg border-0 bg-[#ef4444] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deleting ? "Deleting..." : "Permanently delete account"}
            </button>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
