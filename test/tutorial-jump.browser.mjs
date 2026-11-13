// Optional: PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node test/tutorial-jump.browser.mjs
// Real tutorial controller and playback, isolated server with no persistence.
import assert from 'node:assert/strict';
import { createPreviewServer } from '../preview/server.js';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server = createPreviewServer();
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ headless: true });
  for (const reducedMotion of ['no-preference', 'reduce']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      window.jumpQA = { starts: 0, finishes: 0, cancelled: 0, seals: 0 };
      const animate = Element.prototype.animate;
      Element.prototype.animate = function(frames, options) {
        const animation = animate.call(this, frames, options);
        if (this.matches('.ship-vessel') && options.duration === 2800) {
          jumpQA.starts++;
          animation.finished.then(() => jumpQA.finishes++, () => jumpQA.cancelled++);
        }
        return animation;
      };
      new MutationObserver(records => {
        for (const record of records) for (const node of record.addedNodes)
          if (node.nodeType === 1 && node.matches('.fx-jump-success')) jumpQA.seals++;
      }).observe(document, { childList: true, subtree: true });
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/learn?chapter=planning-phases&locale=en`);
    await page.click('[data-guide="continue"]');
    await page.click('[data-guide="phase-clock"]');
    await page.waitForSelector('#program [data-turn="1"]:not(:disabled)');
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(300);
    await page.click('[data-guide="phase-deadline"]');
    await page.waitForSelector('[data-guide="run"]');
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(300);
    await page.click('[data-guide="run"]');
    await page.waitForSelector('.fx-jump-success', { timeout: 90000 });
    assert.match(await page.locator('.native-guide').innerText(), /Exercise complete/);
    assert.equal(await page.locator('[data-mission-turn].completed').count(), 7);
    assert.equal(await page.locator('[data-mission-turn="8"].completed, [data-mission-turn="8"].current').count(), 0);
    if (reducedMotion === 'reduce') {
      assert.equal(await page.locator('.ship-vessel').evaluate(el => el.getAnimations().length), 0);
      assert.equal(await page.locator('.fx-jump-success').evaluate(el => el.getAnimations().length), 0);
    }
    await page.waitForTimeout(3200);
    const expected = count => ({ starts: reducedMotion === 'reduce' ? 0 : count, finishes: reducedMotion === 'reduce' ? 0 : count, cancelled: 0, seals: count });
    assert.deepEqual(await page.evaluate(() => jumpQA), expected(1));
    // Scrubbing to a result is silent; then play the actual final transition.
    const end = Number(await page.locator('#replay-slider').getAttribute('max'));
    const scrub = value => page.locator('#replay-slider').evaluate((el, value) => {
      el.value = String(value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);
    await scrub(end);
    await page.waitForTimeout(300);
    assert.deepEqual(await page.evaluate(() => jumpQA), expected(1));
    await scrub(end - 1);
    await page.click('#replay-play');
    await page.waitForSelector('.fx-jump-success');
    await page.waitForTimeout(3500);
    assert.deepEqual(await page.evaluate(() => jumpQA), expected(2));
    await page.click('#live');
    await page.waitForTimeout(500);
    assert.deepEqual(await page.evaluate(() => jumpQA), expected(2));
    await page.click('[data-guide="restart"]');
    assert.equal(await page.locator('.ship-jump-effects').count(), 0);
    assert.equal(await page.locator('[data-mission-turn].completed').count(), 0);
    assert.deepEqual(errors, []);
    console.log(`${reducedMotion}: tutorial 2 completes, jump finishes once, replay ends once, scrub/live/reset silent`);
    await page.close();
  }
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
