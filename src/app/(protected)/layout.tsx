// src/app/(protected)/layout.tsx
// Auth-guarded layout for all protected pages.
// This route group ((protected)) is used to isolate the auth check
// away from public pages like /login and /onboarding.
// URLs are NOT affected by the (protected) folder name.

import { redirect } from "next/navigation";
import { getUser, getUserProfile } from "@/lib/supabase/server";
import type { UserProfile } from "@/lib/types";
import AppShell from "@/components/layout/AppShell";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();

  // Middleware handles redirects, but this is a server-side safety net
  if (!user) redirect("/login");

  const profile: UserProfile | null = await getUserProfile(user.id);

  const isAdmin = profile?.role === "admin";
  // user.email is string | undefined; profile.email is guaranteed string from DB
  const userEmail: string | undefined = profile?.email ?? user.email;

  return (
    <AppShell isAdmin={isAdmin} userEmail={userEmail}>
      {children}
    </AppShell>
  );
}
