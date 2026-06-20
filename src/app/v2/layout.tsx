// src/app/v2/layout.tsx
// Root layout for all /v2/* pages.
// This is intentionally a simple pass-through with NO auth checks.
//
// Auth guarding is handled by src/app/v2/(protected)/layout.tsx
// which only wraps the protected sub-routes (dashboard, pipeline, tracker,
// salary, settings, admin). Public pages like /v2/login and /v2/onboarding
// are intentionally NOT inside (protected) to avoid redirect loops.

export default function V2RootLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
