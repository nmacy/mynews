import { test, expect } from "@playwright/test";

test.describe("Source page debug", () => {
  test.beforeAll(async ({ request }) => {
    // Warm up dev server
    await request.get("http://localhost:3001/api/feeds?sourceIds=the-verge").catch(() => {});
  });

  test("logged-in user sees all Verge articles", async ({ page }) => {
    const consoleLogs: string[] = [];
    const networkRequests: { url: string; status: number; size: number; body?: string }[] = [];

    // Capture all console logs
    page.on("console", (msg) => {
      consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    });

    // Capture all network responses
    page.on("response", async (response) => {
      const url = response.url();
      if (url.includes("/api/")) {
        let body: string | undefined;
        try {
          body = await response.text();
        } catch {}
        networkRequests.push({
          url: url.substring(0, 150),
          status: response.status(),
          size: body?.length ?? 0,
          body: url.includes("/api/feeds") ? body : undefined,
        });
      }
    });

    // Step 1: Login
    await page.goto("http://localhost:3001/api/auth/signin", { waitUntil: "networkidle", timeout: 30000 });
    const loginForm = page.locator('input[name="username"]');
    if (await loginForm.count() > 0) {
      await loginForm.fill("admin");
      await page.locator('input[name="password"]').fill("admin");
      await page.locator('button[type="submit"]').click();
      await page.waitForURL("**/", { timeout: 10000 }).catch(() => {});
      console.log("Logged in as admin");
    } else {
      console.log("Already logged in or no login form");
    }

    // Step 2: Go to home page, wait for it to load
    await page.goto("http://localhost:3001/", { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForSelector(".animate-pulse", { state: "hidden", timeout: 15000 }).catch(() => {});

    const homeCards = await page.locator('a[href^="/article/"]').count();
    console.log(`Home page cards: ${homeCards}`);

    // Step 3: Navigate to The Verge source page (client-side navigation)
    console.log("--- Navigating to /source/the-verge ---");
    networkRequests.length = 0; // Reset
    consoleLogs.length = 0;

    await page.goto("http://localhost:3001/source/the-verge", { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(3000); // Extra time for any async ops

    const sourceCards = await page.locator('a[href^="/article/"]').count();
    console.log(`Source page cards: ${sourceCards}`);

    // Print all console logs from the page
    console.log("\n--- Browser console logs ---");
    for (const log of consoleLogs) {
      console.log(log);
    }

    // Print all network requests
    console.log("\n--- Network requests ---");
    for (const req of networkRequests) {
      console.log(`${req.status} ${req.url} (${req.size} bytes)`);
      if (req.body && req.url.includes("/api/feeds")) {
        try {
          const data = JSON.parse(req.body);
          console.log(`  -> count: ${data.count}, total: ${data.total}, ranking: ${data.ranking?.enabled}`);
          if (data.articles?.length > 0) {
            console.log(`  -> first: ${data.articles[0].title?.substring(0, 50)}`);
            console.log(`  -> last: ${data.articles[data.articles.length - 1].title?.substring(0, 50)}`);
          }
        } catch {}
      }
    }

    // Take screenshot
    await page.screenshot({ path: "test-results/source-debug-logged-in.png", fullPage: true });

    // Check the actual visible text on the page
    const pageText = await page.locator("body").innerText();
    if (pageText.includes("Source not found") || pageText.includes("No articles found")) {
      console.log("\n--- PAGE SHOWS ERROR STATE ---");
      console.log(pageText.substring(0, 500));
    }

    expect(sourceCards).toBeGreaterThan(6);
  });

  test("logged-in user clicks source name on article card", async ({ page }) => {
    const consoleLogs: string[] = [];
    const feedsResponses: { count: number; total: number }[] = [];

    page.on("console", (msg) => {
      consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    });

    page.on("response", async (response) => {
      if (response.url().includes("/api/feeds")) {
        try {
          const data = await response.json();
          feedsResponses.push({ count: data.count, total: data.total });
          console.log(`Feeds response: count=${data.count} total=${data.total}`);
        } catch {}
      }
    });

    // Login
    await page.goto("http://localhost:3001/api/auth/signin", { waitUntil: "networkidle", timeout: 30000 });
    const loginForm = page.locator('input[name="username"]');
    if (await loginForm.count() > 0) {
      await loginForm.fill("admin");
      await page.locator('input[name="password"]').fill("admin");
      await page.locator('button[type="submit"]').click();
      await page.waitForURL("**/", { timeout: 10000 }).catch(() => {});
    }

    // Go to home, wait for articles
    await page.goto("http://localhost:3001/", { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForSelector(".animate-pulse", { state: "hidden", timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1000);

    // Find a Verge article's source link and click it
    const vergeSourceLink = page.locator('span[role="link"]').filter({ hasText: "The Verge" }).first();
    if (await vergeSourceLink.count() === 0) {
      console.log("No Verge articles visible on home page, skipping click test");
      return;
    }

    console.log("--- Clicking The Verge source link ---");
    feedsResponses.length = 0;
    consoleLogs.length = 0;

    await vergeSourceLink.click();
    await page.waitForURL(/source/, { timeout: 10000 });
    await page.waitForTimeout(3000);

    const cards = await page.locator('a[href^="/article/"]').count();
    console.log(`Cards after clicking source: ${cards}`);

    console.log("\n--- Console logs ---");
    for (const log of consoleLogs) {
      console.log(log);
    }

    console.log("\n--- Feeds responses ---");
    for (const r of feedsResponses) {
      console.log(`count: ${r.count}, total: ${r.total}`);
    }

    await page.screenshot({ path: "test-results/source-debug-clicked.png", fullPage: true });

    expect(cards).toBeGreaterThan(6);
  });
});
