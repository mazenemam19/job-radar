// src/app/(protected)/layout.tsx
// Auth-guarded layout for all protected pages.
// This route group ((protected)) is used to isolate the auth check
// away from public pages like /login and /submit.
// URLs are NOT affected by the (protected) folder name.
//
// Middleware handles the unauthenticated redirect. This layout adds:
//   - Blocked user check (sign out + redirect)
//   - Onboarding gate (via OnboardingGuard client component)

import { redirect } from "next/navigation";
import { getUser, getUserProfile } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { UserProfile } from "@/lib/types";
import AppShell from "@/components/layout/AppShell";
import OnboardingGuard from "./OnboardingGuard";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();

  // Middleware handles redirects, but this is a server-side safety net
  if (!user) redirect("/login");

  const profile: UserProfile | null = await getUserProfile(user.id);

  // ── Blocked user ─────────────────────────────────────────────
  if (profile && !profile.is_active) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookies().getAll();
          },
          setAll() {
            // no-op: we're about to redirect anyway
          },
        },
      },
    );
    await supabase.auth.signOut();
    redirect("/login?error=blocked");
  }

  const isAdmin = profile?.role === "admin";
  const userEmail: string | undefined = profile?.email ?? user.email;

  return (
    <AppShell isAdmin={isAdmin} userEmail={userEmail}>
      <OnboardingGuard profile={profile}>{children}</OnboardingGuard>
    </AppShell>
  );
}
