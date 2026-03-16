import { test, expect } from "@playwright/test";

test.describe("Source bar filtering", () => {
  test("logged-in user filters by source via source bar", async ({ page }) => {
    // Login
    await page.goto("http://localhost:3001/login", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.locator('input[name="username"], input[type="text"]').first().fill("testadmin");
    await page.locator('input[name="password"], input[type="password"]').first().fill("test123");
    await page.locator('button[type="submit"]').click();
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10000 }).catch(() => {});

    const sessionRes = await page.request.get("http://localhost:3001/api/auth/session");
    const session = await sessionRes.json();
    if (!session?.user) { test.skip(); return; }
    console.log("Logged in as:", session.user.username);

    // Capture the home page feeds response
    let homeArticleCount = 0;
    let homeTotal = 0;
    page.on("response", async (response) => {
      if (response.url().includes("/api/feeds") && !response.url().includes("sourceIds")) {
        try {
          const data = await response.json();
          homeArticleCount = data.count;
          homeTotal = data.total;
        } catch {}
      }
    });

    // Go to home page - wait for the feeds API to respond (can be slow with 97 sources)
    await page.goto("http://localhost:3001/", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForResponse(
      (resp) => resp.url().includes("/api/feeds") && resp.status() === 200,
      { timeout: 60000 }
    ).catch(() => console.log("No feeds response within 60s"));
    await page.waitForTimeout(2000);

    console.log(`Home page: ${homeArticleCount} articles loaded (${homeTotal} total in DB)`);

    // Count Verge articles in the loaded set
    const vergeCountInHomePage = await page.evaluate(() => {
      const cards = document.querySelectorAll('a[href^="/article/"]');
      let vergeCount = 0;
      for (const card of cards) {
        const sourceSpan = card.querySelector('span[role="link"]');
        if (sourceSpan?.textContent?.includes("The Verge")) vergeCount++;
      }
      return vergeCount;
    });
    console.log(`Verge articles in loaded home page data: ${vergeCountInHomePage}`);

    // Now click The Verge in source bar (or navigate with ?sources=the-verge)
    console.log("\n--- Filtering by The Verge via URL ---");
    await page.goto("http://localhost:3001/?sources=the-verge", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(3000);

    const filteredCards = await page.locator('a[href^="/article/"]').count();
    console.log(`Cards after source bar filter: ${filteredCards}`);

    // Now compare with the dedicated source page
    console.log("\n--- Navigating to /source/the-verge ---");
    await page.goto("http://localhost:3001/source/the-verge", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForResponse(
      (resp) => resp.url().includes("/api/feeds") && resp.status() === 200,
      { timeout: 15000 }
    ).catch(() => {});
    await page.waitForTimeout(3000);

    const sourcePageCards = await page.locator('a[href^="/article/"]').count();
    console.log(`Cards on /source/the-verge: ${sourcePageCards}`);

    console.log(`\n--- RESULT ---`);
    console.log(`Source bar filter (/?sources=the-verge): ${filteredCards} cards`);
    console.log(`Dedicated source page (/source/the-verge): ${sourcePageCards} cards`);
    console.log(`The source bar filters from ${homeArticleCount} capped articles`);
    console.log(`The source page fetches directly from DB`);

    if (filteredCards < 10 && sourcePageCards > 20) {
      console.log(`\n*** BUG CONFIRMED: Source bar shows only ${filteredCards} articles because`);
      console.log(`    the home page cap of ${homeArticleCount}/${homeTotal} excludes most Verge articles ***`);
    }
  });
});
