// src/components/landing/LandingContent.tsx
// Server Component — static landing page content (no client-side JS needed)

import Image from "next/image";
import Link from "next/link";
import DemoJobCards from "./DemoJobCards";
import PipelineFunnel from "./PipelineFunnel";
import FeatureGrid from "./FeatureGrid";

interface LandingContentProps {
  isLoggedIn: boolean;
}

export default function LandingContent({ isLoggedIn }: LandingContentProps) {
  return (
    <div className="min-h-screen overflow-hidden bg-[#08080f] font-sans text-slate-200">
      {/* Floating background blobs */}
      <div
        className="blob-1 pointer-events-none fixed -left-[10%] -top-[20%] z-0 h-[500px] w-[500px] rounded-full"
        style={{
          background: "radial-gradient(circle, #6366f130 0%, transparent 70%)",
          willChange: "transform",
        }}
      />
      <div
        className="blob-2 pointer-events-none fixed -right-[5%] -bottom-[15%] z-0 h-[400px] w-[400px] rounded-full"
        style={{
          background: "radial-gradient(circle, #818cf820 0%, transparent 70%)",
          willChange: "transform",
        }}
      />

      {/* Nav */}
      <nav className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-white/[0.06] bg-[#08080f]/80 px-8 backdrop-blur-xl">
        <div className="flex items-center gap-2 text-lg font-bold text-indigo-400">
          <Image src="/icon-192.png" alt="" width={20} height={20} className="h-5 w-5" />
          Job Radar
        </div>
        <Link
          href={isLoggedIn ? "/dashboard" : "/login"}
          className="rounded-lg bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white no-underline"
        >
          {isLoggedIn ? "Dashboard →" : "Sign in with Google →"}
        </Link>
      </nav>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-[760px] px-8 pb-20 pt-24 text-center">
        <div className="mb-6 inline-block rounded-full border border-indigo-500/25 bg-indigo-500/[0.08] px-4 py-1 text-[13px] font-medium text-indigo-400">
          Multi-tenant · Per-user AI · Fully configurable
        </div>

        <h1
          className="m-0 mb-5 font-extrabold leading-[1.15] text-slate-100"
          style={{ fontSize: "clamp(36px, 6vw, 60px)", letterSpacing: "-0.03em" }}
        >
          Your personalised
          <br />
          <span className="bg-gradient-to-br from-indigo-500 to-violet-400 bg-clip-text text-transparent">
            AI job feed
          </span>
        </h1>

        <p className="mx-auto mb-9 max-w-[520px] text-lg leading-relaxed text-slate-400">
          Scrapes 800+ companies across Greenhouse, Lever, Ashby and 6 other ATS platforms. Filters
          with your own Gemini prompt. Scores by your skill list. Updates twice daily.
        </p>

        <div className="flex flex-wrap justify-center gap-3.5">
          <Link
            href={isLoggedIn ? "/dashboard" : "/login"}
            className="rounded-[10px] bg-indigo-500 px-8 py-3.5 text-base font-bold text-white no-underline shadow-[0_0_40px_#6366f140] transition-transform duration-200"
          >
            {isLoggedIn ? "Go to dashboard →" : "Get started free →"}
          </Link>
          <Link
            href="/submit"
            className="rounded-[10px] border border-white/10 bg-white/[0.04] px-8 py-3.5 text-base text-slate-400 no-underline backdrop-blur-sm"
          >
            🏢 Submit your company
          </Link>
        </div>
      </section>

      <DemoJobCards />

      <PipelineFunnel />

      <FeatureGrid />

      {/* CTA */}
      <section className="relative z-10 bg-gradient-to-b from-transparent to-indigo-500/[0.08] px-8 py-20 text-center">
        <h2
          className="m-0 mb-4 font-extrabold text-slate-200"
          style={{ fontSize: "clamp(24px, 4vw, 36px)" }}
        >
          Ready to find your next role?
        </h2>
        <p className="mx-auto mb-8 max-w-[480px] text-base text-slate-500">
          {isLoggedIn
            ? "Your personalised feed is waiting — head to your dashboard."
            : "Sign in with Google, add your Gemini API key, and your personalised feed is ready in 30 seconds."}
        </p>
        <Link
          href={isLoggedIn ? "/dashboard" : "/login"}
          className="inline-block rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 px-10 py-4 text-[17px] font-bold text-white no-underline shadow-[0_0_60px_#6366f150]"
        >
          {isLoggedIn ? "Go to dashboard →" : "Sign in with Google — it's free →"}
        </Link>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.04] px-8 py-6 text-center text-xs text-slate-600">
        Job Radar · Built on Next.js, Supabase, Google Gemini · No ads, no data selling ·{" "}
        <Link href="/submit" className="text-slate-500 no-underline">
          Submit your company
        </Link>
      </footer>
    </div>
  );
}
