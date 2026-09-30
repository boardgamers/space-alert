import { test } from "node:test";
import assert from "node:assert/strict";
import * as e from "../bgs/engine.js";
import { eventDescription } from "../preview/text.js";
const ctx = (now, extra = {}) => ({
  now,
  gameId: "bgs-test",
  playerIds: ["alice", "bob"],
  present: [0, 1],
  ...extra,
});
const initial = (options = {}) =>
  e.init(2, [], options, "private-seed", 0, ctx(1000));
const launch = (s = initial()) => {
  s = e.move(s, { type: "ready", sequence: 1 }, 0, ctx(1001));
  s = e.move(s, { type: "ready", sequence: 1 }, 1, ctx(1002));
  const start = s.missionStartAt;
  return e.advanceTime(s, ctx(start));
};
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
test("missing readiness keeps the table waiting without player timeouts", () => {
  const s = e.advanceTime(initial(), ctx(121000));
  assert.equal(e.ended(s), false);
  assert.equal(e.cancelled(s), false);
  assert.equal(e.nextWakeup(s), null);
  assert.deepEqual(e.currentPlayer(s), [0, 1]);
});
test("snapshots hide deck, future announcements and other hands from players and spectators", () => {
  const s = e.advanceTime(launch(), ctx(12000));
  for (const seat of [undefined, 0, 1]) {
    const view = e.stripSecret(s, seat, ctx(12100));
    assert.equal(view.serverNow, 12100);
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
      table: {
        id: "table",
        round: 2,
        progress: e.tableProgress(e.dropPlayer(old)),
      },
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

test("disconnect during launch returns to waiting; platform presence never renews consent", () => {
  let s = e.move(initial(), { type: "ready", sequence: 1 }, 0, ctx(1001));
  s = e.move(s, { type: "ready", sequence: 1 }, 1, ctx(1002));
  assert.equal(s.stage, "countdown");
  s = e.presenceChanged(s, [], ctx(9000));
  s = e.advanceTime(s, ctx(9000));
  assert.equal(s.stage, "presence");
  assert.equal(e.ended(s), false);
  assert.equal(s.missionStartAt, null);
  s = e.presenceChanged(s, [0], ctx(13000));
  s = e.move(s, { type: "ready", sequence: 2 }, 0, ctx(13000));
  s = e.advanceTime(s, ctx(133000));
  assert.equal(s.players[0].ready, false);
  assert.equal(e.nextWakeup(s), null);
});
test("expired readiness leaves careers editable and does not start a run", () => {
  let s = e.move(
    initial({ careers: true }),
    { type: "ready", sequence: 1 },
    0,
    ctx(1001),
  );
  assert.equal(s.bgs.explorers.alice.activeRun, null);
  s = e.advanceTime(s, ctx(121002));
  assert.equal(
    e.stripSecret(s, 0, ctx(121002)).explorers.find((x) => x.id === "alice")
      .editable,
    true,
  );
});

test("platform presence gates readiness; user moves cannot spoof it", () => {
  const absent = e.init(2, [], {}, "seed", 0, ctx(1000, { present: [] }));
  assert.throws(
    () => e.move(absent, { type: "ready", sequence: 1 }, 0, ctx(1001)),
    /Reconnect/,
  );
  assert.throws(
    () => e.move(absent, { type: "presence", sequence: 1 }, 0, ctx(1001)),
    /Unsupported/,
  );
  const present = e.presenceChanged(absent, [0], ctx(1002));
  assert.ok(present.revision > absent.revision);
  assert.equal(
    e.presenceChanged(present, [0], ctx(1003)).revision,
    present.revision,
  );
  assert.equal(
    e.move(present, { type: "ready", sequence: 1 }, 0, ctx(1003)).players[0]
      .ready,
    true,
  );
  assert.deepEqual(e.phase(present), { name: "waiting", canLeave: true });
  assert.deepEqual(e.phase(launch()), { name: "playing", canLeave: false });
});
test("career progress is bounded, contains no mission secrets, and rejects unknown schemas", () => {
  const s = e.dropPlayer(initial({ careers: true }));
  s.bgs.explorers.alice.runs = Array.from({ length: 1000 }, (_, i) => ({
    id: `old-${i}`,
    survived: true,
    at: i,
    count: 3,
    limit: 3,
    training: false,
  }));
  const progress = e.tableProgress(s);
  assert.equal(progress.data.explorers.alice.runs.length, 1);
  assert.equal(progress.data.explorers.alice.archive.completed, 999);
  assert.equal(progress.data.explorers.alice.archive.campaigns, 999);
  assert.ok(JSON.stringify(progress).length < 4000);
  assert.ok(!JSON.stringify(progress).includes("private-seed"));
  assert.deepEqual(e.migrateTableProgress(progress), progress);
  assert.throws(
    () => e.migrateTableProgress({ version: 2, data: {} }),
    /Unsupported/,
  );
  const next = e.init(
    2,
    [],
    { careers: true },
    "different-seed",
    0,
    ctx(2000, { table: { id: "table", round: 2, progress } }),
  );
  assert.equal(next.bgs.explorers.alice.archive.completed, 999);
  assert.equal(next.players[0].ready, false);
  assert.equal(next.players[0].lastSequence, 0);
});
