"use client";

import { useSession } from "next-auth/react";
import { SettingsTabs } from "@/components/settings/SettingsTabs";
import { ThemeSection } from "@/components/settings/ThemeSection";
import { AccentSection } from "@/components/settings/AccentSection";
import { TagBarSection } from "@/components/settings/TagBarSection";
import { SourceBarSection } from "@/components/settings/SourceBarSection";
import { SourcesSection } from "@/components/settings/SourcesSection";
import { ResetSection } from "@/components/settings/ResetSection";
import { DeleteAccountSection } from "@/components/settings/DeleteAccountSection";

export function UserSettingsTabs() {
  const { data: session } = useSession();

  const tabs = [
    {
      id: "appearance",
      label: "Appearance",
      content: (
        <div
          className="rounded-2xl p-4 sm:p-6"
          style={{ backgroundColor: "var(--mn-card)", border: "1px solid var(--mn-border)" }}
        >
          <ThemeSection />
          <div className="my-6" style={{ borderTop: "1px solid var(--mn-border)" }} />
          <AccentSection />
        </div>
      ),
    },
    {
      id: "sources",
      label: "Sources",
      content: <SourcesSection />,
    },
    {
      id: "interface",
      label: "Interface",
      content: (
        <div
          className="rounded-2xl p-4 sm:p-6"
          style={{ backgroundColor: "var(--mn-card)", border: "1px solid var(--mn-border)" }}
        >
          <TagBarSection />
          <div className="my-6" style={{ borderTop: "1px solid var(--mn-border)" }} />
          <SourceBarSection />
        </div>
      ),
    },
    {
      id: "account",
      label: "Account",
      content: (
        <div className="space-y-6">
          <ResetSection />
          {session?.user?.username && (
            <DeleteAccountSection username={session.user.username} />
          )}
        </div>
      ),
    },
  ];

  return <SettingsTabs tabs={tabs} defaultTab="appearance" />;
}
