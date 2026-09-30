import assert from "node:assert/strict";
import test from "node:test";
import {
  missionSummaries,
  getMission,
  compileTimeline,
  missionSource,
} from "../src/missions.js";
import {
  createSession,
  advanceClock,
  nextWakeup,
  submit,
  snapshot,
  canEditTurn,
} from "../src/session.js";

const epoch = 1_000_000;
const mission = {
  id: "fixture",
  title: "Fixture",
  doubleActions: false,
  phaseEndsMs: [100_000, 200_000, 300_000],
  events: [
    {
      atMs: 10_000,
      type: "threat",
      confirmed: true,
      zone: "red",
      severity: "normal",
      position: "external",
      turn: 2,
    },
    {
      atMs: 12_000,
      type: "threat",
      confirmed: false,
      zone: "blue",
      severity: "serious",
      position: "external",
      turn: 3,
    },
    { atMs: 20_000, type: "communications-down" },
    { atMs: 30_000, type: "communications-restored" },
    { atMs: 40_000, type: "data-transfer", durationMs: 15_000 },
  ],
};
const create = (players = 4, m = mission) =>
  createSession({ players, mission: m }, epoch);
function ready(state, at = epoch + 1000) {
  for (let seat = 0; seat < state.players.length; seat++) {
    const result = submit(state, seat, { type: "ready", sequence: 1 }, at);
    assert.equal(result.accepted, true);
    state = result.state;
  }
  return state;
}
function running() {
  const state = ready(create());
  return advanceClock(state, state.missionStartAt);
}

test("all 34 imported timelines compile, including the 18 double-action missions", () => {
  assert.equal(missionSummaries.length, 34);
  assert.equal(missionSummaries.filter((m) => m.doubleActions).length, 18);
  assert.match(missionSource.sha256, /^[a-f0-9]{64}$/);
  for (const summary of missionSummaries)
    for (const crewSize of [4, 5]) {
      const events = compileTimeline(getMission(summary.id), crewSize);
      assert.equal(events[0].atMs, 0);
      assert.equal(events.at(-1).type, "mission-complete");
      assert.equal(events.at(-1).atMs, summary.phaseEndsMs.at(-1));
      assert.equal(new Set(events.map((e) => e.id)).size, events.length);
      for (let i = 1; i < events.length; i++)
        assert.ok(events[i].atMs >= events[i - 1].atMs);
    }
});

test("waiting has no deadline; readiness expires individually without cancelling", () => {
  let state = create();
  assert.equal(nextWakeup(state), null);
  state = advanceClock(state, epoch + 86400000);
  assert.equal(state.stage, "presence");
  state = submit(
    state,
    0,
    { type: "ready", sequence: 1 },
    epoch + 86400000,
  ).state;
  assert.equal(nextWakeup(state), epoch + 86520000);
  const later = advanceClock(state, epoch + 86520000);
  assert.equal(later.stage, "presence");
  assert.equal(later.players[0].ready, false);
  assert.equal(nextWakeup(later), null);
  assert.equal(state.players[0].ready, true);
});

test("readiness must overlap, and withdrawing during countdown postpones launch", () => {
  let state = create(2);
  state = submit(state, 0, { type: "ready", sequence: 1 }, epoch).state;
  state = submit(
    state,
    1,
    { type: "ready", sequence: 1 },
    epoch + 120000,
  ).state;
  assert.equal(state.stage, "presence");
  assert.equal(state.players[0].ready, false);
  state = submit(
    state,
    0,
    { type: "ready", sequence: 2 },
    epoch + 120001,
  ).state;
  assert.equal(state.stage, "countdown");
  state = submit(
    state,
    1,
    { type: "unready", sequence: 2 },
    epoch + 120002,
  ).state;
  assert.equal(state.stage, "presence");
  assert.equal(state.missionStartAt, null);
  assert.equal(state.players[0].ready, true);
});

test("the shared countdown starts once, after the last player is ready", () => {
  const state = ready(create(), epoch + 119_999);
  assert.equal(state.stage, "countdown");
  assert.equal(state.missionStartAt, epoch + 122_999);
  assert.equal(nextWakeup(state), state.missionStartAt);
  const duplicate = submit(
    state,
    3,
    { type: "ready", sequence: 1 },
    epoch + 120_000,
  );
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.state.missionStartAt, state.missionStartAt);
  assert.equal(duplicate.state.log.length, state.log.length);
  const started = advanceClock(state, state.missionStartAt);
  assert.equal(started.stage, "programming");
  assert.deepEqual(
    started.players.map((p) => p.planningPhase),
    [1, 1, 1, 1],
  );
});

test("the future mission schedule is absent from players, spectators and reconnect snapshots", () => {
  const state = running();
  for (const seat of [undefined, 0, 1]) {
    const view = snapshot(state, seat);
    assert.equal(view.timeline, undefined);
    assert.equal(view.cursor, undefined);
    assert.equal(view.mission.events, undefined);
    assert.equal(view.log.filter((e) => e.event?.type === "threat").length, 0);
  }
  const later = advanceClock(state, state.missionStartAt + 10_000);
  assert.equal(
    snapshot(later, 0).log.filter((e) => e.event?.type === "threat").length,
    1,
  );
});

