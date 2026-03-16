"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

export function DeleteAccountSection({ username }: { username: string }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmUsername, setConfirmUsername] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/user/delete-account", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete account");
      signOut({ callbackUrl: "/login" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete account");
      setDeleting(false);
    }
  };

  return (
    <div
      className="rounded-2xl p-4 sm:p-6"
      style={{ backgroundColor: "var(--mn-card)", border: "1px solid var(--mn-border)" }}
    >
      <h2 className="text-lg font-bold mb-2">Delete Account</h2>
      <p className="text-sm mb-4" style={{ color: "var(--mn-muted)" }}>
        Permanently delete your account and all associated data. This cannot be undone.
      </p>

      {error && (
        <p className="text-sm text-red-500 mb-3">{error}</p>
      )}

      {!showConfirm ? (
        <button
          onClick={() => setShowConfirm(true)}
          className="px-4 py-2 rounded-lg text-sm font-medium text-red-600 dark:text-red-400"
          style={{ border: "1px solid var(--mn-border)" }}
        >
          Delete My Account
        </button>
      ) : (
        <div className="space-y-3">
          <p className="text-sm" style={{ color: "var(--mn-muted)" }}>
            Type <strong>{username}</strong> to confirm:
          </p>
          <input
            type="text"
            value={confirmUsername}
            onChange={(e) => setConfirmUsername(e.target.value)}
            placeholder={username}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={{
              backgroundColor: "var(--mn-bg)",
              border: "1px solid var(--mn-border)",
              color: "var(--mn-fg)",
            }}
          />
          <div className="flex gap-2">
            <button
              onClick={handleDelete}
              disabled={confirmUsername !== username || deleting}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-500 disabled:opacity-40"
            >
              {deleting ? "Deleting..." : "Confirm Delete"}
            </button>
            <button
              onClick={() => {
                setShowConfirm(false);
                setConfirmUsername("");
                setError(null);
              }}
              className="px-4 py-2 rounded-lg text-sm font-medium"
              style={{ color: "var(--mn-muted)" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
