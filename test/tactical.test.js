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

// Use genuine engine frames, including reverse playback, rather than a UI counter.
test("fuel rack follows actual resolution/replay fuel and retains empty slots", async () => {
  const { beginResolution, stepResolution } = await import("../src/game/resolution.js");
  const { TRACKS } = await import("../src/game/catalog.js");
  await loadLocale("en");
  await loadLocale("fr");
  let r = beginResolution({
    crewSize: 4, seed: "fuel-rack", threats: [],
    tracks: Object.fromEntries(["red", "white", "blue", "internal"].map(z => [z, TRACKS[0]])),
    programs: Array.from({ length: 4 }, (_, p) => Array.from({ length: 12 }, (_, turn) =>
      p === 0 && turn < 4 ? { actions: [turn === 0 ? "lift" : "B"] } : null)),
  });
  while (!r.outcome && r.turn < 6) r = stepResolution(r);
  assert.deepEqual([...new Set(r.frames.map(f => f.ship.fuel))], [3, 2, 1, 0]);
  for (const locale of ["en", "fr"]) {
    const t = (key, vars) => translate(locale, key, vars);
    const view = createTacticalView({ t, esc: String, zoneName: String, symbol: () => "" });
    const render = ship => view.shipCutaway({ ship, crewLabel: String }).replace(/<template>[\s\S]*?<\/template>/g, "");
    for (const frame of [...r.frames, ...r.frames.toReversed()]) {
      const html = render(frame.ship);
      assert.equal((html.match(/class="fuel-slot filled"/g) ?? []).length, frame.ship.fuel);
      assert.equal((html.match(/class="fuel-slot empty"/g) ?? []).length, 3 - frame.ship.fuel);
      assert.ok(html.includes(`aria-label="${t("tactical.fuel_capsules", { count: frame.ship.fuel })}"`));
      const stern = html.split('<div class="ship-stern">')[1].split('<div class="ship-key">')[0];
      assert.equal((stern.match(/<i>/g) ?? []).length, 6, "side jump thrusters remain");
      if (frame.ship.fuel) assert.ok(stern.includes(pictogram("fuel")));
    }
    assert.equal((render({ ...r.ship, fuel: 4 }).match(/class="fuel-slot filled"/g) ?? []).length, 4);
  }
});

test("energy cells preserve exact capacity, empty and heroic excess in live/replay markup", async () => {
  const { energyCells } = await import('../preview/resource-cells.js');
  for (const locale of ['en', 'fr']) {
    await loadLocale(locale);
    const t = (k, p) => translate(locale, k, p);
    for (const [value, capacity] of [[0, 5], [3, 5], [2, 2], [6, 5], [4, 2]]) {
      const html = energyCells(value, capacity, t);
      assert.equal((html.match(/class="energy-cell /g) || []).length, Math.max(value, capacity));
      assert.equal((html.match(/energy-cell filled/g) || []).length, value);
      assert.equal((html.match(/ excess"/g) || []).length, Math.max(0, value - capacity));
      assert.ok(html.includes(t('tactical.energy_cells', { value, capacity })));
      assert.doesNotMatch(html, />\d/);
    }
    const ship = structuredClone(createLesson('energy', 0).game.initialShip);
    ship.zones.white.reactor = 6;
    ship.zones.red.damage.push('shield');
    const view = createTacticalView({ t, esc: String, zoneName: String, symbol: () => '' });
    const html = view.shipCutaway({ ship, crewLabel: String });
    assert.ok(html.includes(energyCells(6, 5, t)));
    assert.ok(html.includes(energyCells(ship.zones.red.shield, 1, t)));
    assert.match(html, /class="system-caption"><strong>[^<]*<\/strong><span class="energy-value energy-cells"/);
    assert.doesNotMatch(html, /charge-pips/);
  }
});
