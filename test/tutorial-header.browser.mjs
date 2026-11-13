// Optional: PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node test/tutorial-header.browser.mjs
// In-memory server: no .local persistence or pre-existing dev server required.
import assert from "node:assert/strict";
import { createPreviewServer } from "../preview/server.js";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const server = createPreviewServer();
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
let browser;
try {
  browser = await chromium.launch({ headless: true });
  for (const chapter of ["basics", "planning-phases"]) {
    for (const [locale, width] of [["en", 1280], ["fr", 380]]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${server.address().port}/learn?chapter=${chapter}&locale=${locale}`);
      await page.waitForSelector(".mission-overview");
      const checkOverview = async () => {
        assert.equal(await page.locator(".mission-overview").count(), 1);
        assert.equal(await page.locator("[data-mission-turn]").count(), 12);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      };
      await checkOverview();
      await page.click('[data-guide="continue"]');
      await checkOverview();
      await page.click(chapter === "basics" ? "#lesson-clock" : '[data-guide="phase-clock"]');
      await page.waitForSelector('#program [data-turn="1"]:not(:disabled)');
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(300);
      if (chapter === "planning-phases") {
        await page.waitForSelector('[data-guide="phase-deadline"]:not(:disabled)');
        await page.click('[data-guide="phase-deadline"]');
        await page.waitForSelector('[data-guide="run"]');
      }
      await page.keyboard.press("ArrowDown");
      await page.waitForTimeout(300);
      await page.click(chapter === "basics" ? "#basics-run" : '[data-guide="run"]');
      await page.waitForSelector('[data-tutorial-stage="resolution"]');
      await checkOverview();
      await page.waitForSelector('[data-mission-turn="1"].completed', { timeout: 20000 });
      // Freeze on an earlier displayed frame while the live engine is ahead.
      const scrub = value => page.locator("#replay-slider").evaluate((el, value) => {
        el.value = String(value);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }, value);
      await scrub(2);
      assert.equal(await page.locator('[data-mission-turn="1"].current').count(), 1);
      assert.equal(await page.locator('[data-mission-turn].completed').count(), 0);
      await checkOverview();
      const buttons = await page.locator(".replay-actions button").evaluateAll(elements => elements.map(el => {
        const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, height: r.height };
      }));
      assert.equal(buttons.length, 2);
      assert.ok(buttons.every(b => b.height >= 44));
      assert.ok(buttons[1].x - buttons[0].right >= 9 || buttons[1].y - buttons[0].bottom >= 9, JSON.stringify(buttons));
      assert.equal(await page.locator('#replay-play.primary').count(), 1);
      const playLabel = await page.locator('#replay-play').textContent();
      await page.click('#replay-play');
      assert.notEqual(await page.locator('#replay-play').textContent(), playLabel);
      await page.click('#replay-play');
      assert.equal(await page.locator('#replay-play').textContent(), playLabel);
      await scrub(0);
      assert.equal(await page.locator('[data-mission-turn].current, [data-mission-turn].completed').count(), 0);
      await page.click("#live");
      assert.equal(await page.locator('[data-mission-turn="1"].completed').count(), 1);
      await page.click('[data-guide="restart"]');
      assert.equal(await page.locator('[data-mission-turn].current, [data-mission-turn].completed').count(), 0);
      await checkOverview();
      assert.deepEqual(errors, []);
      console.log(`${chapter} ${locale} ${width}: persistent overview, displayed-frame progress, restart, replay spacing OK`);
      await page.close();
    }
  }
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
