import test from "node:test";
import assert from "node:assert/strict";
import { forecastMovement, checkpointAppearance } from "../preview/threat-track.js";
import { THREATS, TRACKS } from "../src/game/catalog.js";
import { beginResolution, stepResolution } from "../src/game/resolution.js";

function scenario(id) {
  return beginResolution({ crewSize: 4, seed: "track-forecast", programs: Array.from({ length: 4 }, () => Array(12).fill(null)),
    threats: [{ cardId: id, turn: 2, zone: "white" }],
    tracks: Object.fromEntries(["red", "white", "blue", "internal"].map(zone => [zone, TRACKS[6]])) });
}

test("distance groups match actual constant speed, checkpoint acceleration, and per-turn acceleration", () => {
  for (const id of ["E1-07", "E1-10", "E2-01", "SE2-04", "SE3-107", "E3-109"]) {
    let r = scenario(id);
    const original = structuredClone(r);
    const groups = forecastMovement(r.threats[0], TRACKS[6]);
    assert.deepEqual(r, original, "forecast leaves game state untouched");
    for (const group of groups) {
      while (!r.outcome && !(r.turn === group.turn && r.step === "threats")) r = stepResolution(r);
      if (r.outcome) break;
      const start = r.threats[0].positionOnTrack;
      r = stepResolution(r);
      assert.equal(group.positions[0], start - 1, id);
      assert.equal(group.positions.at(-1), r.threats[0].positionOnTrack, `${id} at turn ${group.turn}`);
    }
  }
});

test("natural slowdown applies on the next turn, even when multiple checkpoints are crossed", () => {
  let r = scenario("E1-07");
  r.threats[0].effects.X = [{ type: "change", stat: "speed", amount: -2 }];
  const groups = forecastMovement(r.threats[0], TRACKS[6]);
  assert.deepEqual(groups.slice(0, 4).map(g => g.positions), [[15,14,13], [12,11,10], [9], [8]]);
  for (const group of groups.slice(0, 5)) {
    while (!(r.turn === group.turn && r.step === "threats")) r = stepResolution(r);
    r = stepResolution(r);
    assert.equal(group.positions.at(-1), r.threats[0].positionOnTrack);
  }
});

test("forecast rebases on the displayed resolution frame without replaying the current movement", () => {
  let r = scenario("E2-01");
  while (!(r.turn === 3 && r.step === "threats")) r = stepResolution(r);
  assert.equal(forecastMovement(r.threats[0], TRACKS[6], r)[0].turn, 3);
  r = stepResolution(r);
  const group = forecastMovement(r.threats[0], TRACKS[6], r)[0];
  assert.equal(group.turn, 4);
  assert.equal(group.positions[0], r.threats[0].positionOnTrack - 1);
  assert.equal(forecastMovement({ ...r.threats[0], status: "destroyed" }, TRACKS[6], r).length, 0);
});

test("crew-dependent slowdown is not assumed and uncertain trajectory changes stop the forecast", () => {
  const snake = { ...structuredClone(THREATS.find(t => t.id === "E3-109")), turn: 1 };
  assert.equal(forecastMovement(snake, TRACKS[6])[0].positions.length, 4);
  snake.effects.X = [{ type: "jump", direction: "left" }];
  const groups = forecastMovement(snake, TRACKS[6]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].positions.at(-1), 12);
  const other = { instance: 8, effects: { X: [{ type: "advance-others" }] } };
  assert.deepEqual(forecastMovement(snake, TRACKS[6], { threats: [other] }), []);
});

test("meteoroid empty checkpoints have no symbols and impact follows remaining health", () => {
  const meteor = structuredClone(THREATS.find(t => t.id === "E1-10"));
  assert.equal(checkpointAppearance(meteor, meteor.effects.X), null);
  assert.equal(checkpointAppearance(meteor, meteor.effects.Y), null);
  assert.deepEqual(checkpointAppearance(meteor, meteor.effects.Z), { icon: "impact", value: 5 });
  meteor.damage = 3;
  assert.deepEqual(checkpointAppearance(meteor, meteor.effects.Z), { icon: "impact", value: 2 });
});
