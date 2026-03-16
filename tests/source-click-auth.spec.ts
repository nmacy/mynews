import { test, expect } from "@playwright/test";

test.describe("Source page - click through authenticated", () => {
  test("login, load home, click source name on article", async ({ page }) => {
    const feedsData: { method: string; url: string; count?: number; total?: number; status: number }[] = [];

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

    // Login
    await page.goto("http://localhost:3001/login", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.locator('input[name="username"], input[type="text"]').first().fill("testadmin");
    await page.locator('input[name="password"], input[type="password"]').first().fill("test123");
    await page.locator('button[type="submit"]').click();
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10000 }).catch(async () => {
      // Rate limited or wrong creds — try navigating directly
      console.log("Login redirect didn't happen, checking session...");
    });
    const sessionRes = await page.request.get("http://localhost:3001/api/auth/session");
    const session = await sessionRes.json();
    if (!session?.user) {
      console.log("Not logged in — skipping test (likely rate limited)");
      test.skip();
      return;
    }
    console.log("Logged in as:", session.user.username);

    // Wait for home page articles to load (attached, not necessarily visible)
    await page.waitForSelector('a[href^="/article/"]', { state: "attached", timeout: 30000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "test-results/home-auth.png", fullPage: false });

    const homeCards = await page.locator('a[href^="/article/"]').count();
    console.log(`Home page cards: ${homeCards}`);

    console.log("\nHome page feeds calls:");
    for (const call of feedsData) {
      console.log(`  ${call.method} status=${call.status} count=${call.count} total=${call.total}`);
    }

    // Now click a source name to navigate to a source page
    // Try to find The Verge source link
    const vergeLink = page.locator('span[role="link"]').filter({ hasText: "The Verge" }).first();
    const hasVerge = await vergeLink.count() > 0;

    if (!hasVerge) {
      // If no Verge on home page, click any source
      const anySource = page.locator('span[role="link"]').first();
      const sourceName = await anySource.innerText();
      console.log(`\nNo Verge on home page, clicking: ${sourceName}`);
      feedsData.length = 0;
      await anySource.click();
    } else {
      console.log("\nClicking The Verge source link");
      feedsData.length = 0;
      await vergeLink.click();
    }

    await page.waitForURL(/source/, { timeout: 10000 });
    console.log("Navigated to:", page.url());

    // Wait for the feeds response
    await page.waitForResponse(
      (resp) => resp.url().includes("/api/feeds") && resp.status() === 200,
      { timeout: 15000 }
    ).catch(() => console.log("No feeds response seen"));

    await page.waitForTimeout(3000);

    const sourceCards = await page.locator('a[href^="/article/"]').count();
    console.log(`Source page cards: ${sourceCards}`);

    console.log("\nSource page feeds calls:");
    for (const call of feedsData) {
      console.log(`  ${call.method} ${call.url}`);
      console.log(`    status=${call.status} count=${call.count} total=${call.total}`);
    }

    await page.screenshot({ path: "test-results/source-click-auth.png", fullPage: true });

    expect(sourceCards).toBeGreaterThan(10);
  });
});
