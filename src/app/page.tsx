"use client";
// src/app/v2/page.tsx
// Milestone 3: Landing page for non-authenticated visitors.
// Antigravity design: glassmorphism cards, GSAP scroll animations, floating elements.
// Uses prefers-reduced-motion to disable animations for accessibility.
//
// GSAP and its ScrollTrigger plugin must be installed:
//   pnpm add gsap

import { useEffect, useRef } from "react";
import Link from "next/link";

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
    <div
      style={{
        background: "#08080f",
        color: "#e2e8f0",
        minHeight: "100vh",
        fontFamily: "Inter, system-ui, sans-serif",
        overflow: "hidden",
      }}
    >
      {/* Floating background blobs */}
      <div
        className="blob-1"
        style={{
          position: "fixed",
          top: "-20%",
          left: "-10%",
          width: 500,
          height: 500,
          borderRadius: "50%",
          background: "radial-gradient(circle, #6366f130 0%, transparent 70%)",
          pointerEvents: "none",
          willChange: "transform",
          zIndex: 0,
        }}
      />
      <div
        className="blob-2"
        style={{
          position: "fixed",
          bottom: "-15%",
          right: "-5%",
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: "radial-gradient(circle, #818cf820 0%, transparent 70%)",
          pointerEvents: "none",
          willChange: "transform",
          zIndex: 0,
        }}
      />

      {/* Nav */}
      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          background: "rgba(8,8,15,0.8)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          padding: "0 32px",
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 700, color: "#818cf8" }}>🎯 Job Radar</div>
        <Link
          href="/login"
          style={{
            padding: "9px 20px",
            background: "#6366f1",
            color: "#fff",
            borderRadius: 8,
            textDecoration: "none",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Sign in with Google →
        </Link>
      </nav>

      {/* Hero */}
      <section
        ref={heroRef}
        style={{
          position: "relative",
          zIndex: 1,
          padding: "100px 32px 80px",
          textAlign: "center",
          maxWidth: 760,
          margin: "0 auto",
        }}
      >
        <div
          className="hero-element"
          style={{
            display: "inline-block",
            padding: "4px 16px",
            borderRadius: 20,
            background: "#6366f115",
            border: "1px solid #6366f140",
            color: "#818cf8",
            fontSize: 13,
            fontWeight: 500,
            marginBottom: 24,
          }}
        >
          Multi-tenant · Per-user AI · Fully configurable
        </div>

        <h1
          className="hero-element"
          style={{
            margin: "0 0 20px",
            fontSize: "clamp(36px, 6vw, 60px)",
            fontWeight: 800,
            lineHeight: 1.15,
            color: "#f1f5f9",
            letterSpacing: "-0.03em",
          }}
        >
          Your personalised
          <br />
          <span
            style={{
              background: "linear-gradient(135deg, #6366f1, #a78bfa)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            AI job feed
          </span>
        </h1>

        <p
          className="hero-element"
          style={{
            margin: "0 auto 36px",
            maxWidth: 520,
            fontSize: 18,
            color: "#94a3b8",
            lineHeight: 1.6,
          }}
        >
          Scrapes 800+ companies across Greenhouse, Lever, Ashby and 6 other ATS platforms. Filters
          with your own Gemini prompt. Scores by your skill list. Updates twice daily.
        </p>

        <div
          className="hero-element"
          style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}
        >
          <Link
            href="/login"
            style={{
              padding: "14px 32px",
              background: "#6366f1",
              color: "#fff",
              borderRadius: 10,
              textDecoration: "none",
              fontSize: 16,
              fontWeight: 700,
              boxShadow: "0 0 40px #6366f140",
              transition: "transform 0.2s ease",
            }}
          >
            Get started free →
          </Link>
          <Link
            href="/submit"
            style={{
              padding: "14px 32px",
              background: "rgba(255,255,255,0.04)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#94a3b8",
              borderRadius: 10,
              textDecoration: "none",
              fontSize: 16,
            }}
          >
            🏢 Submit your company
          </Link>
        </div>
      </section>

      {/* Demo job cards */}
      <section
        ref={demoRef}
        style={{
          position: "relative",
          zIndex: 1,
          padding: "0 32px 80px",
          maxWidth: 800,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            textAlign: "center",
            marginBottom: 28,
            fontSize: 12,
            color: "#475569",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}
        >
          Sample from today&apos;s feed
        </div>

        <div style={{ perspective: 1000 }}>
          {DEMO_JOBS.map((job, i) => (
            <div
              key={i}
              className="demo-card"
              style={{
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                background: "rgba(13,13,26,0.7)",
                border: `1px solid rgba(255,255,255,0.06)`,
                borderLeft: `3px solid ${MODE_COLOR[job.mode]}`,
                borderRadius: 12,
                padding: "16px 20px",
                marginBottom: 12,
                willChange: "transform",
                boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
              }}
            >
              <div
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
              >
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0" }}>{job.title}</div>
                  <div style={{ fontSize: 13, color: "#64748b", marginTop: 3 }}>
                    {job.company} · {job.flag} · {MODE_LABEL[job.mode]}
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                    {job.skills.map((s) => (
                      <span
                        key={s}
                        style={{
                          padding: "2px 8px",
                          borderRadius: 20,
                          background: "rgba(99,102,241,0.1)",
                          color: "#818cf8",
                          fontSize: 11,
                        }}
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: "50%",
                    flexShrink: 0,
                    background: `conic-gradient(${MODE_COLOR[job.mode]} ${job.score * 3.6}deg, #1e1e30 0deg)`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      background: "#0d0d1a",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#e2e8f0",
                    }}
                  >
                    {job.score}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: "center", marginTop: 8, fontSize: 12, color: "#475569" }}>
          Sign in to see real matches filtered for your own skills and preferences
        </div>
      </section>

      {/* Pipeline funnel demo */}
      <section
        ref={funnelRef}
        style={{
          position: "relative",
          zIndex: 1,
          padding: "60px 32px",
          background: "rgba(13,13,26,0.6)",
          backdropFilter: "blur(12px)",
          borderTop: "1px solid rgba(255,255,255,0.04)",
          borderBottom: "1px solid rgba(255,255,255,0.04)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: "#475569",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            marginBottom: 8,
          }}
        >
          Pipeline transparency
        </div>
        <h2
          style={{
            margin: "0 0 40px",
            fontSize: "clamp(20px, 3vw, 28px)",
            color: "#e2e8f0",
            fontWeight: 700,
          }}
        >
          See exactly what happened to every job
        </h2>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexWrap: "wrap",
            gap: 0,
          }}
        >
          {PIPELINE_STAGES.map((stage, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center" }}>
              {i > 0 && <div style={{ color: "#475569", fontSize: 24, padding: "0 8px" }}>→</div>}
              <div
                className="funnel-node"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  padding: "20px 16px",
                  backdropFilter: "blur(8px)",
                  background: "rgba(13,13,26,0.8)",
                  border: `1px solid ${stage.color}30`,
                  borderRadius: 16,
                  minWidth: 110,
                  willChange: "transform",
                }}
              >
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: "50%",
                    border: `2px solid ${stage.color}`,
                    background: `${stage.color}10`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 22,
                    fontWeight: 800,
                    color: stage.color,
                  }}
                >
                  {stage.label}
                </div>
                <div
                  style={{
                    marginTop: 10,
                    fontSize: 11,
                    color: "#64748b",
                    textAlign: "center",
                    whiteSpace: "pre-line",
                    lineHeight: 1.3,
                  }}
                >
                  {stage.sub}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Feature grid */}
      <section
        ref={featRef}
        style={{
          position: "relative",
          zIndex: 1,
          padding: "80px 32px",
          maxWidth: 960,
          margin: "0 auto",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h2
            style={{
              margin: 0,
              fontSize: "clamp(22px, 3vw, 32px)",
              color: "#e2e8f0",
              fontWeight: 700,
            }}
          >
            Everything you need. Nothing you don&apos;t.
          </h2>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 20,
          }}
        >
          {FEATURES.map((f, i) => (
            <div
              key={i}
              className="feat-card"
              style={{
                backdropFilter: "blur(12px)",
                background: "rgba(13,13,26,0.6)",
                border: "1px solid rgba(255,255,255,0.05)",
                borderRadius: 14,
                padding: 24,
                willChange: "transform",
                boxShadow: "0 2px 16px rgba(0,0,0,0.3)",
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 12 }}>{f.icon}</div>
              <h3 style={{ margin: "0 0 8px", fontSize: 16, color: "#e2e8f0", fontWeight: 600 }}>
                {f.title}
              </h3>
              <p style={{ margin: 0, fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section
        style={{
          position: "relative",
          zIndex: 1,
          padding: "80px 32px",
          textAlign: "center",
          background: "linear-gradient(to bottom, transparent, rgba(99,102,241,0.08))",
        }}
      >
        <h2
          style={{
            margin: "0 0 16px",
            fontSize: "clamp(24px, 4vw, 36px)",
            color: "#e2e8f0",
            fontWeight: 800,
          }}
        >
          Ready to find your next role?
        </h2>
        <p style={{ margin: "0 auto 32px", maxWidth: 480, fontSize: 16, color: "#64748b" }}>
          Sign in with Google, add your Gemini API key, and your personalised feed is ready in 30
          seconds.
        </p>
        <Link
          href="/login"
          style={{
            display: "inline-block",
            padding: "16px 40px",
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            color: "#fff",
            borderRadius: 12,
            textDecoration: "none",
            fontSize: 17,
            fontWeight: 700,
            boxShadow: "0 0 60px #6366f150",
          }}
        >
          Sign in with Google — it&apos;s free →
        </Link>
      </section>

      {/* Footer */}
      <footer
        style={{
          position: "relative",
          zIndex: 1,
          padding: "24px 32px",
          textAlign: "center",
          borderTop: "1px solid rgba(255,255,255,0.04)",
          fontSize: 12,
          color: "#475569",
        }}
      >
        Job Radar v2 · Built on Next.js, Supabase, Google Gemini · No ads, no data selling ·{" "}
        <Link href="/submit" style={{ color: "#64748b", textDecoration: "none" }}>
          Submit your company
        </Link>
      </footer>
    </div>
  );
}
