// Optional: PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node test/tutorial-energy.browser.mjs
import assert from "node:assert/strict";
import { createPreviewServer } from "../preview/server.js";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const server = createPreviewServer();
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
let browser;
try {
  browser = await chromium.launch({ headless: true });
  for (const [locale, width] of [["en", 1280], ["fr", 380], ["fr", 320]]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/learn?chapter=energy&locale=${locale}`);
    await page.waitForSelector(".energy-discovery");
    const before = await page.evaluate(() => JSON.stringify(localStorage));
    for (let i = 0; i < 4; i++) {
      assert.equal(await page.locator('.energy-demo-diagram .energy-cells').count(), i < 2 ? 2 : 4);
      assert.doesNotMatch(await page.locator('.energy-demo-diagram').innerText(), /\d+\/\d+/);
      if (i === 0) await page.screenshot({ path: `/tmp/space-alert-cells-demo-${locale}-${width}.png` });
      assert.equal(await page.locator('[data-tutorial-step="0"]').count(), 1);
      assert.equal(await page.locator('[data-guide="continue"]').count(), i === 3 ? 1 : 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      if (i < 3) {
        await page.click(`[data-energy-demo="${i + 1}"]`);
        assert.equal(await page.locator(".energy-discovery h2").evaluate(el => el === document.activeElement), true);
      }
    }
    assert.equal(await page.evaluate(() => JSON.stringify(localStorage)), before, "demos must not save controller progress");
    await page.click('[data-energy-demo="2"]');
    await page.locator('[data-energy-demo="3"]').focus();
    await page.keyboard.press("Enter");
    await page.click('[data-guide="continue"]');
    await page.waitForSelector('[data-tutorial-step="1"]');
    assert.equal(await page.locator(".energy-discovery").count(), 0);
    // The energy lesson hides the resource strip, not the authoritative fuel rack.
    assert.equal(await page.locator('#resources').isVisible(), false);
    assert.equal(await page.locator('.fuel-rack').isVisible(), true);
    assert.equal(await page.locator('.fuel-slot.filled').count(), 3);
    assert.equal(await page.locator('.ship-stern i').count(), 6);
    assert.equal(await page.locator('.fuel-rack').getAttribute('aria-label'), locale === 'fr'
      ? 'Capsules de carburant restantes : 3' : 'Fuel capsules remaining: 3');
    const cellSizes = await page.locator('.energy-system .energy-cell').evaluateAll(cells => cells.map(cell => ({ width: cell.getBoundingClientRect().width, height: cell.getBoundingClientRect().height })));
    assert.ok(cellSizes.length > 0);
    assert.ok(cellSizes.every(cell => cell.width === 10 && cell.height === 17), 'empty and filled cells have identical usable dimensions');
    const rack = await page.locator('.fuel-rack').boundingBox();
    const reactor = await page.locator('[data-station="white-lower"] .energy-system').boundingBox();
    assert.ok(rack.y >= reactor.y + reactor.height, 'rack is below central reactor');
    assert.ok(Math.abs(rack.x + rack.width / 2 - reactor.x - reactor.width / 2) < 5, 'rack aligns with central reactor');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.locator('.fuel-rack').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `/tmp/space-alert-cells-ship-${locale}-${width}.png` });
    await page.click('[data-guide="previous"]');
    await page.waitForSelector(".energy-discovery");
    await page.click('[data-guide="restart"]');
    await page.waitForSelector('[data-energy-demo="-1"]:disabled');
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log("Energy Discover: EN/FR desktop/mobile, keyboard, back/restart and progress isolation passed");
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
