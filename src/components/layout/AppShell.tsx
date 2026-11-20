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
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-[#08080f] font-sans text-slate-200 md:flex-row">
      <MobileNavigation
        isAdmin={isAdmin}
        pathname={pathname}
        userEmail={userEmail}
        onSignOut={handleSignOut}
      />

      {/* Desktop sidebar */}
      <aside className="hidden w-[220px] shrink-0 flex-col border-r border-[#1e1e30] bg-[#0d0d1a] py-6 md:flex">
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
      <main className="min-w-0 flex-1 overflow-x-auto">{children}</main>
    </div>
  );
}

function MobileNavigation({
  isAdmin,
  pathname,
  userEmail,
  onSignOut,
}: {
  isAdmin?: boolean;
  pathname: string | null;
  userEmail?: string;
  onSignOut: () => void;
}) {
  const navItems = isAdmin ? [...NAV, ...ADMIN_NAV] : NAV;

  return (
    <header className="sticky top-0 z-30 border-b border-[#1e1e30] bg-[#0d0d1a]/95 backdrop-blur md:hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 text-base font-bold tracking-tight text-indigo-400">
          <Image src="/icon-192.png" alt="" width={20} height={20} className="h-5 w-5 shrink-0" />
          <span>Job Radar</span>
          {userEmail && (
            <span className="truncate text-[11px] font-normal text-slate-500">{userEmail}</span>
          )}
        </div>
        <button
          onClick={onSignOut}
          className="shrink-0 rounded-md border border-[#1e1e30] px-2.5 py-1.5 text-xs text-slate-400 cursor-pointer"
        >
          Sign out
        </button>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-2 pb-2" aria-label="Mobile navigation">
        {navItems.map((item) => (
          <MobileNavLink
            key={item.href}
            item={item}
            active={
              item.href === "/admin"
                ? pathname === "/admin"
                : item.href.startsWith("/admin/")
                  ? Boolean(pathname?.startsWith(item.href))
                  : pathname === item.href
            }
          />
        ))}
      </nav>
    </header>
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

function MobileNavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={`flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs no-underline transition-colors ${
        active ? "bg-indigo-500/15 font-semibold text-indigo-300" : "text-slate-400"
      }`}
    >
      <span aria-hidden="true">{item.icon}</span>
      {item.label}
    </Link>
  );
}
