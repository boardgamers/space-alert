import test from "node:test";
import assert from "node:assert/strict";
import { pictogram } from "../preview/icons.js";
import { createTacticalView } from "../preview/tactical.js";
import { createLesson } from "../src/tutorials.js";
import { loadLocale, translate } from "../preview/i18n.js";
import { tutorialTextHtml } from "../preview/tutorial-text.js";

test("shared action glyphs have distinct accents without changing their silhouettes", () => {
  for (const [action, accent, shape] of [["A", "fire", "laser"], ["B", "energy", "reactor"], ["C", "systems", "systems"]]) {
    assert.match(pictogram(action), new RegExp(`action-${accent}`));
    assert.equal(pictogram(action).match(/<path.*$/)[0], pictogram(shape).match(/<path.*$/)[0]);
    assert.match(pictogram(action), /aria-hidden="true" focusable="false"/);
  }
  assert.notEqual(pictogram("impact"), pictogram("laser"));
  assert.doesNotMatch(pictogram("impact"), /action-icon/);
});

for (const locale of ["en", "fr"]) {
  test(`${locale}: weapon power is localized, numbered and separate from Fire`, async () => {
    await loadLocale(locale);
    const t = (key, vars) => translate(locale, key, vars);
    const ship = structuredClone(createLesson("energy", 0).game.initialShip);
    ship.zones.red.damage.push("upper-weapon");
    const labels = [];
    const tactical = createTacticalView({ t, esc: String, zoneName: z => z,
      symbol: (icon, label, value) => { labels.push({ icon, label, value }); return `<span role="img" aria-label="${label}">${pictogram(icon)}${value}</span>`; },
    });
    const html = tactical.shipCutaway({ ship, selectedCrew: 0, canPlan: true, crewLabel: id => `Crew ${id + 1}` });
    const powers = labels.filter(s => s.icon === "impact");
    assert.deepEqual(powers.map(s => s.value), [3, 3, 5, 5, 4, 4, 2, 2, 1, 1, 2, 2]);
    for (const { label, value } of powers) {
      assert.equal(label, t("tactical.weapon_power", { power: value }));
      assert.ok(label.includes(String(value)));
      assert.ok(html.includes(`aria-label="${label}"`));
    }
    assert.match(html, /class="ship-zones" aria-hidden="true"/);
    assert.equal((html.match(/data-station=/g) ?? []).length, 6);
    assert.ok(tutorialTextHtml("[[action:weapons]] [[action:energy]] [[action:systems]]", locale).includes(pictogram("A")));
  });
}
