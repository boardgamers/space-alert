import test from "node:test";
import assert from "node:assert/strict";
import { createReplay } from "../preview/replay.js";

function transport(start = 0, length = 4) {
  let index = start, count = length, time = 0, busy = false;
  const shown = [];
  const replay = createReplay({
    index: () => index, count: () => count, now: () => time,
    busy: () => busy, show: value => { index = value; shown.push(value); },
  });
  return { replay, shown,
    step(ms = 450) { time += ms; replay.tick(); },
    set busy(value) { busy = value; },
    set count(value) { count = value; },
    set index(value) { index = value; },
  };
}

test("replay from the scrubbed position visits consecutive resolved frames and stays in review", () => {
  const t = transport(1);
  t.replay.play();
  t.step(); t.step(); t.step();
  assert.deepEqual(t.shown, [1, 2, 3]);
  assert.equal(t.replay.playing, false);
});

test("play from live or the final frame replays from the beginning, including completed missions", () => {
  for (const start of [null, 3]) {
    const t = transport(start);
    t.replay.play();
    t.step(); t.step(); t.step(); t.step();
    assert.deepEqual(t.shown, [0, 1, 2, 3]);
    assert.equal(t.replay.playing, false);
  }
});

test("effect busy timing and minimum dwell prevent skipped or interrupted animations", () => {
  const t = transport();
  t.replay.play();
  t.step(449);
  assert.deepEqual(t.shown, [0]);
  t.busy = true;
  t.step(3000);
  assert.deepEqual(t.shown, [0]);
  t.busy = false;
  t.step(1);
  assert.deepEqual(t.shown, [0, 1]);
  t.step(449);
  assert.deepEqual(t.shown, [0, 1]);
  t.step(1);
  assert.deepEqual(t.shown, [0, 1, 2]);
});

test("pause (also used for scrub, reset and destroy) prevents any further frame updates", () => {
  const t = transport();
  t.replay.play(); t.step();
  t.replay.pause(); t.step(10000);
  assert.deepEqual(t.shown, [0, 1]);
  t.index = 2;
  t.replay.play(); t.step();
  assert.deepEqual(t.shown, [0, 1, 2, 3]);
});

test("incoming live frames cannot extend the captured replay horizon", () => {
  const t = transport(0, 3);
  t.replay.play();
  t.count = 20;
  for (let i = 0; i < 25; i++) t.step();
  assert.deepEqual(t.shown, [0, 1, 2]);
  assert.equal(t.replay.playing, false);
});

test("missing/reset frames and single-frame resolutions stop safely", () => {
  const t = transport();
  t.replay.play();
  t.count = 1;
  t.step();
  assert.equal(t.replay.playing, false);
  assert.deepEqual(t.shown, [0]);
  const empty = transport(null, 0), initial = transport(null, 1);
  for (const fixture of [empty, initial]) {
    fixture.replay.play(); fixture.step();
    assert.equal(fixture.replay.playing, false);
    assert.deepEqual(fixture.shown, []);
  }
});

test("replaying resolved snapshots reproduces movement effects without mutating resolution", async () => {
  const { beginResolution, stepResolution } = await import("../src/game/resolution.js");
  const { resolutionEffects } = await import("../preview/resolution-effects.js");
  const { TRACKS } = await import("../src/game/catalog.js");
  let resolution = beginResolution({ crewSize: 1, seed: "replay", turns: 3,
    programs: [[{ actions: ["blue"] }, null, null]], threats: [],
    tracks: Object.fromEntries(["red", "white", "blue", "internal"].map(z => [z, TRACKS[6]])) });
  while (!resolution.outcome) resolution = stepResolution(resolution);
  const original = JSON.stringify(resolution);
  let index = 0, time = 0;
  const events = [];
  const replay = createReplay({ index: () => index,
    count: () => resolution.frames.length, busy: () => false, now: () => time,
    show(next) {
      events.push(...resolutionEffects(resolution, resolution.frames[index], resolution.frames[next]));
      index = next;
    },
  });
  replay.play();
  while (replay.playing) { time += 450; replay.tick(); }
  assert.ok(events.some(e => e.kind === "move" && e.from === "white-upper" && e.to === "blue-upper"));
  assert.equal(index, resolution.frames.length - 1);
  assert.equal(JSON.stringify(resolution), original);
});