test("unconfirmed reports depend on crew size, including androids", () => {
  assert.equal(
    compileTimeline(mission, 4).filter((e) => e.type === "threat").length,
    1,
  );
  assert.equal(
    compileTimeline(mission, 5).filter((e) => e.type === "threat").length,
    2,
  );
  assert.equal(
    createSession({ players: 3, crewSize: 5, mission }, epoch).timeline.filter(
      (e) => e.type === "threat",
    ).length,
    2,
  );
});

test("personal phase advancement locks only that player, then shared deadlines catch everyone up", () => {
  let state = running();
  state = submit(
    state,
    0,
    { type: "advance-phase", sequence: 2 },
    state.missionStartAt + 1000,
  ).state;
  assert.equal(canEditTurn(state, 0, 1), false);
  assert.equal(canEditTurn(state, 0, 4), true);
  assert.equal(canEditTurn(state, 1, 1), true);
  assert.equal(canEditTurn(state, 1, 4), false);
  state = submit(
    state,
    0,
    { type: "advance-phase", sequence: 3 },
    state.missionStartAt + 2000,
  ).state;
  state = advanceClock(state, state.missionStartAt + 100_000);
  assert.deepEqual(
    state.players.map((p) => p.planningPhase),
    [3, 2, 2, 2],
  );
  assert.equal(canEditTurn(state, 0, 8), true);
  assert.equal(canEditTurn(state, 1, 3), false);
  assert.equal(canEditTurn(state, 1, 7), true);
  assert.equal(canEditTurn(state, 1, 4.5), false);
});

test("blackout and data-transfer windows open and close at server deadlines", () => {
  let state = running();
  const start = state.missionStartAt;
  state = advanceClock(state, start + 20_000);
  assert.equal(state.communicationsAvailable, false);
  state = advanceClock(state, start + 30_000);
  assert.equal(state.communicationsAvailable, true);
  state = advanceClock(state, start + 40_000);
  assert.equal(state.transferClosesAt, start + 55_000);
  assert.equal(nextWakeup(state), start + 55_000);
  state = advanceClock(state, start + 55_000);
  assert.equal(state.transferClosesAt, null);
});

test("clock catch-up and restore are identical to handling each deadline separately", () => {
  const initial = running();
  let incremental = initial;
  while (nextWakeup(incremental) !== null)
    incremental = advanceClock(incremental, nextWakeup(incremental));
  const recovered = advanceClock(
    JSON.parse(JSON.stringify(initial)),
    initial.missionStartAt + 300_000,
  );
  assert.deepEqual(recovered, incremental);
  assert.equal(recovered.stage, "resolution");
  assert.equal(
    recovered.players.every((p) => p.finishedPlanning),
    true,
  );
  assert.equal(canEditTurn(recovered, 0, 12), false);
});

test("every imported mission survives a restart and advances to resolution without player moves", () => {
  for (const summary of missionSummaries) {
    let state = ready(create(4, getMission(summary.id)));
    const finishAt = state.missionStartAt + summary.phaseEndsMs.at(-1);
    state = advanceClock(JSON.parse(JSON.stringify(state)), finishAt);
    assert.equal(state.stage, "resolution", summary.id);
    assert.equal(
      state.log.filter((e) => e.type === "programming-complete").length,
      1,
    );
    assert.equal(nextWakeup(state), null);
  }
});

test("early mission completion requires the final global phase and unanimous consent", () => {
  let state = running();
  assert.equal(
    submit(
      state,
      0,
      { type: "finish-planning", sequence: 2 },
      state.missionStartAt,
    ).accepted,
    false,
  );
  state = advanceClock(state, state.missionStartAt + 200_000);
  for (let seat = 0; seat < 4; seat++) {
    const result = submit(
      state,
      seat,
      { type: "finish-planning", sequence: 2 },
      state.observedAt,
    );
    assert.equal(result.accepted, true);
    state = result.state;
    assert.equal(state.stage, seat === 3 ? "resolution" : "programming");
  }
  assert.equal(state.log.at(-1).early, true);
});

test("a stale or forged client timestamp cannot bypass server time; invalid input still processes deadlines", () => {
  let state = running();
  const result = submit(
    state,
    0,
    { type: "advance-phase", sequence: 2, at: 0 },
    state.missionStartAt + 300_000,
  );
  assert.equal(result.accepted, false);
  assert.equal(result.state.stage, "resolution");
  const older = advanceClock(result.state, 0);
  assert.deepEqual(older, result.state);
  assert.equal(
    submit(state, -1, { type: "ready", sequence: 1 }, epoch).accepted,
    false,
  );
  assert.equal(
    submit(state, 0, { type: "advance-phase", sequence: 50 }, epoch).accepted,
    false,
  );
  assert.throws(() => advanceClock(state, NaN));
});

test("resending a committed phase command never advances twice", () => {
  let state = running();
  const command = { type: "advance-phase", sequence: 2 };
  const first = submit(state, 0, command, state.observedAt);
  const second = submit(first.state, 0, command, state.observedAt);
  assert.equal(second.duplicate, true);
  assert.deepEqual(second.state, first.state);
});
