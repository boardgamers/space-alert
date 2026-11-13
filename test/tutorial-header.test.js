import test from "node:test";
import assert from "node:assert/strict";
import { loadLocale, translate } from "../preview/i18n.js";
import { tutorialMissionHeader, missionTurnProgress, updateTutorialMissionProgress } from "../preview/tutorial-header.js";

for (const locale of ["en", "fr"]) {
  test(`basics header stays identical across Discover, Plan and Execute (${locale})`, async () => {
    await loadLocale(locale);
    const discover = tutorialMissionHeader("basics", 0, locale);
    for (const step of [1, 2, 3]) {
      assert.equal(tutorialMissionHeader("basics", step, locale), discover);
    }
    for (const step of [0, 1, 2, 3, 4, 5, 6]) {
      const markup = tutorialMissionHeader("basics", step, locale);
      assert.equal((markup.match(/class="mission-overview"/g) ?? []).length, 1);
      for (const key of ["plan", "lock", "play", "turns"]) {
        assert.ok(markup.includes(translate(locale, `overview.${key}`)));
      }
      const groups = [...markup.matchAll(/class="mission-group [^"]*"[^>]*>(.*?)<\/div>/g)];
      assert.deepEqual(groups.map((group) => [...group[1].matchAll(/<span data-mission-turn="\d+">(\d+)<\/span>/g)].map((n) => +n[1])), [
        [1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11, 12],
      ]);
      assert.ok(markup.includes(translate(locale, "timing.exercise", { turns: 3 })));
      assert.doesNotMatch(markup, /[12]\/2|Practice run|Attempt|Essai/);
      assert.ok(markup.endsWith(`${translate(locale, "timing.exercise", { turns: 3 })}</small>`));
      assert.ok(markup.indexOf('mission-overview') < markup.indexOf('lesson-scope'));
    }
  });
}

test("other chapter headers keep their existing scope and overview visibility", async () => {
  await loadLocale("en");
  assert.match(tutorialMissionHeader("planning-phases", 0, "en"), /mission-overview/);
  for (const locale of ["en", "fr"]) {
    await loadLocale(locale);
    for (const step of [1, 2, 3, 4])
      assert.equal(tutorialMissionHeader("planning-phases", step, locale), tutorialMissionHeader("planning-phases", 0, locale));
  }
  for (const chapter of ["first-shot", "energy"]) {
    const markup = tutorialMissionHeader(chapter, 1, "en");
    assert.match(markup, /lesson-scope/);
    assert.doesNotMatch(markup, /mission-overview|Practice run/);
  }
  assert.equal(tutorialMissionHeader("repairs", 0, "en"), "");
});

// Exercise the engine's actual next-operation frame convention, not a second
// guessed turn counter in the UI.
test("progress follows displayed frames through crew, threats, turn end and replay", async () => {
  const { beginResolution, stepResolution, resolveAll } = await import("../src/game/resolution.js");
  let r = beginResolution({ crewSize: 1, seed: "overview", programs: [[]], threats: [], tracks: {}, turns: 3 });
  assert.deepEqual(missionTurnProgress([]), { completed: new Set(), current: 0 });
  assert.deepEqual(missionTurnProgress(r.frames), { completed: new Set(), current: 0 });
  for (const step of ["crew", "damage", "threats", "computer"]) {
    r = stepResolution(r);
    assert.equal(r.step, step);
    assert.deepEqual(missionTurnProgress(r.frames), { completed: new Set(), current: 1 });
  }
  r = stepResolution(r);
  assert.deepEqual(missionTurnProgress(r.frames), { completed: new Set([1]), current: 0 });
  r = stepResolution(r);
  assert.deepEqual(missionTurnProgress(r.frames), { completed: new Set([1]), current: 2 });
  const full = resolveAll(r).frames;
  assert.ok(missionTurnProgress(full).completed.has(3));
  assert.deepEqual(missionTurnProgress(full.slice(0, 3)), { completed: new Set(), current: 1 }, "scrubbing back must forget future completed turns");
  assert.deepEqual(missionTurnProgress(full.slice(0, 1)), { completed: new Set(), current: 0 });
});

test("progress updates accessible labels and clears old current/completed styles on reset", async () => {
  for (const locale of ["en", "fr"]) {
    await loadLocale(locale);
    const group = { children: [], classList: classes() };
    function classes() {
      const names = new Set();
      return { contains: name => names.has(name), toggle(name, on) { if (on) names.add(name); else names.delete(name); } };
    }
    for (let turn = 1; turn <= 12; turn++) {
      const attrs = new Map();
      group.children.push({ dataset: { missionTurn: String(turn) }, classList: classes(), parentElement: group,
        setAttribute: (name, value) => attrs.set(name, value), removeAttribute: name => attrs.delete(name), attrs });
    }
    const root = { querySelectorAll: () => group.children };
    updateTutorialMissionProgress(root, [{ turn: 1, step: "appear" }, { turn: 2, step: "damage" }], locale);
    assert.equal(group.children[0].classList.contains("completed"), true);
    assert.equal(group.children[0].attrs.get("aria-label"), translate(locale, "overview.turn_completed", { turn: 1 }));
    assert.equal(group.children[1].attrs.get("aria-current"), "step");
    assert.equal(group.children[1].attrs.get("title"), translate(locale, "overview.turn_current", { turn: 2 }));
    assert.equal(group.classList.contains("progressed"), true);
    updateTutorialMissionProgress(root, [], locale);
    for (const cell of group.children) {
      assert.equal(cell.classList.contains("completed"), false);
      assert.equal(cell.classList.contains("current"), false);
      assert.equal(cell.attrs.has("aria-current"), false);
    }
    assert.equal(group.classList.contains("progressed"), false);
  }
});
