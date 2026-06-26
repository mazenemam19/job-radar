"use client";
// src/app/page.tsx
// Client wrapper for the landing page — handles auth state, OAuth redirect, and GSAP animations.
// Static content lives in LandingContent (Server Component).

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import LandingContent from "@/components/landing/LandingContent";

export default function LandingPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setIsLoggedIn(!!data.user);
    });
  }, []);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    if (code) {
      window.location.replace(`/auth/callback?code=${encodeURIComponent(code)}`);
    }
  }, []);

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(
      ([{ gsap }, { ScrollTrigger }]) => {
        gsap.registerPlugin(ScrollTrigger);

        if (heroRef.current) {
          gsap.fromTo(
            heroRef.current.querySelectorAll(".hero-element"),
            { y: 40, opacity: 0 },
            { y: 0, opacity: 1, stagger: 0.15, duration: 0.8, ease: "power3.out" },
          );
        }

        // Demo cards, feature cards, funnel nodes — gsap.querySelectorAll finds them
        // in the rendered DOM after hydration (class-based selectors).
        gsap.fromTo(
          ".demo-card",
          { y: 60, opacity: 0, rotateX: 8 },
          {
            y: 0,
            opacity: 1,
            rotateX: 0,
            stagger: 0.1,
            duration: 0.6,
            ease: "power2.out",
            scrollTrigger: { trigger: ".demo-card:first-of-type", start: "top 75%" },
          },
        );
        gsap.fromTo(
          ".feat-card",
          { y: 50, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            stagger: 0.08,
            duration: 0.5,
            ease: "power2.out",
            scrollTrigger: { trigger: ".feat-card:first-of-type", start: "top 70%" },
          },
        );
        gsap.fromTo(
          ".funnel-node",
          { scale: 0, opacity: 0 },
          {
            scale: 1,
            opacity: 1,
            stagger: 0.15,
            duration: 0.5,
            ease: "back.out(1.7)",
            scrollTrigger: { trigger: ".funnel-node:first-of-type", start: "top 70%" },
          },
        );
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
  }, [heroRef]);

  return (
    <main ref={heroRef}>
      <LandingContent isLoggedIn={isLoggedIn} />
    </main>
  );
}
