export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const INTERVAL_MS = 5 * 60 * 1000;

  async function refresh() {
    try {
      const { getAllArticles } = await import("@/lib/feeds");
      await getAllArticles();
      console.log("[background-refresh] Feed refresh complete");
    } catch (err) {
      console.error("[background-refresh] Feed refresh failed:", err);
    }
  }

  // Initial refresh (fire-and-forget, don't block server boot)
  refresh();

  // Repeat every 15 minutes
  setInterval(refresh, INTERVAL_MS);
}
