// src/app/v2/admin/layout.tsx
// Admin sub-layout — no extra wrapping needed; AppShell is already in v2/layout.tsx
// This file exists to make the route group clear and allow future admin-specific chrome.

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
