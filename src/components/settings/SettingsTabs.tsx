"use client";

import { useState } from "react";
import React from "react";

export interface SettingsTab {
  id: string;
  label: string;
  content: React.ReactNode;
}

export function SettingsTabs({
  tabs,
  defaultTab,
}: {
  tabs: SettingsTab[];
  defaultTab?: string;
}) {
  const [activeId, setActiveId] = useState(defaultTab ?? tabs[0]?.id ?? "");

  const activeTab = tabs.find((t) => t.id === activeId) ?? tabs[0];

  return (
    <div>
      <div className="flex gap-1 mb-6 flex-wrap">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveId(tab.id)}
            className="px-4 py-1.5 rounded-full text-sm font-medium transition-colors"
            style={
              activeId === tab.id
                ? { backgroundColor: "var(--mn-accent)", color: "white" }
                : { backgroundColor: "transparent", color: "var(--mn-muted)" }
            }
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div>{activeTab?.content}</div>
    </div>
  );
}
