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

function NewsLogo() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      style={{ color: "var(--mn-accent)" }}
    >
      {/* Page */}
      <rect x="3" y="2" width="18" height="20" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
      {/* Headline bar */}
      <rect x="6" y="5" width="12" height="2.5" rx="1" fill="currentColor" />
      {/* Image thumbnail */}
      <rect x="6" y="10" width="5" height="4" rx="1" fill="currentColor" opacity="0.4" />
      {/* Text lines beside image */}
      <line x1="13" y1="10.5" x2="18" y2="10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="13" y1="13.5" x2="17" y2="13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      {/* Body text line */}
      <line x1="6" y1="17" x2="18" y2="17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="6" y1="19.5" x2="14" y2="19.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
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

  const initial = (session.user.name?.[0] || session.user.username?.[0] || "?").toUpperCase();

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
              <p className="text-sm font-medium truncate">{session.user.name || session.user.username}</p>
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
                {session.user.username}
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
        <Link href="/" className="flex items-center gap-1.5">
          <NewsLogo />
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
