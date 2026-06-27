// src/app/(protected)/admin/layout.tsx
// Admin sub-layout — enforces admin role access.
// Non-admin users are redirected to /dashboard.

import { redirect } from "next/navigation";
import { getUser, getUserProfile } from "@/lib/supabase/server";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/login");

  const profile = await getUserProfile(user.id);
  if (!profile || profile.role !== "admin") {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
