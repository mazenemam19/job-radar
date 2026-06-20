"use client";
// src/components/v2/onboarding/OnboardingFlow.tsx

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
      setKeyError("A Gemini API key is required to use Job Radar v2.");
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
      const res = await fetch("/api/v2/settings", {
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
    await fetch("/api/v2/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uses_defaults: true, onboarding_complete: true }),
    });
    router.push("/v2/dashboard");
  }

  async function goCustomise() {
    // Mark onboarding done, send to settings page to customise
    setLoading(true);
    await fetch("/api/v2/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uses_defaults: false, onboarding_complete: true }),
    });
    router.push("/v2/settings");
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#08080f",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Inter, system-ui, sans-serif",
        padding: 16,
      }}
    >
      <div
        style={{
          maxWidth: 520,
          width: "100%",
          background: "#0d0d1a",
          border: "1px solid #1e1e30",
          borderRadius: 16,
          padding: "40px 36px",
        }}
      >
        {/* Progress indicator */}
        <div style={{ display: "flex", gap: 6, marginBottom: 32 }}>
          {(["gemini", "customize"] as Step[]).map((s) => (
            <div
              key={s}
              style={{
                height: 3,
                flex: 1,
                borderRadius: 2,
                background:
                  step === s || (step === "customize" && s === "gemini") ? "#6366f1" : "#1e1e30",
              }}
            />
          ))}
        </div>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🎯</div>
          <h1 style={{ margin: 0, fontSize: 22, color: "#e2e8f0", fontWeight: 700 }}>
            Welcome to Job Radar v2
          </h1>
          <p style={{ margin: "8px 0 0", color: "#64748b", fontSize: 14 }}>
            Your personal AI-powered job feed
          </p>
        </div>

        {/* Step 1: Gemini Key */}
        {step === "gemini" && (
          <>
            <div
              style={{
                padding: 16,
                background: "#0a0a18",
                border: "1px solid #1e1e30",
                borderRadius: 10,
                marginBottom: 24,
              }}
            >
              <p style={{ margin: 0, fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>
                Job Radar uses your own <strong style={{ color: "#818cf8" }}>Gemini API key</strong>{" "}
                to filter jobs with your custom prompt. This keeps your filtering private and
                prevents shared rate limits.
              </p>
            </div>

            <label style={{ display: "block", fontSize: 13, color: "#94a3b8", marginBottom: 8 }}>
              Gemini API key <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIza..."
              style={{
                width: "100%",
                padding: "12px 14px",
                background: "#0a0a18",
                border: `1px solid ${keyError ? "#ef4444" : "#1e1e30"}`,
                borderRadius: 8,
                color: "#e2e8f0",
                fontSize: 14,
                marginBottom: keyError ? 8 : 20,
                boxSizing: "border-box",
              }}
            />
            {keyError && (
              <p style={{ color: "#f87171", fontSize: 12, margin: "0 0 16px" }}>{keyError}</p>
            )}

            <p style={{ fontSize: 12, color: "#475569", margin: "0 0 20px", lineHeight: 1.5 }}>
              Get a free API key at{" "}
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#818cf8" }}
              >
                aistudio.google.com/apikey
              </a>
              . The key is stored encrypted in your profile — it never leaves our servers
              unencrypted, and is used only for your own filter and strategy generation.
            </p>

            <button
              onClick={saveKeyAndContinue}
              disabled={loading}
              style={{
                width: "100%",
                padding: "13px 0",
                background: "#6366f1",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontSize: 15,
                fontWeight: 600,
                cursor: "pointer",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Saving..." : "Continue →"}
            </button>
          </>
        )}

        {/* Step 2: Skip or Customise */}
        {step === "customize" && (
          <>
            <p style={{ fontSize: 15, color: "#94a3b8", marginBottom: 28, lineHeight: 1.6 }}>
              Your API key is saved. Now choose how you want your feed configured:
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <button
                onClick={skipCustomisation}
                disabled={loading}
                style={{
                  padding: "20px 24px",
                  background: "#0a0a18",
                  border: "1px solid #1e1e30",
                  borderRadius: 10,
                  color: "#e2e8f0",
                  textAlign: "left",
                  cursor: "pointer",
                  opacity: loading ? 0.6 : 1,
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
                  ⚡ Use platform defaults
                </div>
                <div style={{ fontSize: 13, color: "#64748b" }}>
                  Immediately see jobs matched against the default Senior React/Next.js profile. You
                  can always customise later.
                </div>
              </button>

              <button
                onClick={goCustomise}
                disabled={loading}
                style={{
                  padding: "20px 24px",
                  background: "#0f0f20",
                  border: "1px solid #6366f1",
                  borderRadius: 10,
                  color: "#e2e8f0",
                  textAlign: "left",
                  cursor: "pointer",
                  opacity: loading ? 0.6 : 1,
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, color: "#818cf8" }}>
                  🎛️ Customise my profile
                </div>
                <div style={{ fontSize: 13, color: "#64748b" }}>
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
