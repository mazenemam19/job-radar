"use client";
// src/app/page.tsx
// Milestone 3: Landing page for non-authenticated visitors.
// Antigravity design: glassmorphism cards, GSAP scroll animations, floating elements.
// Uses prefers-reduced-motion to disable animations for accessibility.
//
// GSAP and its ScrollTrigger plugin must be installed:
//   pnpm add gsap

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

// Demo jobs for the read-only preview (fake, seeded data)
const DEMO_JOBS = [
  {
    title: "Senior Frontend Engineer",
    company: "Vercel",
    flag: "🇺🇸",
    score: 94,
    skills: ["React", "Next.js", "TypeScript"],
    mode: "global" as const,
  },
  {
    title: "React Developer",
    company: "N26",
    flag: "🇩🇪",
    score: 87,
    skills: ["React", "TypeScript", "CSS"],
    mode: "visa" as const,
  },
  {
    title: "Senior UI Engineer",
    company: "Spotify",
    flag: "🇸🇪",
    score: 82,
    skills: ["React", "Redux", "TypeScript"],
    mode: "visa" as const,
  },
  {
    title: "Frontend Lead",
    company: "Paymob",
    flag: "🇪🇬",
    score: 79,
    skills: ["React", "JavaScript", "Sass"],
    mode: "local" as const,
  },
];

const PIPELINE_STAGES = [
  { label: "847", sub: "fetched from\n95 companies", color: "#6366f1" },
  { label: "312", sub: "after\ndate filter", color: "#818cf8" },
  { label: "89", sub: "after your\nsettings", color: "#a78bfa" },
  { label: "23", sub: "after your\nGemini filter", color: "#c4b5fd" },
];

const FEATURES = [
  {
    icon: "🧠",
    title: "AI-powered filtering",
    desc: "Your own Gemini API key and custom prompt. Job radar passes all fetched jobs through your filter before you ever see them.",
  },
  {
    icon: "🎯",
    title: "Per-skill scoring",
    desc: "Expert skills (React, TypeScript) score 3×. Recency and relocation bonus combine into one weighted total. Fully configurable.",
  },
  {
    icon: "🔭",
    title: "Pipeline transparency",
    desc: "See exactly how many jobs were fetched, date-filtered, settings-filtered, and AI-filtered. Understand why your feed looks the way it does.",
  },
  {
    icon: "📋",
    title: "Application tracker",
    desc: "Track Applied → Interviewing → Offer or Ghosted. All with a job snapshot that persists even after jobs expire from the pool.",
  },
  {
    icon: "💼",
    title: "Salary crowdsourcing",
    desc: "Anonymous salary reports from the community. Aggregated by role, experience band, and pipeline. Helps everyone get paid fairly.",
  },
  {
    icon: "⚡",
    title: "Instant after first load",
    desc: "Gemini runs once after each cron run and the results are cached. All subsequent dashboard opens are instant.",
  },
];

const MODE_COLOR: Record<string, string> = { global: "#f59e0b", visa: "#6366f1", local: "#22c55e" };
const MODE_LABEL: Record<string, string> = {
  global: "🌐 Remote",
  visa: "✈️ Visa",
  local: "🇪🇬 Local",
};

