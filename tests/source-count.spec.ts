import { test, expect } from "@playwright/test";

test.describe("Source page article count", () => {
  test.beforeAll(async ({ request }) => {
    await request.get("http://localhost:3001/api/feeds?sourceIds=the-verge").catch(() => {});
  });

  test("source page receives and renders all articles from API", async ({ page }) => {
    let apiArticleCount = 0;

    // Intercept the feeds API call the source page makes
    page.on("response", async (response) => {
      if (response.url().includes("/api/feeds") && response.url().includes("sourceIds")) {
        try {
          const data = await response.json();
          apiArticleCount = data.count;
          console.log(`API returned ${data.count} articles (total: ${data.total})`);
        } catch {}
      }
    });

    await page.goto("http://localhost:3001/source/the-verge", { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);

    // Check what the page actually got from the API
    console.log(`API article count: ${apiArticleCount}`);
    expect(apiArticleCount).toBeGreaterThan(20);

    // Check what React rendered
    const renderedCount = await page.evaluate(() => {
      return document.querySelectorAll('a[href^="/article/"]').length;
    });
    console.log(`Rendered article cards: ${renderedCount}`);

    // Also check the component's internal state via the DOM
    const heroExists = await page.locator(".aspect-\\[3\\/1\\], .aspect-\\[16\\/9\\]").count();
    console.log(`Hero/image elements: ${heroExists}`);

    // The rendered count should be PAGE_SIZE (30) + hero (1) = ~31
    // or at least way more than 6
    expect(renderedCount).toBeGreaterThan(10);
  });

  test("no-cache header prevents stale responses", async ({ page }) => {
    const response = await page.request.get("http://localhost:3001/api/feeds?sourceIds=the-verge");
    const cacheControl = response.headers()["cache-control"];
    console.log(`Cache-Control: ${cacheControl}`);
    expect(cacheControl).toContain("no-cache");

    const data = await response.json();
    console.log(`Articles: ${data.count}`);
    expect(data.count).toBeGreaterThan(20);
  });
});
