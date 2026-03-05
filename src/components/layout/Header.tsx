"use client";

import { useEffect, useRef, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";
import { SearchBar } from "./SearchBar";

function GearIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function UserMenu() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  if (!session?.user) {
    return (
      <Link
        href="/login"
        className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors hover:opacity-80"
        style={{ color: "var(--mn-accent)" }}
      >
        Sign in
      </Link>
    );
  }

  const initial = (session.user.name?.[0] || session.user.email?.[0] || "?").toUpperCase();

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
        style={{ backgroundColor: "var(--mn-accent)" }}
        aria-label="User menu"
      >
        {initial}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-56 rounded-xl shadow-lg py-1 z-50"
          style={{
            backgroundColor: "var(--mn-card)",
            border: "1px solid var(--mn-border)",
          }}
        >
          <div className="px-4 py-2 border-b" style={{ borderColor: "var(--mn-border)" }}>
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-medium truncate">{session.user.name || session.user.email}</p>
              {session.user.role === "admin" && (
                <span
                  className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: "var(--mn-accent)", color: "white" }}
                >
                  Admin
                </span>
              )}
            </div>
            {session.user.name && (
              <p className="text-xs truncate" style={{ color: "var(--mn-muted)" }}>
                {session.user.email}
              </p>
            )}
          </div>
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-sm transition-colors hover:opacity-70"
          >
            Settings
          </Link>
          <button
            onClick={() => {
              setOpen(false);
              signOut({ callbackUrl: "/" });
            }}
            className="w-full text-left px-4 py-2 text-sm transition-colors hover:opacity-70"
            style={{ color: "#EF4444" }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function Header() {
  const [isSearchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <header
      className="sticky top-0 z-50"
      style={{ backgroundColor: "var(--mn-card)", borderBottom: "1px solid var(--mn-border)" }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "var(--mn-accent)" }}>
            <span className="text-white font-bold text-sm">N</span>
          </div>
          <span className="text-xl font-bold tracking-tight">MyNews</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/settings"
            className="p-2 rounded-lg transition-colors hover:opacity-70"
            style={{ color: "var(--mn-muted)" }}
            aria-label="Settings"
          >
            <GearIcon />
          </Link>
          <button
            onClick={() => setSearchOpen(!isSearchOpen)}
            className="p-2 rounded-lg transition-colors hover:opacity-70"
            style={{ color: "var(--mn-muted)" }}
            aria-label="Search"
          >
            <SearchIcon />
          </button>
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
      <SearchBar
        isOpen={isSearchOpen}
        onClose={() => setSearchOpen(false)}
        query={searchQuery}
        setQuery={setSearchQuery}
      />
    </header>
  );
}
