import test from "node:test";
import assert from "node:assert/strict";
import { plannedRoute } from "../preview/program-route.js";
const slot = (...actions) => ({ cards: [{ sides: [actions], side: 0 }] });

test("intended route follows moves, waits and room-dependent actions without changing the program", () => {
  const program = [
    slot("blue"),
    slot("lift"),
    slot("A"),
    null,
    slot("red", "red"),
    slot("red"),
  ];
  const original = structuredClone(program);
  assert.deepEqual(plannedRoute(program), [
    "blue-upper",
    "blue-lower",
    "blue-lower",
    "blue-lower",
    "red-lower",
    "red-lower",
  ]);
  assert.deepEqual(program, original);
});
test("heroic movement and ordered multi-card actions use their actual directions", () => {
  const combined = {
    cards: [...slot("hero:blue").cards, ...slot("lift").cards],
  };
  assert.deepEqual(
    plannedRoute([combined, slot("teleport:red-upper"), slot("blue", "A")]),
    ["blue-lower", "red-upper", "white-upper"],
  );
});
test("hidden cards and movement depending on other actors stop the route without exposing information", () => {
  assert.deepEqual(
    plannedRoute([
      slot("blue"),
      { cards: [{ category: "movement" }] },
      slot("A"),
    ]),
    ["blue-upper", null, null],
  );
  assert.deepEqual(plannedRoute([slot("red"), slot("C"), slot("blue")]), [
    "red-upper",
    null,
    null,
  ]);
  assert.deepEqual(
    plannedRoute([slot("special:teleporter:basic"), slot("lift")]),
    [null, null],
  );
});