export default function LandingPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const demoRef = useRef<HTMLDivElement>(null);
  const featRef = useRef<HTMLDivElement>(null);
  const funnelRef = useRef<HTMLDivElement>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setIsLoggedIn(!!data.user);
    });
  }, []);

  useEffect(() => {
    // Safety net: if an OAuth code lands here instead of /auth/callback (e.g.
    // because the redirect URL wasn't in Supabase's allowed Redirect URLs list),
    // forward it on manually rather than stranding the user on the landing page
    // with an unexchanged code in the URL.
    const code = new URLSearchParams(window.location.search).get("code");
    if (code) {
      window.location.replace(`/auth/callback?code=${encodeURIComponent(code)}`);
    }
  }, []);

  useEffect(() => {
    // Respect prefers-reduced-motion
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    // Dynamically import GSAP to avoid SSR issues
    Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(
      ([{ gsap }, { ScrollTrigger }]) => {
        gsap.registerPlugin(ScrollTrigger);

        // Hero entrance
        if (heroRef.current) {
          gsap.fromTo(
            heroRef.current.querySelectorAll(".hero-element"),
            { y: 40, opacity: 0 },
            { y: 0, opacity: 1, stagger: 0.15, duration: 0.8, ease: "power3.out" },
          );
        }

        // Demo cards — domino entrance from scroll
        if (demoRef.current) {
          gsap.fromTo(
            demoRef.current.querySelectorAll(".demo-card"),
            { y: 60, opacity: 0, rotateX: 8 },
            {
              y: 0,
              opacity: 1,
              rotateX: 0,
              stagger: 0.1,
              duration: 0.6,
              ease: "power2.out",
              scrollTrigger: { trigger: demoRef.current, start: "top 75%" },
            },
          );
        }

        // Feature cards — float in from scroll
        if (featRef.current) {
          gsap.fromTo(
            featRef.current.querySelectorAll(".feat-card"),
            { y: 50, opacity: 0 },
            {
              y: 0,
              opacity: 1,
              stagger: 0.08,
              duration: 0.5,
              ease: "power2.out",
              scrollTrigger: { trigger: featRef.current, start: "top 70%" },
            },
          );
        }

        // Funnel nodes — scale in from scroll
        if (funnelRef.current) {
          gsap.fromTo(
            funnelRef.current.querySelectorAll(".funnel-node"),
            { scale: 0, opacity: 0 },
            {
              scale: 1,
              opacity: 1,
              stagger: 0.15,
              duration: 0.5,
              ease: "back.out(1.7)",
              scrollTrigger: { trigger: funnelRef.current, start: "top 70%" },
            },
          );
        }

        // Floating background blobs (parallax)
        gsap.to(".blob-1", { y: -60, duration: 8, repeat: -1, yoyo: true, ease: "sine.inOut" });
        gsap.to(".blob-2", {
          y: 40,
          duration: 6,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
          delay: 2,
        });
      },
    );
  }, []);

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
        <div className="text-lg font-bold text-indigo-400">🎯 Job Radar</div>
        <Link
          href={isLoggedIn ? "/dashboard" : "/login"}
          className="rounded-lg bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white no-underline"
        >
          {isLoggedIn ? "Dashboard →" : "Sign in with Google →"}
        </Link>
      </nav>

      {/* Hero */}
      <section
        ref={heroRef}
        className="relative z-10 mx-auto max-w-[760px] px-8 pb-20 pt-24 text-center"
      >
        <div className="hero-element mb-6 inline-block rounded-full border border-indigo-500/25 bg-indigo-500/[0.08] px-4 py-1 text-[13px] font-medium text-indigo-400">
          Multi-tenant · Per-user AI · Fully configurable
        </div>

        <h1
          className="hero-element m-0 mb-5 font-extrabold leading-[1.15] text-slate-100"
          style={{ fontSize: "clamp(36px, 6vw, 60px)", letterSpacing: "-0.03em" }}
        >
          Your personalised
          <br />
          <span className="bg-gradient-to-br from-indigo-500 to-violet-400 bg-clip-text text-transparent">
            AI job feed
          </span>
        </h1>

        <p className="hero-element mx-auto mb-9 max-w-[520px] text-lg leading-relaxed text-slate-400">
          Scrapes 800+ companies across Greenhouse, Lever, Ashby and 6 other ATS platforms. Filters
          with your own Gemini prompt. Scores by your skill list. Updates twice daily.
        </p>

        <div className="hero-element flex flex-wrap justify-center gap-3.5">
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

      {/* Demo job cards */}
      <section ref={demoRef} className="relative z-10 mx-auto max-w-[800px] px-8 pb-20">
        <div className="mb-7 text-center text-xs uppercase tracking-widest text-slate-600">
          Sample from today&apos;s feed
        </div>

        <div style={{ perspective: 1000 }}>
          {DEMO_JOBS.map((job, i) => (
            <div
              key={i}
              className="demo-card mb-3 rounded-xl border border-white/[0.06] bg-[#0d0d1a]/70 px-5 py-4 shadow-[0_4px_24px_rgba(0,0,0,0.4)] backdrop-blur-xl"
              style={{ borderLeft: `3px solid ${MODE_COLOR[job.mode]}`, willChange: "transform" }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[15px] font-semibold text-slate-200">{job.title}</div>
                  <div className="mt-0.5 text-[13px] text-slate-500">
                    {job.company} · {job.flag} · {MODE_LABEL[job.mode]}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {job.skills.map((s) => (
                      <span
                        key={s}
                        className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[11px] text-indigo-400"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
                <div
                  className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full"
                  style={{
                    background: `conic-gradient(${MODE_COLOR[job.mode]} ${job.score * 3.6}deg, #1e1e30 0deg)`,
                  }}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0d0d1a] text-[13px] font-bold text-slate-200">
                    {job.score}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-2 text-center text-xs text-slate-600">
          Sign in to see real matches filtered for your own skills and preferences
        </div>
      </section>

      {/* Pipeline funnel demo */}
      <section
        ref={funnelRef}
        className="relative z-10 border-y border-white/[0.04] bg-[#0d0d1a]/60 px-8 py-16 text-center backdrop-blur-xl"
      >
        <div className="mb-2 text-xs uppercase tracking-widest text-slate-600">
          Pipeline transparency
        </div>
        <h2
          className="m-0 mb-10 font-bold text-slate-200"
          style={{ fontSize: "clamp(20px, 3vw, 28px)" }}
        >
          See exactly what happened to every job
        </h2>

        <div className="flex flex-wrap items-center justify-center gap-0">
          {PIPELINE_STAGES.map((stage, i) => (
            <div key={i} className="flex items-center">
              {i > 0 && <div className="px-2 text-2xl text-slate-600">→</div>}
              <div
                className="funnel-node flex min-w-[110px] flex-col items-center rounded-2xl bg-[#0d0d1a]/80 px-4 py-5 backdrop-blur-md"
                style={{ border: `1px solid ${stage.color}30`, willChange: "transform" }}
              >
                <div
                  className="flex h-[72px] w-[72px] items-center justify-center rounded-full text-[22px] font-extrabold"
                  style={{
                    border: `2px solid ${stage.color}`,
                    background: `${stage.color}10`,
                    color: stage.color,
                  }}
                >
                  {stage.label}
                </div>
                <div className="mt-2.5 whitespace-pre-line text-center text-[11px] leading-tight text-slate-500">
                  {stage.sub}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Feature grid */}
      <section ref={featRef} className="relative z-10 mx-auto max-w-[960px] px-8 py-20">
        <div className="mb-12 text-center">
          <h2
            className="m-0 font-bold text-slate-200"
            style={{ fontSize: "clamp(22px, 3vw, 32px)" }}
          >
            Everything you need. Nothing you don&apos;t.
          </h2>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-5">
          {FEATURES.map((f, i) => (
            <div
              key={i}
              className="feat-card rounded-2xl border border-white/5 bg-[#0d0d1a]/60 p-6 shadow-[0_2px_16px_rgba(0,0,0,0.3)] backdrop-blur-xl"
              style={{ willChange: "transform" }}
            >
              <div className="mb-3 text-[28px]">{f.icon}</div>
              <h3 className="m-0 mb-2 text-base font-semibold text-slate-200">{f.title}</h3>
              <p className="m-0 text-[13px] leading-relaxed text-slate-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

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
