export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  async function refresh() {
    try {
      const { getAllArticles } = await import("@/lib/feeds");
      const articles = await getAllArticles();
      console.log("[background-refresh] Feed refresh complete");

      try {
        const { setServerConfig } = await import("@/lib/server-config");
        await setServerConfig("lastRefreshAt", new Date().toISOString());
      } catch {
        // non-critical
      }

      try {
        const { autoTagArticles, autoDiscoverTags } = await import("@/lib/auto-tagger");
        await autoTagArticles(articles);
        await autoDiscoverTags(articles);
      } catch (err) {
        console.warn("[background-refresh] Auto-tagger failed:", err);
      }
    } catch (err) {
      console.error("[background-refresh] Feed refresh failed:", err);
    }
  }

  async function scheduleNext() {
    try {
      const { getRefreshIntervalMs } = await import("@/lib/server-config");
      const ms = await getRefreshIntervalMs();
      setTimeout(async () => {
        await refresh();
        scheduleNext();
      }, ms);
    } catch {
      // Fallback to 5 minutes if config read fails
      setTimeout(async () => {
        await refresh();
        scheduleNext();
      }, 5 * 60 * 1000);
    }
  }

  // One-time migrations
  try {
    const { migrateSourceIds } = await import("@/lib/migrate-source-ids");
    await migrateSourceIds();
  } catch (err) {
    console.error("[instrumentation] Source ID migration failed:", err);
  }

  // One-time reset of AI tags after prompt improvement (v2)
  try {
    const { getServerConfig, setServerConfig } = await import("@/lib/server-config");
    const done = await getServerConfig("aiTagsResetV2");
    if (done !== "true") {
      const { prisma } = await import("@/lib/prisma");
      await prisma.$executeRawUnsafe(`UPDATE Article SET aiTagged = 0, tags = '[]'`);
      await setServerConfig("aiTagsResetV2", "true");
      console.log("[instrumentation] Reset AI tags for re-tagging with improved prompt");
    }
  } catch (err) {
    console.error("[instrumentation] AI tag reset failed:", err);
  }

  // Initial refresh (fire-and-forget, don't block server boot)
  refresh();

  // Schedule recurring refreshes with dynamic interval
  scheduleNext();
}
