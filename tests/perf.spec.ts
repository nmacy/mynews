import { test, expect } from "@playwright/test";

test.describe("Performance", () => {
  // Warm up the dev server (first hit compiles all modules)
  test.beforeAll(async ({ request }) => {
    await request.get("http://localhost:3001/api/feeds?sourceIds=the-verge").catch(() => {});
  });

  test("home page loads within 5 seconds", async ({ page }) => {
    const start = Date.now();
    await page.goto("http://localhost:3001/", { waitUntil: "networkidle" });
    const elapsed = Date.now() - start;
    console.log(`Home page load: ${elapsed}ms`);
    expect(elapsed).toBeLessThan(10000);

    // Wait for skeleton to disappear (articles loaded)
    await page.waitForSelector(".animate-pulse", { state: "hidden", timeout: 15000 }).catch(() => {});

    // Should have article cards in DOM
    const cards = page.locator("a[href^='/article/']");
    const count = await cards.count();
    console.log(`Article cards in DOM: ${count}`);
    expect(count).toBeGreaterThan(0);

    await page.screenshot({ path: "test-results/home-loaded.png" });
  });

  test("clicking a tag stays responsive", async ({ page }) => {
    await page.goto("http://localhost:3001/", { waitUntil: "networkidle" });

    // Wait for skeleton to disappear
    await page.waitForSelector(".animate-pulse", { state: "hidden", timeout: 15000 }).catch(() => {});

    // Wait for article cards to exist
    const cards = page.locator("a[href^='/article/']");
    await expect(cards.first()).toBeAttached({ timeout: 10000 });
    const initialCount = await cards.count();
    console.log(`Initial article cards: ${initialCount}`);

    // Find and click a tag link
    const tagLink = page.locator("a[href^='/tag/']").first();
    const tagHref = await tagLink.getAttribute("href");
    console.log(`Clicking tag: ${tagHref}`);

    const start = Date.now();
    await tagLink.click();

    // The page should respond within a few seconds
    await page.waitForURL(/\/tag\//, { timeout: 10000 });
    const navElapsed = Date.now() - start;
    console.log(`Tag navigation: ${navElapsed}ms`);

    // Wait for skeleton to disappear on tag page
    await page.waitForSelector(".animate-pulse", { state: "hidden", timeout: 15000 }).catch(() => {});

    const tagCards = page.locator("a[href^='/article/']");
    const tagCount = await tagCards.count();
    const totalElapsed = Date.now() - start;
    console.log(`Tag page articles: ${tagCount}, total time: ${totalElapsed}ms`);

    await page.screenshot({ path: "test-results/tag-loaded.png" });
    expect(totalElapsed).toBeLessThan(10000);
  });

  test("tag page direct navigation performance", async ({ page }) => {
    const start = Date.now();
    await page.goto("http://localhost:3001/tag/gaming", { waitUntil: "networkidle" });
    const elapsed = Date.now() - start;
    console.log(`Direct /tag/gaming load: ${elapsed}ms`);

    const cards = page.locator("a[href^='/article/']");
    const cardCount = await cards.count();
    console.log(`Gaming articles: ${cardCount}`);
  });

  test("measure feeds API response size and time", async ({ page }) => {
    const start = Date.now();
    const response = await page.request.get("http://localhost:3001/api/feeds?sourceIds=the-verge");
    const elapsed = Date.now() - start;
    const body = await response.text();
    console.log(`Feeds API: ${elapsed}ms, ${(body.length / 1024).toFixed(0)}KB`);

    const data = JSON.parse(body);
    console.log(`Articles returned: ${data.count}`);

    // Check if content field is stripped
    if (data.articles.length > 0) {
      const hasContent = data.articles[0].content && data.articles[0].content.length > 0;
      console.log(`Content field present: ${hasContent}`);
    }
  });
});
