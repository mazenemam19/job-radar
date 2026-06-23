"use client";
// src/components/admin/AdminComponents/UsersTable.tsx

import { useState, useEffect } from "react";
import type { AdminUserListItem } from "@/lib/types";
import { ActionBtn, thStyle, tdStyle } from "./_shared";

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

  if (loading) return <div style={{ padding: 32, color: "#64748b" }}>Loading users...</div>;

  return (
    <div style={{ padding: 32 }}>
      <h1 style={{ margin: "0 0 24px", fontSize: 22, color: "#e2e8f0", fontWeight: 700 }}>
        Users ({users.length})
      </h1>
      <div
        style={{
          background: "#0d0d1a",
          border: "1px solid #1e1e30",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Email", "Role", "Active", "Onboarded", "Profile", "Last active", "Actions"].map(
                (h) => (
                  <th key={h} style={thStyle}>
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td style={tdStyle}>{u.email}</td>
                <td style={tdStyle}>
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: 12,
                      fontSize: 11,
                      background: u.role === "admin" ? "#6366f120" : "#1e1e30",
                      color: u.role === "admin" ? "#818cf8" : "#64748b",
                    }}
                  >
                    {u.role}
                  </span>
                </td>
                <td style={tdStyle}>
                  <span style={{ color: u.is_active ? "#4ade80" : "#ef4444" }}>
                    {u.is_active ? "✓" : "✗"}
                  </span>
                </td>
                <td style={tdStyle}>
                  <span style={{ color: u.onboarding_complete ? "#4ade80" : "#64748b" }}>
                    {u.onboarding_complete ? "✓" : "—"}
                  </span>
                </td>
                <td style={tdStyle}>
                  {u.user_settings?.[0]?.uses_defaults ? (
                    <span style={{ color: "#64748b", fontSize: 11 }}>Default</span>
                  ) : (
                    <span style={{ color: "#818cf8", fontSize: 11 }}>Custom</span>
                  )}
                </td>
                <td style={{ ...tdStyle, fontSize: 11, color: "#64748b" }}>
                  {u.last_active_at ? new Date(u.last_active_at).toLocaleDateString() : "—"}
                </td>
                <td style={tdStyle}>
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
