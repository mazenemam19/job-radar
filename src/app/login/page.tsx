"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
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
    <div className="flex min-h-screen items-center justify-center bg-[#08080f] p-4 font-sans">
      <div className="w-full max-w-[400px] rounded-2xl border border-[#1e1e30] bg-[#0d0d1a] px-9 py-10 text-center">
        <Link
          href="/"
          className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-slate-500 no-underline"
        >
          ← Back
        </Link>
        <Image
          src="/icon-192.png"
          alt=""
          width={40}
          height={40}
          className="mb-3 inline-block h-10 w-10"
          priority
        />
        <h1 className="m-0 mb-1.5 text-[22px] font-bold text-slate-200">Job Radar</h1>
        <p className="m-0 mb-8 text-sm leading-relaxed text-slate-500">
          AI-powered job feed personalised to your skills and preferences
        </p>

        {errorMessage && (
          <div
            role="alert"
            className="mb-5 rounded-lg border border-red-800 bg-[#2a0d0d] px-3.5 py-2.5 text-[13px] text-red-400"
          >
            {errorMessage}
          </div>
        )}

        <button
          onClick={signInWithGoogle}
          className="flex w-full items-center justify-center gap-3 rounded-[10px] border-none bg-white py-3.5 text-[15px] font-semibold text-[#1a1a2e] cursor-pointer"
        >
          <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
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

        <p className="m-0 mt-6 text-[11px] leading-relaxed text-slate-600">
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
        <div className="flex min-h-screen items-center justify-center bg-[#08080f] font-sans text-slate-500">
          Loading...
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
