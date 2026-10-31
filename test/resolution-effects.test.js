import test from "node:test";
import assert from "node:assert/strict";
import { beginResolution, stepResolution } from "../src/game/resolution.js";
import { TRACKS } from "../src/game/catalog.js";
import { resolutionEffects } from "../preview/resolution-effects.js";

function mission(program, threats = []) {
  return beginResolution({ crewSize: 1, seed: "effects", turns: 7,
    programs: [Array.from({ length: 7 }, (_, i) => program[i] ? { actions: program[i] } : null)], threats,
    tracks: Object.fromEntries(["red", "white", "blue", "internal"].map(z => [z, TRACKS[6]])) });
}
function next(r) {
  const result = stepResolution(r);
  return [result, resolutionEffects(result, r.frames.at(-1), result.frames.at(-1))];
}

test("movement effects follow actual movement; duplicate snapshots and initial loads are silent", () => {
  let r = mission([["blue"], ["lift"]]);
  let events;
  [r] = next(r);
  [r, events] = next(r);
  assert.deepEqual(events.map(e => [e.kind, e.from, e.to]), [["move", "white-upper", "blue-upper"]]);
  assert.deepEqual(resolutionEffects(r, r.frames.at(-1), r.frames.at(-1)), []);
  assert.deepEqual(resolutionEffects(r, null, r.frames.at(-1)), []);
});

test("lasers use actual hit targets; health and destruction come from damage resolution", () => {
  let r = mission([["A"], ["A"]], [{ cardId: "E1-07", turn: 1, zone: "white" }]);
  let events;
  [r] = next(r);
  [r, events] = next(r);
  assert.equal(events[0].kind, "charge");
  assert.equal(events[0].station, "white-upper");
  [r, events] = next(r);
  const hit = events.find(e => e.kind === "hit");
  assert.equal(hit.threat, 0);
  assert.deepEqual(hit.sources, [{ station: "white-upper", weapon: "laser" }]);
  assert.equal(hit.shield, 2);
  assert.equal(hit.damage, 3);
  assert.equal(r.threats[0].shield, 2, "enemy shield rating is not consumed");
  assert.ok(!events.some(e => e.kind === "destroy"));
  while (!(r.turn === 2 && r.step === "damage")) [r] = next(r);
  [r, events] = next(r);
  assert.deepEqual(events.map(e => e.kind), ["hit", "destroy"]);
});

test("firing before arrival or into another lane is a miss, never a fabricated hit", () => {
  for (const threat of [{ cardId: "E1-07", turn: 2, zone: "white" }, { cardId: "E1-07", turn: 1, zone: "blue" }]) {
    let r = mission([["A"]], [threat]);
    while (r.step !== "damage") [r] = next(r);
    const [resolved, events] = next(r);
    assert.deepEqual(events, [{ kind: "miss", station: "white-upper" }]);
    assert.equal(resolved.threats[0].damage, 0);
  }
});

test("meteoroid impact reports shield absorption and hull damage once", () => {
  let r = mission(Array(7).fill(null), [{ cardId: "E1-10", turn: 6, zone: "white" }]);
  let effects = [];
  while (!r.outcome) {
    const [result, events] = next(r);
    effects.push(...events); r = result;
  }
  const attack = effects.filter(e => e.kind === "attack");
  assert.equal(attack.length, 1);
  assert.equal(attack[0].absorbed, 1);
  assert.equal(attack[0].damage, 4);
  assert.ok(!effects.some(e => e.kind === "direct-damage" || e.kind === "destroy"));
});
