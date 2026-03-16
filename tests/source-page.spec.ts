import { test, expect } from "@playwright/test";

test.describe("Source page", () => {
  // Warm up the dev server (first hit compiles all modules)
  test.beforeAll(async ({ request }) => {
    await request.get("http://localhost:3001/api/feeds?sourceIds=the-verge").catch(() => {});
  });

  test("The Verge loads all articles quickly", async ({ page }) => {
    // Navigate to source page
    const start = Date.now();
    await page.goto("http://localhost:3001/source/the-verge", { waitUntil: "domcontentloaded" });

    // Wait for skeleton to disappear
    await page.waitForSelector(".animate-pulse", { state: "hidden", timeout: 15000 }).catch(() => {});
    const loadTime = Date.now() - start;
    console.log(`Source page load: ${loadTime}ms`);

    // Count articles
    const cards = page.locator("a[href^='/article/']");
    await expect(cards.first()).toBeAttached({ timeout: 10000 });
    const count = await cards.count();
    console.log(`Article cards: ${count}`);

    // Should have a reasonable number of articles (The Verge has ~160)
    expect(count).toBeGreaterThan(20);
    expect(loadTime).toBeLessThan(5000);

    await page.screenshot({ path: "test-results/source-verge.png" });
  });

  test("API returns full articles for single source", async ({ page }) => {
    // Replicate the exact fetch the source page does
    const source = { id: "the-verge", name: "The Verge", url: "https://www.theverge.com/rss/index.xml", priority: 2 };
    const params = new URLSearchParams();
    params.set("sources", JSON.stringify([source]));

    const start = Date.now();
    const response = await page.request.get(`http://localhost:3001/api/feeds?${params}`);
    const elapsed = Date.now() - start;
    const data = await response.json();

    console.log(`API time: ${elapsed}ms`);
    console.log(`Articles: ${data.count}, Total: ${data.total}`);
    console.log(`Response size: ${(JSON.stringify(data).length / 1024).toFixed(0)}KB`);

    if (data.articles.length > 0) {
      const dates = data.articles.map((a: { publishedAt: string }) => a.publishedAt);
      console.log(`Newest: ${dates[0]}`);
      console.log(`Oldest: ${dates[dates.length - 1]}`);
    }

    expect(data.count).toBeGreaterThan(20);
    expect(elapsed).toBeLessThan(5000);
  });

  test("home page still loads fast with capped articles", async ({ page }) => {
    const start = Date.now();
    await page.goto("http://localhost:3001/", { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".animate-pulse", { state: "hidden", timeout: 15000 }).catch(() => {});
    const loadTime = Date.now() - start;
    console.log(`Home page load: ${loadTime}ms`);

    const cards = page.locator("a[href^='/article/']");
    await expect(cards.first()).toBeAttached({ timeout: 10000 });
    const count = await cards.count();
    console.log(`Article cards: ${count}`);

    expect(loadTime).toBeLessThan(5000);
  });
});
