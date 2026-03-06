"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      redirect: false,
      username,
      password,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid username or password");
    } else {
      router.push("/");
      router.refresh();
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div
        className="w-full max-w-sm rounded-2xl p-6"
        style={{
          backgroundColor: "var(--mn-card)",
          border: "1px solid var(--mn-border)",
        }}
      >
        <h1 className="text-xl font-bold mb-1">Sign in</h1>
        <p className="text-sm mb-6" style={{ color: "var(--mn-muted)" }}>
          Sign in to sync your settings across devices
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              className="text-sm font-medium block mb-1"
              style={{ color: "var(--mn-muted)" }}
            >
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{
                backgroundColor: "var(--mn-bg)",
                border: "1px solid var(--mn-border)",
                color: "var(--mn-fg)",
              }}
            />
          </div>

          <div>
            <label
              className="text-sm font-medium block mb-1"
              style={{ color: "var(--mn-muted)" }}
            >
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{
                backgroundColor: "var(--mn-bg)",
                border: "1px solid var(--mn-border)",
                color: "var(--mn-fg)",
              }}
            />
          </div>

          {error && (
            <p className="text-xs" style={{ color: "#EF4444" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40"
            style={{ backgroundColor: "var(--mn-accent)" }}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="text-sm mt-4 text-center" style={{ color: "var(--mn-muted)" }}>
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-medium" style={{ color: "var(--mn-accent)" }}>
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
