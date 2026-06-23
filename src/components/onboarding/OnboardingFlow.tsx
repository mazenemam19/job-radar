"use client";
// src/components/onboarding/OnboardingFlow.tsx

import { useState } from "react";
import { useRouter } from "next/navigation";

type Step = "gemini" | "customize" | "done";

export default function OnboardingFlow() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("gemini");
  const [apiKey, setApiKey] = useState("");
  const [keyError, setKeyError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function saveKeyAndContinue() {
    if (!apiKey.trim()) {
      setKeyError("A Gemini API key is required to use Job Radar.");
      return;
    }
    // Basic format check (Gemini keys start with "AIza")
    if (!apiKey.trim().startsWith("AIza")) {
      setKeyError('This doesn\'t look like a valid Gemini API key (should start with "AIza").');
      return;
    }

    setLoading(true);
    setKeyError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gemini_api_key: apiKey.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        setStep("customize");
      } else {
        setKeyError(data.error);
      }
    } catch {
      setKeyError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function skipCustomisation() {
    setLoading(true);
    // uses_defaults = true (already the DB default), just mark onboarding done
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uses_defaults: true, onboarding_complete: true }),
    });
    router.push("/dashboard");
  }

  async function goCustomise() {
    // Mark onboarding done, send to settings page to customise
    setLoading(true);
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uses_defaults: false, onboarding_complete: true }),
    });
    router.push("/settings");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#08080f] p-4 font-sans">
      <div className="w-full max-w-[520px] rounded-2xl border border-[#1e1e30] bg-[#0d0d1a] px-9 py-10">
        {/* Progress indicator */}
        <div className="mb-8 flex gap-1.5">
          {(["gemini", "customize"] as Step[]).map((s) => (
            <div
              key={s}
              className="h-[3px] flex-1 rounded-sm"
              style={{
                background:
                  step === s || (step === "customize" && s === "gemini") ? "#6366f1" : "#1e1e30",
              }}
            />
          ))}
        </div>

        {/* Logo */}
        <div className="mb-7 text-center">
          <div className="mb-2 text-4xl">🎯</div>
          <h1 className="text-[22px] font-bold text-[#e2e8f0]">Welcome to Job Radar</h1>
          <p className="mt-2 text-sm text-[#64748b]">Your personal AI-powered job feed</p>
        </div>

        {/* Step 1: Gemini Key */}
        {step === "gemini" && (
          <>
            <div className="mb-6 rounded-[10px] border border-[#1e1e30] bg-[#0a0a18] p-4">
              <p className="text-[13px] leading-relaxed text-[#94a3b8]">
                Job Radar uses your own <strong className="text-[#818cf8]">Gemini API key</strong>{" "}
                to filter jobs with your custom prompt. This keeps your filtering private and
                prevents shared rate limits.
              </p>
            </div>

            <label
              htmlFor="onboarding-gemini-key"
              className="mb-2 block text-[13px] text-[#94a3b8]"
            >
              Gemini API key <span className="text-[#ef4444]">*</span>
            </label>
            <input
              id="onboarding-gemini-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIza..."
              className="w-full rounded-lg border bg-[#0a0a18] px-3.5 py-3 text-sm text-[#e2e8f0]"
              style={{
                borderColor: keyError ? "#ef4444" : "#1e1e30",
                marginBottom: keyError ? 8 : 20,
              }}
            />
            {keyError && <p className="mb-4 text-xs text-[#f87171]">{keyError}</p>}

            <p className="mb-5 text-xs leading-normal text-[#475569]">
              Get a free API key at{" "}
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#818cf8]"
              >
                aistudio.google.com/apikey
              </a>
              . The key is stored encrypted in your profile — it never leaves our servers
              unencrypted, and is used only for your own filter and strategy generation.
            </p>

            <button
              onClick={saveKeyAndContinue}
              disabled={loading}
              className="w-full cursor-pointer rounded-lg border-0 bg-[#6366f1] py-[13px] text-[15px] font-semibold text-white disabled:cursor-not-allowed"
              style={{ opacity: loading ? 0.7 : 1 }}
            >
              {loading ? "Saving..." : "Continue →"}
            </button>
          </>
        )}

        {/* Step 2: Skip or Customise */}
        {step === "customize" && (
          <>
            <p className="mb-7 text-[15px] leading-relaxed text-[#94a3b8]">
              Your API key is saved. Now choose how you want your feed configured:
            </p>

            <div className="flex flex-col gap-3.5">
              <button
                onClick={skipCustomisation}
                disabled={loading}
                className="cursor-pointer rounded-[10px] border border-[#1e1e30] bg-[#0a0a18] px-6 py-5 text-left text-[#e2e8f0] disabled:cursor-not-allowed"
                style={{ opacity: loading ? 0.6 : 1 }}
              >
                <div className="mb-1 text-[15px] font-semibold">⚡ Use platform defaults</div>
                <div className="text-[13px] text-[#64748b]">
                  Immediately see jobs matched against the default Senior React/Next.js profile. You
                  can always customise later.
                </div>
              </button>

              <button
                onClick={goCustomise}
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
          </>
        )}
      </div>
    </div>
  );
}
