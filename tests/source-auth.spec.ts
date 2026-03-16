import { test, expect } from "@playwright/test";

test.describe("Source page - authenticated user", () => {
  test("login and check The Verge source page", async ({ page }) => {
    // Step 1: Login
    await page.goto("http://localhost:3001/login", { waitUntil: "domcontentloaded", timeout: 30000 });

    const usernameField = page.locator('input[name="username"], input[type="text"]').first();
    const passwordField = page.locator('input[name="password"], input[type="password"]').first();

    await usernameField.fill("testadmin");
    await passwordField.fill("test123");
    await page.locator('button[type="submit"]').click();
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10000 });
    console.log("Logged in, URL:", page.url());

    // Step 2: Track ALL network requests
    const allRequests: string[] = [];
    const feedsData: { method: string; url: string; count?: number; total?: number; status: number }[] = [];

    page.on("request", (req) => {
      if (req.url().includes("/api/")) {
        allRequests.push(`${req.method()} ${req.url().substring(0, 120)}`);
      }
    });

    page.on("response", async (response) => {
      if (response.url().includes("/api/feeds")) {
        const entry: typeof feedsData[0] = {
          method: response.request().method(),
          url: response.url().substring(0, 150),
          status: response.status(),
        };
        try {
          const data = await response.json();
          entry.count = data.count;
          entry.total = data.total;
        } catch {}
        feedsData.push(entry);
      }
    });

    // Step 3: Go directly to source page
    console.log("\n--- Navigating to /source/the-verge ---");
    await page.goto("http://localhost:3001/source/the-verge", { waitUntil: "domcontentloaded", timeout: 30000 });

    // Wait for the feeds API call to complete (not networkidle which waits for ALL requests)
    await page.waitForResponse(
      (resp) => resp.url().includes("/api/feeds") && resp.status() === 200,
      { timeout: 15000 }
    ).catch(() => console.log("No feeds response captured"));

    await page.waitForTimeout(3000);

    // Step 4: Results
    const sourceCards = await page.locator('a[href^="/article/"]').count();
    console.log(`Source page cards: ${sourceCards}`);

    console.log("\nAll API requests:");
    for (const req of allRequests) {
      console.log(`  ${req}`);
    }

    console.log("\nFeeds responses:");
    for (const call of feedsData) {
      console.log(`  ${call.method} ${call.url}`);
      console.log(`    status: ${call.status}, count: ${call.count}, total: ${call.total}`);
    }

    // Check browser console
    const consoleLogs: string[] = [];
    page.on("console", (msg) => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));
    await page.waitForTimeout(1000);

    // Check page content
    const bodyText = await page.locator("body").innerText();
    if (bodyText.includes("No articles") || bodyText.includes("Source not found")) {
      console.log("\nPAGE ERROR STATE:", bodyText.substring(0, 300));
    }

    await page.screenshot({ path: "test-results/source-auth.png", fullPage: true });

    console.log(`\nFinal answer: ${sourceCards} cards rendered`);
    expect(sourceCards).toBeGreaterThan(10);
  });
});
