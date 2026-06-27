// src/app/(protected)/OnboardingGuard.tsx
"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import type { UserProfile } from "@/lib/types";

interface OnboardingGuardProps {
  profile: UserProfile | null;
  children: React.ReactNode;
}

/**
 * Client-side onboarding gate.
 * Redirects to /onboarding if the user hasn't completed onboarding yet.
 * Allows /onboarding itself to pass through.
 */
export default function OnboardingGuard({ profile, children }: OnboardingGuardProps) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (
      profile &&
      !profile.onboarding_complete &&
      pathname &&
      !pathname.startsWith("/onboarding")
    ) {
      router.replace("/onboarding");
    }
  }, [profile, pathname, router]);

  // While the check runs, render children (avoids flash)
  return <>{children}</>;
}
