"use client";

import { useState, useEffect } from "react";

interface UserEntry {
  id: string;
  username: string;
  email: string | null;
  name: string | null;
  role: string;
  createdAt: string;
}

export function AdminUsersSection() {
  const [users, setUsers] = useState<UserEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/users")
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load users");
        const data = await res.json();
        setUsers(data);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div
      className="rounded-2xl p-4 sm:p-6"
      style={{ backgroundColor: "var(--mn-card)", border: "1px solid var(--mn-border)" }}
    >
      <h2 className="text-lg font-bold mb-4">Users</h2>

      {loading && (
        <p className="text-sm py-4 text-center" style={{ color: "var(--mn-muted2)" }}>
          Loading users...
        </p>
      )}

      {error && (
        <p className="text-sm py-4 text-center text-red-500">{error}</p>
      )}

      {!loading && !error && users.length === 0 && (
        <p className="text-sm py-4 text-center" style={{ color: "var(--mn-muted2)" }}>
          No users found
        </p>
      )}

      {!loading && !error && users.length > 0 && (
        <div className="space-y-2">
          {users.map((user) => (
            <div
              key={user.id}
              className="py-3 px-3 rounded-xl flex items-center justify-between gap-3"
              style={{ backgroundColor: "var(--mn-bg)" }}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">
                    {user.username}
                  </span>
                  {user.role === "admin" && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 flex-shrink-0">
                      Admin
                    </span>
                  )}
                </div>
                {(user.name || user.email) && (
                  <p className="text-xs mt-0.5" style={{ color: "var(--mn-muted2)" }}>
                    {user.name}{user.name && user.email ? " · " : ""}{user.email}
                  </p>
                )}
              </div>
              <span
                className="text-xs flex-shrink-0"
                style={{ color: "var(--mn-muted2)" }}
              >
                {user.createdAt.slice(0, 10)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
