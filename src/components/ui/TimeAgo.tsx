"use client";

import { useEffect, useState } from "react";

function formatTimeAgo(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const seconds = Math.floor((now - then) / 1000);

  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function TimeAgo({ date }: { date: string }) {
  const [text, setText] = useState("");

  useEffect(() => {
    setText(formatTimeAgo(date));
    const interval = setInterval(() => setText(formatTimeAgo(date)), 60000);
    return () => clearInterval(interval);
  }, [date]);

  if (!text) return null;

  return (
    <time dateTime={date} className="text-sm" style={{ color: "var(--mn-muted2)" }}>
      {text}
    </time>
  );
}
