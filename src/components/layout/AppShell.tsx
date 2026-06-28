"use client";
// src/components/layout/AppShell.tsx

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "⚡" },
  { href: "/pipeline", label: "Pipeline", icon: "🔭" },
  { href: "/tracker", label: "Tracker", icon: "📋" },
  { href: "/salary", label: "Salary", icon: "💼" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Overview", icon: "📊" },
  { href: "/admin/users", label: "Users", icon: "👥" },
  { href: "/admin/companies", label: "Companies", icon: "🏢" },
  { href: "/admin/defaults", label: "Defaults", icon: "🎛️" },
  { href: "/admin/submissions", label: "Submissions", icon: "📬" },
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
    router.push("/");
  }

  return (
    <div className="flex min-h-screen bg-[#08080f] font-sans text-slate-200">
      {/* Sidebar */}
      <aside className="flex w-[220px] shrink-0 flex-col border-r border-[#1e1e30] bg-[#0d0d1a] py-6">
        {/* Logo */}
        <div className="mb-4 border-b border-[#1e1e30] px-5 pb-6">
          <div className="flex items-center gap-2 text-lg font-bold tracking-tight text-indigo-400">
            <Image src="/icon-192.png" alt="" width={20} height={20} className="h-5 w-5" />
            Job Radar
          </div>
          <div className="mt-0.5 text-[11px] text-slate-600">Multi-tenant</div>
        </div>

        {/* Main nav */}
        <nav className="flex-1 px-3" aria-label="Main navigation">
          {NAV.map((item) => (
            <NavLink key={item.href} item={item} active={(pathname || "") === item.href} />
          ))}

          {isAdmin && (
            <>
              <div className="mx-2 mb-2 mt-5 text-[11px] uppercase tracking-wider text-slate-600">
                Admin
              </div>
              {ADMIN_NAV.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  active={
                    item.href === "/admin"
                      ? (pathname || "") === "/admin"
                      : (pathname || "").startsWith(item.href)
                  }
                />
              ))}
            </>
          )}
        </nav>

        {/* User footer */}
        <div className="border-t border-[#1e1e30] px-5 py-4">
          {userEmail && <div className="mb-2 truncate text-xs text-slate-500">{userEmail}</div>}
          <button
            onClick={handleSignOut}
            className="w-full rounded-md border border-[#1e1e30] bg-transparent py-1.5 text-center text-[13px] text-slate-400 cursor-pointer"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={`mb-0.5 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm no-underline transition-all duration-150 ${
        active ? "bg-indigo-500/10 font-semibold text-indigo-400" : "font-normal text-slate-400"
      }`}
    >
      <span className="text-base">{item.icon}</span>
      {item.label}
    </Link>
  );
}
