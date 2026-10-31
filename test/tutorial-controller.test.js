import test from "node:test";
import assert from "node:assert/strict";
import { snapshot } from "../src/view.js";
import { createLessonTutorial, completedTurns } from "../src/tutorial-controller.js";

async function place(tutorial, turn, direction) {
  const s = tutorial.snapshot.state;
  const id = s.game.hands[0].find(id => s.game.cards[id].sides.some(side => side.length === 1 && side[0] === direction));
  const side = s.game.cards[id].sides.findIndex(side => side.length === 1 && side[0] === direction);
  assert.equal(await tutorial.play({ type: "program", crew: 0, turn,
    slotVersion: s.game.slotVersions[0][turn - 1], cards: [{ id, side }] }), true, tutorial.snapshot.error);
}

test("BGS tutorial validates moves, saves progress, and restores native checkpoints", async () => {
  const data = new Map();
  const storage = { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) };
  const t = await createLessonTutorial("basics", { storage });
  assert.equal(t.snapshot.step, 0);
  await t.continue();
  await place(t, 1, "blue");
  await place(t, 2, "red");
  assert.equal(snapshot(t.snapshot.state, 0).game.ship.crew[0].station, "white-upper");
  assert.equal(t.snapshot.step, 1);
  await t.play({ type: "practice-phase" });
  await t.play({ type: "practice-phase" });
  assert.equal(t.snapshot.step, 2);
  assert.equal(completedTurns(t.snapshot.state), 0);
  for (let i = 0; i < 10 && completedTurns(t.snapshot.state) < 1; i++)
    assert.equal(await t.play({ type: "resolve" }), true);
  assert.equal(t.snapshot.state.game.resolution.ship.crew[0].station, "blue-upper");
  const restored = await createLessonTutorial("basics", { storage });
  assert.deepEqual(restored.snapshot.state, t.snapshot.state);
  await restored.restartStep();
  assert.equal(restored.snapshot.step, 2);
  assert.equal(completedTurns(restored.snapshot.state), 0);
  assert.ok(restored.snapshot.state.game.programs[0][0].cards.length);
  await restored.previousStep();
  assert.equal(restored.snapshot.step, 1);
  assert.equal(restored.snapshot.state.stage, "programming");
  assert.equal(restored.snapshot.state.game.programs[0][0], null);
  await place(restored, 1, "red");
  restored.destroy(); t.destroy();
});

test("practice clock advances planning only; resolution remains untimed", async () => {
  const t = await createLessonTutorial("basics");
  await t.continue();
  await t.play({ type: "practice-clock", running: true });
  await t.play({ type: "practice-tick", ms: 600000 });
  assert.equal(t.snapshot.step, 2);
  assert.equal(completedTurns(t.snapshot.state), 0);
  await t.play({ type: "practice-tick", ms: 600000 });
  assert.equal(completedTurns(t.snapshot.state), 0);
  t.destroy();
});
