import test from "node:test";
import assert from "node:assert/strict";
import { LESSONS, createLesson } from "../src/tutorials.js";
import { submit, advanceClock } from "../src/session.js";
import {
  traitDescriptions,
  effectDescription,
  eventDescription,
} from "../preview/text.js";
import { THREATS } from "../src/game/catalog.js";
function program(s, crew, turn, actions) {
  const g = s.game;
  const id = [...g.hands[0], ...g.androidCards].find(
    (id) =>
      (g.cards[id].owner === undefined || g.cards[id].owner === crew) &&
      g.cards[id].sides.some(
        (a) => JSON.stringify(a) === JSON.stringify(actions),
      ),
  );
  assert.ok(id, `Missing ${actions}`);
  const side = g.cards[id].sides.findIndex(
    (a) => JSON.stringify(a) === JSON.stringify(actions),
  );
  const result = submit(
    s,
    0,
    {
      type: "program",
      sequence: s.players[0].lastSequence + 1,
      crew,
      turn,
      slotVersion: g.slotVersions[crew][turn - 1],
      cards: [{ id, side }],
    },
    s.observedAt,
  );
  assert.equal(result.accepted, true, result.error);
  return result.state;
}
const next = (s) =>
  advanceClock(s, s.missionStartAt + s.mission.phaseEndsMs[s.phase - 1]);
function resolve(s) {
  while (s.stage === "programming") s = next(s);
  return submit(
    s,
    0,
    { type: "resolve", all: true, sequence: s.players[0].lastSequence + 1 },
    s.observedAt,
  ).state.game.resolution;
}
test("all lessons preserve physical cards and resolve through the real engine", () => {
  for (const l of LESSONS) {
    const s = createLesson(l.id, 1000);
    const ids = [
      ...s.game.hands[0],
      ...s.game.androidCards,
      ...s.game.programs
        .flat()
        .filter(Boolean)
        .flatMap((x) => x.cards.map((c) => c.id)),
    ];
    assert.equal(new Set(ids).size, ids.length, l.id);
    assert.ok(resolve(s).outcome);
  }
});
test("first-shot exercise destroys the fighter with the recommended two shots", () => {
  let s = createLesson("first-shot", 0);
  s = program(s, 0, 2, ["A"]);
  s = program(s, 0, 3, ["A"]);
  const r = resolve(s);
  assert.equal(r.threats[0].status, "destroyed");
  assert.equal(r.ship.zones.white.damage.length, 0);
});
test("energy exercise demonstrates the fourth shot failing without refueling", () => {
  function run(refill) {
    let s = createLesson("energy", 0);
    for (const n of [1, 2, 3]) s = program(s, 0, n, ["A"]);
    if (refill) {
      s = program(s, 2, 1, ["lift"]);
      s = program(s, 2, 2, ["B"]);
    }
    s = next(s);
    s = program(s, 0, 4, ["A"]);
    return resolve(s);
  }
  assert.equal(run(false).log.filter((e) => e.type === "fire").length, 3);
  const r = run(true);
  assert.equal(r.log.filter((e) => e.type === "fire").length, 4);
  assert.equal(r.ship.fuel, 2);
});
test("repair exercise fixes Hacked Shields before its terminal effect", () => {
  let s = createLesson("repairs", 0);
  s = program(s, 0, 1, ["blue"]);
  s = program(s, 0, 2, ["B"]);
  s = program(s, 0, 3, ["B"]);
  s = next(s);
  s = program(s, 0, 4, ["B"]);
  const r = resolve(s);
  assert.equal(r.threats[0].status, "destroyed");
  assert.equal(r.log.filter((e) => e.type === "repair").length, 3);
});
test("every catalogue effect has explanatory FR and EN text, and replay names work", () => {
  for (const t of THREATS)
    for (const locale of ["fr", "en"]) {
      for (const e of Object.values(t.effects).flat())
        assert.notEqual(
          effectDescription(e, locale),
          e.type,
          `${t.id}/${e.type}/${locale}`,
        );
      assert.ok(
        traitDescriptions(t, locale).every((s) => typeof s === "string"),
      );
    }
  assert.match(
    eventDescription({ type: "threat-destroyed", threat: 0 }, "fr", [
      { instance: 0, name: "Fighter" },
    ]),
    /Fighter/,
  );
});
