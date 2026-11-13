import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { loadLocale, translate } from "../preview/i18n.js";
import { tutorialTextParts, tutorialTextPlain, tutorialTextHtml } from "../preview/tutorial-text.js";
import { pictogram, equipmentPicture } from "../preview/icons.js";
import { LESSONS } from "../src/tutorials.js";
import { createLessonTutorial } from "../src/tutorial-controller.js";

for (const locale of ["en", "fr"]) {
  test(`${locale}: every chapter has safe action copy and controller fallback`, async () => {
    await loadLocale(locale);
    const catalog = JSON.parse(await readFile(new URL(`../preview/locales/${locale}.json`, import.meta.url)));
    const en = JSON.parse(await readFile(new URL("../preview/locales/en.json", import.meta.url)));
    for (const [key, text] of Object.entries(catalog).filter(([key]) => /^(lesson\.|tutorial_controller\.|timing\.|phases\.|basics\.)/.test(key))) {
      assert.doesNotMatch(text, /\b[BC]\b|\bA[, /]|perform A\b/, key);
      // The ship's aria-label deliberately remains descriptive plain text.
      if (key !== "basics.the_ship_android_1_s_actual_position")
        assert.doesNotMatch(text, /(?:android|androïde)\s+\d/i, key);
      const tokens = (s) => [...s.matchAll(/\[\[(?:action|crew):[^\]]+\]\]/g)].map(m => m[0]).sort();
      assert.deepEqual(tokens(text), tokens(en[key]), key);
      assert.doesNotMatch(tutorialTextPlain(text, locale), /\[\[(?:action|crew):/, key);
    }
    for (const lesson of LESSONS) {
      const controller = await createLessonTutorial(lesson.id, { locale });
      assert.doesNotMatch(controller.snapshot.text, /\[\[(?:action|crew):/);
      await controller.continue();
      assert.doesNotMatch(controller.snapshot.text, /\[\[(?:action|crew):/);
      controller.destroy();
    }
    const repairs = translate(locale, "lesson.repairs.instruction.1");
    const parts = tutorialTextParts(repairs, locale).filter(p => p.type === "action");
    assert.equal(parts.length, 2);
    assert.ok(parts.every(p => p.icon === "B" && p.label === translate(locale, "app.energy")));
    assert.ok(tutorialTextHtml(repairs, locale).includes(pictogram("B")));
    assert.ok(tutorialTextHtml(repairs, locale).includes(`aria-label="${translate(locale, "app.energy")}"`));
    const rich = await createLessonTutorial("energy", { locale, formatText: text => text });
    assert.match(rich.snapshot.text, /\[\[(?:action|crew):energy\]\]/);
    rich.destroy();
  });
}

test("tutorial rendering escapes markup and only renders whitelisted pictograms", async () => {
  await loadLocale("en");
  const html = tutorialTextHtml('<img src=x onerror="bad()"> & [[action:energy]] [[action:evil]]', "en");
  assert.doesNotMatch(html, /<img|onerror="bad/);
  assert.match(html, /&lt;img/);
  assert.match(html, /&amp;/);
  assert.match(html, /\[\[(?:action|crew):evil\]\]/);
  assert.equal((html.match(/<svg/g) ?? []).length, 1);
});

test("energy and repairs explain transfer limits, fuel, and replacement actions", async () => {
  await loadLocale("en");
  const energy = translate("en", "lesson.energy.instruction.0");
  assert.match(energy, /same-zone reactor/);
  assert.match(energy, /enough to fill the shield, limited by the reactor/);
  assert.match(energy, /consumes one fuel capsule/);
  assert.match(energy, /transfers use no fuel capsule/);
  const repairs = translate("en", "lesson.repairs.instruction.1");
  assert.match(repairs, /instead of recharging/);
  assert.match(repairs, /Three repair actions eliminate it/);
});

for (const locale of ["en", "fr"]) {
  test(`${locale}: tutorial crew tokens use the ship android and localized accessible names`, async () => {
    await loadLocale(locale);
    const copy = translate(locale, "lesson.energy.instruction.1");
    assert.doesNotMatch(copy, /Android|Androïde/);
    const parts = tutorialTextParts(copy, locale).filter(p => p.type === "crew");
    assert.deepEqual(parts.map(p => p.number), ["1", "3"]);
    const html = tutorialTextHtml(copy, locale);
    assert.equal(html.split(equipmentPicture("android")).length - 1, 2);
    for (const n of [1, 3]) {
      const label = `${translate(locale, "app.android")} ${n}`;
      assert.ok(html.includes(`role="img" aria-label="${label}"`));
      assert.ok(html.includes(`<b aria-hidden="true">${n}</b>`));
      assert.ok(tutorialTextPlain(copy, locale).includes(label));
    }
    const controller = await createLessonTutorial("energy", { locale });
    await controller.continue();
    assert.ok(controller.snapshot.text.includes(`${translate(locale, "app.android")} 3`));
    controller.destroy();
  });
}

test("crew tokens reject arbitrary names, numbers and markup", async () => {
  await loadLocale("en");
  for (const token of ["[[crew:android:0]]", "[[crew:android:6]]", "[[crew:robot:1]]", "[[crew:android:1 onclick=bad]]"]) {
    assert.equal(tutorialTextHtml(token, "en"), token);
    assert.equal(tutorialTextPlain(token, "en"), token);
  }
  assert.doesNotMatch(tutorialTextHtml('[[crew:android:<img src=x>]]', "en"), /<img/);
});
