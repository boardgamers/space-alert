import { test } from "node:test";
import assert from "node:assert/strict";
import * as e from "../bgs/engine.js";
import { eventDescription } from "../preview/text.js";
const ctx = (now, extra = {}) => ({
  now,
  gameId: "bgs-test",
  playerIds: ["alice", "bob"],
  ...extra,
});
const initial = (options = {}) =>
  e.init(2, [], options, "private-seed", 0, ctx(1000));
const launch = (s = initial()) =>
  e.move(
    e.move(s, { type: "ready", sequence: 1 }, 0, ctx(1001)),
    { type: "ready", sequence: 1 },
    1,
    ctx(1002),
  );
test("requires a trusted server timestamp and ignores client clock claims", () => {
  assert.throws(() => e.init(2, [], {}, "seed", 0), /server clock/);
  assert.throws(
    () =>
      e.move(initial(), { type: "ready", sequence: 1, now: 500 }, 0, ctx(1001)),
    { name: "InvalidMoveError" },
  );
  assert.throws(
    () => e.move(initial(), { type: "ready", sequence: 1 }, 7, ctx(1001)),
    { name: "InvalidMoveError" },
  );
});
test("catches up while disconnected, leaves resolution untimed, and repeats safely", () => {
  const launched = launch();
  const closed = e.advanceTime(launched, ctx(900000));
  assert.equal(closed.stage, "resolution");
  assert.equal(e.nextWakeup(closed), null);
  assert.equal(e.ended(closed), false);
  assert.deepEqual(e.advanceTime(closed, ctx(900000)), closed);
  assert.throws(
    () =>
      e.move(
        closed,
        { type: "place", sequence: 2, crew: 0, turn: 1, cards: [] },
        0,
        ctx(900000),
      ),
    { name: "InvalidMoveError" },
  );
  const resolved = e.move(
    closed,
    { type: "resolve", sequence: 2, all: true },
    0,
    ctx(900001),
  );
  for (const event of resolved.game.resolution.log)
    for (const lang of ["fr", "en"])
      assert.doesNotThrow(() =>
        eventDescription(event, lang, resolved.game.resolution.threats),
      );
  assert.equal(e.ended(resolved), true);
  assert.equal(e.scores(resolved)[0], e.scores(resolved)[1]);
});
test("missing readiness cancels without inventing player timeouts", () => {
  const s = e.advanceTime(initial(), ctx(121000));
  assert.equal(e.ended(s), true);
  assert.equal(e.cancelled(s), true);
  assert.equal(e.nextWakeup(s), null);
  assert.deepEqual(e.currentPlayer(s), []);
});
test("snapshots hide deck, future announcements and other hands from players and spectators", () => {
  const s = e.advanceTime(launch(), ctx(4010));
  for (const seat of [undefined, 0, 1]) {
    const view = e.stripSecret(s, seat, ctx(4100));
    assert.equal(view.serverNow, 4100);
    assert.equal(view.timeline, undefined);
    assert.equal(view.bgs.playerIds, undefined);
    assert.equal(view.game.seed, undefined);
    assert.ok(!JSON.stringify(view).includes("private-seed"));
    if (seat === undefined) assert.equal(view.nextSequence, null);
  }
});
test("careers carry by account across reordered seats, and only their owner can change them", () => {
  const old = initial({ careers: true });
  old.bgs.explorers.alice.level = 1;
  old.bgs.explorers.alice.xp = 8;
  const next = e.init(
    2,
    [],
    { careers: true },
    "new-seed",
    1,
    ctx(2000, {
      playerIds: ["bob", "alice"],
      previous: { state: old, gameId: "old", playerIds: ["alice", "bob"] },
    }),
  );
  const teammateReady = e.move(
    next,
    { type: "ready", sequence: 1 },
    0,
    ctx(2000),
  );
  const learned = e.move(
    teammateReady,
    { type: "career", action: "learn", specialization: "medic", sequence: 1 },
    1,
    ctx(2001),
  );
  assert.equal(learned.bgs.explorers.alice.specializations.medic, 1);
  assert.deepEqual(learned.bgs.explorers.bob.specializations, {});
  assert.throws(
    () =>
      e.move(
        next,
        {
          type: "career",
          action: "learn",
          specialization: "medic",
          id: "alice",
          sequence: 1,
        },
        0,
        ctx(2001),
      ),
    { name: "InvalidMoveError" },
  );
  assert.equal(old.bgs.explorers.alice.specializations.medic, undefined);
});
test("a dropped player ends the cooperative session and unlocks explorer records", () => {
  const s = launch(initial({ careers: true }));
  const cancelled = e.dropPlayer(s);
  assert.equal(e.cancelled(cancelled), true);
  assert.ok(
    Object.values(cancelled.bgs.explorers).every((p) => p.activeRun === null),
  );
});
