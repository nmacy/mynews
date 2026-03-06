"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          name: name || undefined,
          email: email || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Signup failed");
        setLoading(false);
        return;
      }

      // Auto sign-in after signup
      const result = await signIn("credentials", {
        redirect: false,
        username,
        password,
      });

      setLoading(false);

      if (result?.error) {
        setError("Account created but sign-in failed. Please sign in manually.");
      } else {
        router.push("/");
        router.refresh();
      }
    } catch {
      setLoading(false);
      setError("Network error");
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
        <h1 className="text-xl font-bold mb-1">Create account</h1>
        <p className="text-sm mb-6" style={{ color: "var(--mn-muted)" }}>
          Save your settings and API keys securely
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
              minLength={3}
              maxLength={30}
              pattern="^[a-zA-Z0-9_-]+$"
              autoComplete="username"
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{
                backgroundColor: "var(--mn-bg)",
                border: "1px solid var(--mn-border)",
                color: "var(--mn-fg)",
              }}
            />
            <p className="text-xs mt-1" style={{ color: "var(--mn-muted)" }}>
              3–30 characters: letters, numbers, _ or -
            </p>
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
              minLength={8}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{
                backgroundColor: "var(--mn-bg)",
                border: "1px solid var(--mn-border)",
                color: "var(--mn-fg)",
              }}
            />
            <p className="text-xs mt-1" style={{ color: "var(--mn-muted)" }}>
              At least 8 characters
            </p>
          </div>

          <div>
            <label
              className="text-sm font-medium block mb-1"
              style={{ color: "var(--mn-muted)" }}
            >
              Name <span style={{ color: "var(--mn-muted)" }}>(optional)</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
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
              Email <span style={{ color: "var(--mn-muted)" }}>(optional)</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="text-sm mt-4 text-center" style={{ color: "var(--mn-muted)" }}>
          Already have an account?{" "}
          <Link href="/login" className="font-medium" style={{ color: "var(--mn-accent)" }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
