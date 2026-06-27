"use client";
// src/components/onboarding/OnboardingFlow.tsx
//
// Feature Request 2 (gemini-filter-audit.md): the Gemini key is optional
// now, which removes the only reason this was ever a 2-step flow (gate
// Step 2 behind a required Step 1). Single screen: key field (skippable)
// + the defaults-vs-customize choice, both saved in one PATCH call.

import { useState } from "react";

export default function OnboardingFlow() {
  const [apiKey, setApiKey] = useState("");
  const [keyError, setKeyError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function complete(useDefaults: boolean) {
    const trimmedKey = apiKey.trim();

    if (trimmedKey && !trimmedKey.startsWith("AIza")) {
      setKeyError(
        'This doesn\'t look like a valid Gemini API key (should start with "AIza"). Leave it blank to skip for now — you can add it later in Settings.',
      );
      return;
    }

    setKeyError(null);
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        uses_defaults: useDefaults,
        onboarding_complete: true,
      };
      if (trimmedKey) body.gemini_api_key = trimmedKey;

      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.ok) {
        setKeyError(data.error);
        setLoading(false);
        return;
      }
      // The (protected) layout is a Server Component that fetched `profile`
      // once and handed it down to OnboardingGuard. A client-side navigation
      // (router.push) to a sibling route under the same layout can reuse
      // that already-rendered layout — including the now-stale
      // onboarding_complete: false — via Next's Router Cache, even after a
      // router.refresh() call (refresh and push race independently, with no
      // guaranteed ordering). A full browser navigation always asks the
      // server for a brand new page load, so the layout re-runs
      // getUserProfile() and gets the freshly-saved value every time.
      window.location.href = useDefaults ? "/dashboard" : "/settings";
    } catch {
      setKeyError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#08080f] p-4 font-sans">
      <div className="w-full max-w-[520px] rounded-2xl border border-[#1e1e30] bg-[#0d0d1a] px-9 py-10">
        {/* Logo */}
        <div className="mb-7 text-center">
          <div className="mb-2 text-4xl">🎯</div>
          <h1 className="text-[22px] font-bold text-[#e2e8f0]">Welcome to Job Radar</h1>
          <p className="mt-2 text-sm text-[#64748b]">Your personal AI-powered job feed</p>
        </div>

        {/* Gemini key — optional */}
        <div className="mb-6 rounded-[10px] border border-[#1e1e30] bg-[#0a0a18] p-4">
          <p className="text-[13px] leading-relaxed text-[#94a3b8]">
            Add your own <strong className="text-[#818cf8]">Gemini API key</strong> to have jobs
            filtered with your custom prompt. Optional — without one, jobs are still shown using
            your settings filters, just clearly marked as not AI-reviewed. You can add or change
            this anytime in Settings.
          </p>
        </div>

        <label htmlFor="onboarding-gemini-key" className="mb-2 block text-[13px] text-[#94a3b8]">
          Gemini API key <span className="text-[#64748b]">(optional)</span>
        </label>
        <input
          id="onboarding-gemini-key"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="AIza... (leave blank to skip)"
          className="w-full rounded-lg border bg-[#0a0a18] px-3.5 py-3 text-sm text-[#e2e8f0]"
          style={{
            borderColor: keyError ? "#ef4444" : "#1e1e30",
            marginBottom: keyError ? 8 : 20,
          }}
        />
        {keyError && <p className="mb-4 text-xs text-[#f87171]">{keyError}</p>}

        <p className="mb-7 text-xs leading-normal text-[#475569]">
          Get a free API key at{" "}
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#818cf8]"
          >
            aistudio.google.com/apikey
          </a>
          . The key is stored encrypted in your profile — it never leaves our servers unencrypted,
          and is used only for your own filter and strategy generation.
        </p>

        {/* Defaults or customise — same screen */}
        <p className="mb-4 text-[15px] leading-relaxed text-[#94a3b8]">
          Now choose how you want your feed configured:
        </p>

        <div className="flex flex-col gap-3.5">
          <button
            onClick={() => complete(true)}
            disabled={loading}
            className="cursor-pointer rounded-[10px] border border-[#1e1e30] bg-[#0a0a18] px-6 py-5 text-left text-[#e2e8f0] disabled:cursor-not-allowed"
            style={{ opacity: loading ? 0.6 : 1 }}
          >
            <div className="mb-1 text-[15px] font-semibold">⚡ Use platform defaults</div>
            <div className="text-[13px] text-[#64748b]">
              Immediately see jobs matched against the default Senior React/Next.js profile. You can
              always customise later.
            </div>
          </button>

          <button
            onClick={() => complete(false)}
            disabled={loading}
            className="cursor-pointer rounded-[10px] border border-[#6366f1] bg-[#0f0f20] px-6 py-5 text-left text-[#e2e8f0] disabled:cursor-not-allowed"
            style={{ opacity: loading ? 0.6 : 1 }}
          >
            <div className="mb-1 text-[15px] font-semibold text-[#818cf8]">
              🎛️ Customise my profile
            </div>
            <div className="text-[13px] text-[#64748b]">
              Set your own skills, pipelines, seniority preferences, and Gemini filter prompt.
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
