"use client";

import { SettingsTabs } from "@/components/settings/SettingsTabs";
import { DefaultSourcesSection } from "@/components/settings/DefaultSourcesSection";
import { CustomTagsSection } from "@/components/settings/CustomTagsSection";
import { RescanSection } from "@/components/settings/RescanSection";
import { AiSettingsSection } from "@/components/settings/AiTaggerSection";
import { RankingSection } from "@/components/settings/RankingSection";
import { CacheSection } from "@/components/settings/CacheSection";
import { SystemStatusSection } from "@/components/settings/SystemStatusSection";
import { LogViewerSection } from "@/components/settings/LogViewerSection";
import { AdminUsersSection } from "@/components/settings/AdminUsersSection";

export function AdminSettingsTabs() {
  const tabs = [
    {
      id: "content",
      label: "Content",
      content: (
        <div className="space-y-6">
          <DefaultSourcesSection />
          <CustomTagsSection />
          <RescanSection />
        </div>
      ),
    },
    {
      id: "ai-ranking",
      label: "AI & Ranking",
      content: (
        <div className="space-y-6">
          <AiSettingsSection />
          <RankingSection />
        </div>
      ),
    },
    {
      id: "system",
      label: "System",
      content: (
        <div className="space-y-6">
          <CacheSection />
          <SystemStatusSection />
          <LogViewerSection />
          <AdminUsersSection />
        </div>
      ),
    },
  ];

  return <SettingsTabs tabs={tabs} defaultTab="content" />;
}
