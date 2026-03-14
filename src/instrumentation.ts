export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  let consecutiveFailures = 0;
  const MAX_BACKOFF_MS = 30 * 60 * 1000; // 30 minutes

  async function refresh() {
    try {
      const { getAllSourcesAcrossUsers, refreshAndPersist } = await import("@/lib/feeds");
      const sources = await getAllSourcesAcrossUsers();
      const articles = await refreshAndPersist(sources);
      consecutiveFailures = 0;
      console.log(`[background-refresh] Feed refresh complete (${articles.length} articles)`);

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
      consecutiveFailures++;
      console.error(`[background-refresh] Feed refresh failed (failure #${consecutiveFailures}):`, err);
    }
  }

  async function scheduleNext() {
    try {
      const { getRefreshIntervalMs } = await import("@/lib/server-config");
      let ms = await getRefreshIntervalMs();
      if (consecutiveFailures > 0) {
        const backoff = ms * Math.pow(2, consecutiveFailures);
        ms = Math.min(backoff, MAX_BACKOFF_MS);
        console.warn(`[background-refresh] Backing off: next refresh in ${Math.round(ms / 1000)}s (failure #${consecutiveFailures})`);
      }
      setTimeout(async () => {
        await refresh();
        scheduleNext();
      }, ms);
    } catch {
      // Fallback to 5 minutes if config read fails
      const fallback = 5 * 60 * 1000;
      const ms = consecutiveFailures > 0
        ? Math.min(fallback * Math.pow(2, consecutiveFailures), MAX_BACKOFF_MS)
        : fallback;
      setTimeout(async () => {
        await refresh();
        scheduleNext();
      }, ms);
    }
  }

  // One-time migrations
  try {
    const { migrateSourceIds } = await import("@/lib/migrate-source-ids");
    await migrateSourceIds();
  } catch (err) {
    console.error("[instrumentation] Source ID migration failed:", err);
  }

  // One-time: classify existing articles' hasTimestamp based on heuristic
  // If publishedAt is within 10 seconds of firstSeen, it was likely a fallback timestamp
  try {
    const { getServerConfig, setServerConfig } = await import("@/lib/server-config");
    const tsDone = await getServerConfig("hasTimestampMigrated");
    if (tsDone !== "true") {
      const { prisma } = await import("@/lib/prisma");
      await prisma.$executeRawUnsafe(`
        UPDATE Article SET hasTimestamp = CASE
          WHEN ABS(CAST(strftime('%s', publishedAt) AS INTEGER) - CAST(strftime('%s', firstSeen) AS INTEGER)) <= 10
          THEN 0 ELSE 1 END
      `);
      await setServerConfig("hasTimestampMigrated", "true");
      console.log("[instrumentation] Classified existing articles by timestamp availability");

      // Log per-source timestamp analysis
      const stats = await prisma.$queryRawUnsafe<Array<{ sourceName: string; total: bigint; withTs: bigint; withoutTs: bigint }>>(`
        SELECT sourceName,
               COUNT(*) as total,
               SUM(CASE WHEN hasTimestamp = 1 THEN 1 ELSE 0 END) as withTs,
               SUM(CASE WHEN hasTimestamp = 0 THEN 1 ELSE 0 END) as withoutTs
        FROM Article
        GROUP BY sourceName
        ORDER BY sourceName
      `);
      for (const s of stats) {
        console.log(`[timestamp-analysis] ${s.sourceName}: ${s.withTs}/${s.total} have real timestamps`);
      }
    }
  } catch (err) {
    console.error("[instrumentation] hasTimestamp migration failed:", err);
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
