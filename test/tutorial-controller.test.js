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

for (const route of [["blue", "lift"], ["lift", "blue"], ["blue", "red"], ["red", "lift"]]) {
  test(`navigation lesson checks the resolved destination: ${route.join(", ")}`, async () => {
    const t = await createLessonTutorial("basics");
    await t.continue();
    await place(t, 1, route[0]);
    await place(t, 2, route[1]);
    assert.equal(t.snapshot.completed, false);
    await t.play({ type: "practice-phase" });
    await t.play({ type: "practice-phase" });
    for (let i = 0; i < 30 && completedTurns(t.snapshot.state) < 3; i++)
      assert.equal(await t.play({ type: "resolve" }), true, t.snapshot.error);
    const succeeds = route.includes("blue") && route.includes("lift");
    assert.equal(t.snapshot.completed, succeeds);
    assert.equal(t.snapshot.state.game.resolution.ship.crew[0].station === "blue-lower", succeeds);
    if (!succeeds) {
      await t.previousStep();
      assert.equal(t.snapshot.state.stage, "programming");
      assert.equal(t.snapshot.step, 1);
    }
    t.destroy();
  });
}

test("BGS chapter metadata accepts the progress version emitted by every tutorial", async () => {
  const { readFile } = await import("node:fs/promises");
  const info = JSON.parse(await readFile(new URL("../bgs/gameinfo.json", import.meta.url)));
  for (const chapter of info.version.tutorial.chapters) {
    let progress;
    const tutorial = await createLessonTutorial(chapter.id, { onProgress: value => { progress = value; } });
    await tutorial.continue();
    assert.equal(progress.id, chapter.id);
    assert.equal(progress.version, chapter.version);
    tutorial.destroy();
  }
});

test("every chapter can plan, execute, complete, and replay through native controls", async () => {
  const { LESSONS } = await import("../src/tutorials.js");
  for (const lesson of LESSONS) {
    const tutorial = await createLessonTutorial(lesson.id);
    await tutorial.continue();
    if (lesson.basics) {
      await place(tutorial, 1, "blue");
      await place(tutorial, 2, "lift");
    } else if (lesson.id === "first-shot") {
      await place(tutorial, 2, "A");
      await place(tutorial, 3, "A");
    }
    while (tutorial.snapshot.state.stage === "programming")
      assert.equal(await tutorial.play({ type: "practice-phase" }), true, lesson.id);
    for (let i = 0; i < 200 && !tutorial.snapshot.completed; i++)
      assert.equal(await tutorial.play({ type: "resolve" }), true, lesson.id);
    assert.equal(tutorial.snapshot.completed, true, lesson.id);
    await tutorial.previousStep();
    assert.equal(tutorial.snapshot.completed, false, lesson.id);
    assert.equal(completedTurns(tutorial.snapshot.state), 0, lesson.id);
    tutorial.destroy();
  }
});

test("first shot stops on target destruction at turn 3, and preserves new and legacy saves", async () => {
  for (const objective of [true, false]) {
    const data = new Map();
    const storage = { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) };
    const tutorial = await createLessonTutorial("first-shot", { storage });
    await tutorial.continue();
    await place(tutorial, 2, "A");
    await place(tutorial, 3, "A");
    if (objective) await tutorial.play({ type: "practice-run" });
    else while (tutorial.snapshot.state.stage === "programming") await tutorial.play({ type: "practice-phase" });
    for (let i = 0; i < 100 && !tutorial.snapshot.completed; i++)
      assert.equal(await tutorial.play({ type: "resolve" }), true);
    assert.equal(tutorial.snapshot.completed, true);
    const resolution = tutorial.snapshot.state.game.resolution;
    if (objective) {
      assert.equal(resolution.turn, 3);
      assert.equal(resolution.step, "threats");
      assert.equal(resolution.outcome, null);
      assert.equal(resolution.threats[0].status, "destroyed");
    } else assert.ok(resolution.outcome);
    const restored = await createLessonTutorial("first-shot", { storage });
    assert.equal(restored.snapshot.completed, true);
    assert.deepEqual(restored.snapshot.state, tutorial.snapshot.state);
    restored.destroy(); tutorial.destroy();
  }
});

test("the clock demonstration waits until the actual planning deadline before resolution", async () => {
  const tutorial = await createLessonTutorial("basics");
  await tutorial.continue();
  await place(tutorial, 1, "blue");
  await place(tutorial, 2, "lift");
  await tutorial.play({ type: "practice-deadline" });
  assert.equal(tutorial.snapshot.state.stage, "programming");
  assert.equal(snapshot(tutorial.snapshot.state, 0).game.ship.crew[0].station, "white-upper");
  assert.equal(completedTurns(tutorial.snapshot.state), 0);
  await tutorial.play({ type: "practice-tick", ms: 4999 });
  assert.equal(tutorial.snapshot.state.stage, "programming");
  await tutorial.play({ type: "practice-tick", ms: 1 });
  assert.equal(tutorial.snapshot.state.stage, "resolution");
  assert.equal(completedTurns(tutorial.snapshot.state), 0);
  tutorial.destroy();
});
