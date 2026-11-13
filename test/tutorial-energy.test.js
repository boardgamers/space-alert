import { energyCells, fuelRack } from "../preview/resource-cells.js";
import test from "node:test";
import assert from "node:assert/strict";
import { loadLocale, translate } from "../preview/i18n.js";
import { energyDiscovery, ENERGY_DEMOS } from "../preview/tutorial-energy.js";

for (const locale of ["en", "fr"]) {
  test(`energy Discover has four short illustrated examples (${locale})`, async () => {
    await loadLocale(locale);
    assert.deepEqual(ENERGY_DEMOS.map(demo => demo.id), ["shot", "refill", "shield", "side"]);
    for (const [index, demo] of ENERGY_DEMOS.entries()) {
      const html = energyDiscovery(index, locale);
      for (const [icon, , before, after, capacity] of demo.rows) {
        if (after === undefined) assert.ok(html.includes(`<strong>${before}</strong>`));
        else for (const value of [before, after]) assert.ok(html.includes(icon === 'fuel' ? fuelRack(value, (k, p) => translate(locale, k, p)) : energyCells(value, capacity, (k, p) => translate(locale, k, p))));
      }
      assert.doesNotMatch(html, />\d+\/\d+ →/);
      assert.ok(html.includes(translate(locale, `energy.demo.${demo.id}.title`)));
      assert.ok(translate(locale, `energy.demo.${demo.id}.text`).length < 210);
      assert.doesNotMatch(html, /Illustration/);
      assert.match(html, /tabindex="-1"/);
      assert.match(html, /aria-live="polite"/);
      assert.doesNotMatch(html, /\[\[action:/);

      assert.equal(html.includes(`data-energy-demo="${index + 1}"`), index < 3);
    }
    assert.match(energyDiscovery(0, locale), /data-energy-demo="-1"[^>]*disabled/);


  });
}
