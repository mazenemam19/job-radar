"use client";
// src/components/v2/layout/AppShell.tsx

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/v2/supabase/client";
import { useRouter } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

const NAV: NavItem[] = [
  { href: "/v2/dashboard", label: "Dashboard", icon: "⚡" },
  { href: "/v2/pipeline", label: "Pipeline", icon: "🔭" },
  { href: "/v2/tracker", label: "Tracker", icon: "📋" },
  { href: "/v2/salary", label: "Salary", icon: "💼" },
  { href: "/v2/settings", label: "Settings", icon: "⚙️" },
];

const ADMIN_NAV: NavItem[] = [
  { href: "/v2/admin/users", label: "Users", icon: "👥" },
  { href: "/v2/admin/companies", label: "Companies", icon: "🏢" },
  { href: "/v2/admin/defaults", label: "Defaults", icon: "🎛️" },
  { href: "/v2/admin/submissions", label: "Submissions", icon: "📬" },
];

interface Props {
  children: React.ReactNode;
  isAdmin?: boolean;
  userEmail?: string;
}

export default function AppShell({ children, isAdmin, userEmail }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/v2/login");
  }

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "#08080f",
        color: "#e2e8f0",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      {/* Sidebar */}
      <aside
        style={{
          width: 220,
          background: "#0d0d1a",
          borderRight: "1px solid #1e1e30",
          display: "flex",
          flexDirection: "column",
          padding: "24px 0",
          flexShrink: 0,
        }}
      >
        {/* Logo */}
        <div
          style={{ padding: "0 20px 24px", borderBottom: "1px solid #1e1e30", marginBottom: 16 }}
        >
          <div
            style={{ fontSize: 18, fontWeight: 700, color: "#818cf8", letterSpacing: "-0.02em" }}
          >
            🎯 Job Radar
          </div>
          <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>v2 · Multi-tenant</div>
        </div>

        {/* Main nav */}
        <nav style={{ flex: 1, padding: "0 12px" }}>
          {NAV.map((item) => (
            <NavLink key={item.href} item={item} active={(pathname || "") === item.href} />
          ))}

          {isAdmin && (
            <>
              <div
                style={{
                  margin: "20px 8px 8px",
                  fontSize: 11,
                  color: "#475569",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                Admin
              </div>
              {ADMIN_NAV.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  active={(pathname || "").startsWith(item.href)}
                />
              ))}
            </>
          )}
        </nav>

        {/* User footer */}
        <div style={{ padding: "16px 20px", borderTop: "1px solid #1e1e30" }}>
          {userEmail && (
            <div
              style={{
                fontSize: 12,
                color: "#64748b",
                marginBottom: 8,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {userEmail}
            </div>
          )}
          <button
            onClick={handleSignOut}
            style={{
              width: "100%",
              padding: "6px 0",
              background: "transparent",
              border: "1px solid #1e1e30",
              borderRadius: 6,
              color: "#94a3b8",
              fontSize: 13,
              cursor: "pointer",
              textAlign: "center",
            }}
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, overflow: "auto" }}>{children}</main>
    </div>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "9px 12px",
        borderRadius: 8,
        marginBottom: 2,
        fontSize: 14,
        fontWeight: active ? 600 : 400,
        color: active ? "#818cf8" : "#94a3b8",
        background: active ? "rgba(99,102,241,0.1)" : "transparent",
        textDecoration: "none",
        transition: "all 0.15s ease",
      }}
    >
      <span style={{ fontSize: 16 }}>{item.icon}</span>
      {item.label}
    </Link>
  );
}
