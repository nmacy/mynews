"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { UserSettingsTabs } from "@/components/settings/UserSettingsTabs";
import { AdminSettingsTabs } from "@/components/settings/AdminSettingsTabs";

export default function SettingsPage() {
  const { data: session } = useSession();
  const isAdminUser = session?.user?.role === "admin";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/"
            className="text-sm font-medium mb-1 inline-block"
            style={{ color: "var(--mn-accent)" }}
          >
            &larr; Back to news
          </Link>
          <h1 className="text-2xl font-bold">Settings</h1>
        </div>
      </div>

      <UserSettingsTabs />

      {isAdminUser && (
        <div>
          <h2 className="text-lg font-bold mb-4">Admin Settings</h2>
          <AdminSettingsTabs />
        </div>
      )}
    </div>
  );
}
