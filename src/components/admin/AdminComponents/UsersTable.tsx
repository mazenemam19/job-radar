"use client";
// src/components/admin/AdminComponents/UsersTable.tsx

import { useState, useEffect } from "react";
import type { AdminUserListItem } from "@/lib/types";
import { ActionBtn, TH_CLASS, TD_CLASS } from "./_shared";

export function UsersTable() {
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/users");
      const d = await res.json();
      if (d.ok) setUsers(d.data);
      setLoading(false);
    })();
  }, []);

  async function toggleActive(user: AdminUserListItem) {
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !user.is_active }),
    });
    const d = await res.json();
    if (d.ok)
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, is_active: !u.is_active } : u)),
      );
  }

  if (loading) return <div className="p-8 text-[#64748b]">Loading users...</div>;

  return (
    <div className="p-8">
      <h1 className="mb-6 text-[22px] font-bold text-[#e2e8f0]">Users ({users.length})</h1>
      <div className="overflow-hidden rounded-xl border border-[#1e1e30] bg-[#0d0d1a]">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {["Email", "Role", "Active", "Onboarded", "Profile", "Last active", "Actions"].map(
                (h) => (
                  <th key={h} className={TH_CLASS}>
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className={TD_CLASS}>{u.email}</td>
                <td className={TD_CLASS}>
                  <span
                    className="rounded-xl px-2 py-0.5 text-[11px]"
                    style={{
                      background: u.role === "admin" ? "#6366f120" : "#1e1e30",
                      color: u.role === "admin" ? "#818cf8" : "#64748b",
                    }}
                  >
                    {u.role}
                  </span>
                </td>
                <td className={TD_CLASS}>
                  <span style={{ color: u.is_active ? "#4ade80" : "#ef4444" }}>
                    {u.is_active ? "✓" : "✗"}
                  </span>
                </td>
                <td className={TD_CLASS}>
                  <span style={{ color: u.onboarding_complete ? "#4ade80" : "#64748b" }}>
                    {u.onboarding_complete ? "✓" : "—"}
                  </span>
                </td>
                <td className={TD_CLASS}>
                  {u.user_settings?.[0]?.uses_defaults ? (
                    <span className="text-[11px] text-[#64748b]">Default</span>
                  ) : (
                    <span className="text-[11px] text-[#818cf8]">Custom</span>
                  )}
                </td>
                <td className={`${TD_CLASS} text-[11px] text-[#64748b]`}>
                  {u.last_active_at ? new Date(u.last_active_at).toLocaleDateString() : "—"}
                </td>
                <td className={TD_CLASS}>
                  <ActionBtn
                    onClick={() => toggleActive(u)}
                    label={u.is_active ? "Block" : "Activate"}
                    color={u.is_active ? "#ef4444" : "#22c55e"}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
