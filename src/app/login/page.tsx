"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const ERROR_MESSAGES: Record<string, string> = {
  no_code: "Authentication failed — no code received. Please try again.",
  auth_failed: "Sign-in failed. Please try again.",
  blocked: "Your account has been deactivated. Contact the administrator.",
};

function LoginContent() {
  const params = useSearchParams();

  // Safely extract params and avoid null-pointer or index type restrictions in TypeScript
  const errorParam = params ? params.get("error") : null;
  const nextParam = params ? params.get("next") : null;

  const errorMessage = errorParam ? ERROR_MESSAGES[errorParam] || errorParam : null;
  const nextRoute = nextParam ?? "/dashboard";

  async function signInWithGoogle() {
    try {
      const supabase = createClient();

      // Strict client-side check for the window object
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const callbackUrl = `${origin}/auth/callback?next=${encodeURIComponent(nextRoute)}`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callbackUrl,
          scopes: "email profile",
        },
      });

      if (error) throw error;
    } catch (err) {
      console.error("OAuth initialization failed:", err);
    }
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
          maxWidth: 400,
          width: "100%",
          background: "#0d0d1a",
          border: "1px solid #1e1e30",
          borderRadius: 16,
          padding: "40px 36px",
          textAlign: "center",
        }}
      >
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: "#64748b",
            fontSize: 13,
            textDecoration: "none",
            marginBottom: 20,
          }}
        >
          ← Back
        </Link>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🎯</div>
        <h1 style={{ margin: "0 0 6px", fontSize: 22, color: "#e2e8f0", fontWeight: 700 }}>
          Job Radar
        </h1>
        <p style={{ margin: "0 0 32px", color: "#64748b", fontSize: 14, lineHeight: 1.5 }}>
          AI-powered job feed personalised to your skills and preferences
        </p>

        {errorMessage && (
          <div
            style={{
              padding: "10px 14px",
              background: "#2a0d0d",
              border: "1px solid #991b1b",
              borderRadius: 8,
              color: "#f87171",
              fontSize: 13,
              marginBottom: 20,
            }}
          >
            {errorMessage}
          </div>
        )}

        <button
          onClick={signInWithGoogle}
          style={{
            width: "100%",
            padding: "13px 0",
            background: "#fff",
            color: "#1a1a2e",
            border: "none",
            borderRadius: 10,
            fontSize: 15,
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path
              fill="#FFC107"
              d="M43.6 20.1H42V20H24v8h11.3C33.6 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.4 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z"
            />
            <path
              fill="#FF3D00"
              d="M6.3 14.7l6.6 4.9C14.6 16.1 19 13 24 13c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.4 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
            />
            <path
              fill="#4CAF50"
              d="M24 44c5.2 0 9.9-1.9 13.5-5.1l-6.2-5.3C29.5 35.5 26.9 36 24 36c-5.2 0-9.6-3.3-11.3-8H6.1c3.4 6.5 10.1 11 17.9 11z"
            />
            <path
              fill="#1976D2"
              d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6.2 5.3C41.1 36.1 44 30.4 44 24c0-1.3-.1-2.6-.4-3.9z"
            />
          </svg>
          Continue with Google
        </button>

        <p style={{ margin: "24px 0 0", fontSize: 11, color: "#475569", lineHeight: 1.5 }}>
          By signing in you agree that this is a personal tool. No data is sold. Your Gemini API key
          is stored securely and used only for your own filtering.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            background: "#08080f",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#64748b",
            fontFamily: "Inter, system-ui, sans-serif",
          }}
        >
          Loading...
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
