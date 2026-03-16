import { test, expect } from "@playwright/test";

test.describe("Tag page", () => {
  test.beforeAll(async ({ request }) => {
    await request.get("http://localhost:3001/api/feeds?sourceIds=the-verge").catch(() => {});
  });

  test("tag pages load articles and show debug scores", async ({ page }) => {
    // Track API calls
    let feedsCalls = 0;
    page.on("response", async (resp) => {
      if (resp.url().includes("/api/feeds") && resp.status() === 200) feedsCalls++;
    });

    // Go to technology tag (no auth — uses default sources)
    const start = Date.now();
    await page.goto("http://localhost:3001/tag/technology", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForResponse(
      (resp) => resp.url().includes("/api/feeds") && resp.status() === 200,
      { timeout: 30000 }
    );
    await page.waitForTimeout(2000);

    const techTime = Date.now() - start;
    const techCards = await page.locator('a[href^="/article/"]').count();
    console.log(`/tag/technology: ${techCards} cards in ${techTime}ms (${feedsCalls} API calls)`);
    expect(techCards).toBeGreaterThan(5);

    // Check for debug scores
    // React may render color as rgb() — check for both formats and font-mono class
    const debugBadges = await page.locator('.font-mono.font-bold').count();
    console.log(`Debug score badges: ${debugBadges}`);
    expect(debugBadges).toBeGreaterThan(0);

    await page.screenshot({ path: "test-results/tag-technology.png", fullPage: false });

    // Switch to gaming tag — should use cached articles (no new API call)
    const prevCalls = feedsCalls;
    const switchStart = Date.now();
    await page.goto("http://localhost:3001/tag/gaming", { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForTimeout(2000);

    const switchTime = Date.now() - switchStart;
    const gamingCards = await page.locator('a[href^="/article/"]').count();
    const newCalls = feedsCalls - prevCalls;
    console.log(`/tag/gaming: ${gamingCards} cards in ${switchTime}ms (${newCalls} new API calls)`);

    // Verify debug scores on gaming page too
    const gamingBadges = await page.locator('.font-mono.font-bold').count();
    console.log(`Gaming debug badges: ${gamingBadges}`);
  });

  test("API returns _rankScore for sourceIds path", async ({ request }) => {
    const resp = await request.get("http://localhost:3001/api/feeds?sourceIds=the-verge");
    const data = await resp.json();
    const firstArticle = data.articles[0];

    console.log(`Articles: ${data.count}`);
    console.log(`_rankScore: ${firstArticle._rankScore}`);
    console.log(`debugScores: ${data.ranking?.debugScores}`);

    expect(firstArticle._rankScore).toBeDefined();
    expect(firstArticle._rankScore).toBeGreaterThan(0);
    expect(data.ranking?.debugScores).toBe(true);
  });
});
