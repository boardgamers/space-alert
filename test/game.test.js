import test from "node:test";
import assert from "node:assert/strict";
import {
  createSession,
  submit,
  advanceClock,
  snapshot,
} from "../src/session.js";
import { getMission } from "../src/missions.js";
import { baseDeck, heroicDeck } from "../src/game/cards.js";
import {
  beginResolution,
  stepResolution,
  resolveAll,
  delay,
} from "../src/game/resolution.js";
import { TRACKS } from "../src/game/catalog.js";
const tracks = Object.fromEntries(
  ["red", "white", "blue", "internal"].map((z) => [z, TRACKS[0]]),
);
function scenario(programs = [], threats = [], extra = {}) {
  return beginResolution({
    crewSize: 4,
    seed: "tests",
    programs: Array.from({ length: 4 }, (_, p) =>
      Array.from({ length: 12 }, (_, i) =>
        programs[p]?.[i] ? { actions: programs[p][i] } : null,
      ),
    ),
    threats,
    tracks,
    ...extra,
  });
}
function to(r, turn, step) {
  while (!r.outcome && (r.turn !== turn || r.step !== step))
    r = stepResolution(r);
  return r;
}
function started(players = 4, options = {}) {
  let s = createSession(
    {
      players,
      mission: getMission("realmission1"),
      gameOptions: { seed: "test", ...options },
    },
    0,
  );
  for (let p = 0; p < players; p++)
    s = submit(s, p, { type: "ready", sequence: 1 }, 0).state;
  return advanceClock(s, 3000);
}
const command = (s, p, c) =>
  submit(s, p, { ...c, sequence: s.players[p].lastSequence + 1 }, s.observedAt);
test("base multiset and heroic station pairings are complete", () => {
  assert.equal(baseDeck().length, 90);
  assert.equal(new Set(baseDeck().map((c) => c.id)).size, 90);
  assert.deepEqual(
    ["A", "B", "C", "bots"].map(
      (a) => baseDeck().filter((c) => c.sides[0][0] === a).length,
    ),
    [30, 24, 21, 15],
  );
  assert.equal(heroicDeck().length, 6);
});
test("phase packets are private, released once; editing never leaks card faces", () => {
  let s = started();
  const own = snapshot(s, 0);
  assert.equal(own.game.hand.length, 5);
  const card = own.game.hand[0];
  let result = command(s, 0, {
    type: "program",
    crew: 0,
    turn: 1,
    cards: [{ id: card.id, side: 0 }],
    slotVersion: 0,
  });
  assert.ok(result.accepted, result.error);
  s = result.state;
  const other = snapshot(s, 1),
    spectator = snapshot(s);
  assert.equal(other.game.programs[0][0].cards[0].sides, undefined);
  assert.equal(spectator.game.hand.length, 0);
  const encoded = JSON.stringify(other);
  assert.ok(!encoded.includes("assignedThreats"));
  assert.ok(!encoded.includes("damageDeck"));
  assert.ok(!encoded.includes("packets"));
  assert.ok(!encoded.includes('"seed"'));
  s = command(s, 0, { type: "advance-phase" }).state;
  assert.equal(s.game.hands[0].length, 9);
  assert.equal(
    command(s, 0, { type: "remove", crew: 0, turn: 1, slotVersion: 1 })
      .accepted,
    false,
  );
  s = advanceClock(s, s.missionStartAt + s.mission.phaseEndsMs[0]);
  assert.equal(s.game.hands[0].length, 9);
});
test("android slot races reject stale edits and donations are irreversible", () => {
  let s = started(2);
  const c = s.game.hands[0].find((id) => s.game.cards[id].kind === "normal");
  s = command(s, 0, {
    type: "program",
    crew: 2,
    turn: 1,
    cards: [{ id: c, side: 0 }],
    slotVersion: 0,
  }).state;
  const other = s.game.hands[1].find(
    (id) => s.game.cards[id].kind === "normal",
  );
  const before = structuredClone(s.game);
  const result = command(s, 1, {
    type: "program",
    crew: 2,
    turn: 1,
    cards: [{ id: other, side: 0 }],
    slotVersion: 0,
  });
  assert.equal(result.accepted, false);
  assert.deepEqual(result.state.game, before);
  assert.equal(
    command(s, 0, { type: "remove", crew: 2, turn: 1, slotVersion: 1 })
      .accepted,
    false,
  );
});
test("invalid second card rejects atomically without removing a first card", () => {
  const s = started(),
    before = structuredClone(s.game);
  const result = command(s, 0, {
    type: "program",
    crew: 0,
    turn: 1,
    cards: [
      { id: s.game.hands[0][0], side: 0 },
      { id: "forged", side: 0 },
    ],
    slotVersion: 0,
  });
  assert.equal(result.accepted, false);
  assert.deepEqual(result.state.game, before);
});
test("one transfer per announcement; heroic cards and exact-beep transfers are rejected", () => {
  let s = started();
  const event = s.timeline.find((e) => e.type === "data-transfer");
  s = advanceClock(s, s.missionStartAt + event.atMs);
  const hero = s.game.hands[0].find((id) => s.game.cards[id].kind === "heroic");
  assert.equal(
    command(s, 0, { type: "transfer", card: hero, to: 1 }).accepted,
    false,
  );
  const card = s.game.hands[0].find((id) => s.game.cards[id].kind === "normal");
  s = command(s, 0, { type: "transfer", card, to: 1 }).state;
  assert.ok(s.game.hands[1].includes(card));
  assert.equal(
    command(s, 0, { type: "transfer", card: s.game.hands[0][0], to: 1 })
      .accepted,
    false,
  );
  s = advanceClock(s, s.transferClosesAt);
  assert.equal(
    command(s, 1, { type: "transfer", card, to: 0 }).accepted,
    false,
  );
});
test("solo exposes its shared deck only to its player and allows android edits", () => {
  let s = started(1);
  assert.equal(s.game.hands[0].length, 90);
  assert.equal(snapshot(s).game.hand.length, 0);
  const c = s.game.hands[0][0];
  s = command(s, 0, {
    type: "program",
    crew: 3,
    turn: 1,
    cards: [{ id: c, side: 0 }],
    slotVersion: 0,
  }).state;
  assert.equal(
    command(s, 0, { type: "remove", crew: 3, turn: 1, slotVersion: 1 })
      .accepted,
    true,
  );
});
test("lasers combine before shields and cannot fire twice from the same station", () => {
  let r = scenario(
    [
      [["red"], ["A"]],
      [["red"], ["lift"], ["A"]],
    ],
    [{ cardId: "E1-07", turn: 1, zone: "red" }],
  );
  r = to(r, 2, "threats");
  assert.equal(r.threats[0].damage, 2);
  assert.equal(r.ship.zones.red.reactor, 1);
  let same = scenario([[["A"]], [["A"]]]);
  same = to(same, 1, "damage");
  assert.equal(same.ship.zones.white.reactor, 2);
  assert.equal(same.turnState.shots.length, 1);
});
test("occupied lift delays the next action, with noncumulative delays", () => {
  let r = scenario([[["lift"]], [["lift"], ["B"], ["A"]]]);
  r = to(r, 1, "damage");
  assert.equal(r.programs[1][1], null);
  assert.deepEqual(r.programs[1][2].actions, ["B"]);
  delay(r, r.ship.crew[1], 2);
  assert.deepEqual(r.programs[1][2].actions, ["B"]);
});
test("first half of a double action delays just its remaining half", () => {
  let r = scenario([[["lift"]], [["lift", "B"], ["A"]]], [], {
    doubleActions: true,
  });
  r = to(r, 1, "damage");
  assert.deepEqual(r.programs[1][1].actions, ["B"]);
  assert.deepEqual(r.programs[1][2].actions, ["A"]);
  assert.equal(r.ship.fuel, 3);
  r = to(r, 2, "damage");
  assert.equal(r.ship.fuel, 2);
});
test("computer must be maintained in first two turns of each phase", () => {
  let r = scenario([[["C"]]], []);
  r = to(r, 3, "crew");
  assert.equal(r.ship.computer[0], true);
  assert.equal(r.log.filter((e) => e.type === "computer-missed").length, 0);
  const bad = to(scenario(), 3, "crew");
  assert.equal(bad.log.filter((e) => e.type === "computer-missed").length, 1);
});
test("rocket takes one turn and the final rocket resolves before jumping", () => {
  const r = scenario([], [{ cardId: "E1-07", turn: 12, zone: "blue" }]);
  r.ship.rocketFlight.push({ launched: 12, strength: 3, crew: 0 });
  const end = resolveAll(r);
  assert.ok(end.log.some((e) => e.type === "threat-hit" && e.turn === 13));
  assert.ok(end.outcome);
});
test("shield absorbs before hull damage, plasma knockout needs no absorption", () => {
  let r = scenario([], [{ cardId: "E1-101", turn: 1, zone: "white" }]);
  r = to(r, 2, "appear");
  assert.equal(
    r.ship.crew.some((p) => p.knockedOut),
    false,
  );
  r = resolveAll(r);
  assert.ok(r.ship.crew.some((p) => p.knockedOut));
});
test("cryoshield absorbs first volley regardless of strength", () => {
  let r = scenario(
    [[["A"], ["A"]]],
    [{ cardId: "E1-06", turn: 1, zone: "white" }],
  );
  r = to(r, 1, "threats");
  assert.equal(r.threats[0].damage, 0);
  assert.ok(r.threats[0].flags.includes("cryo-broken"));
  r = to(r, 2, "threats");
  assert.equal(r.threats[0].status, "destroyed");
});
test("serialized resolution resumes identically and scores a shared outcome", () => {
  const r = to(
    scenario([[["C"]]], [{ cardId: "E1-07", turn: 1, zone: "red" }]),
    3,
    "damage",
  );
  assert.deepEqual(resolveAll(JSON.parse(JSON.stringify(r))), resolveAll(r));
  const end = resolveAll(r);
  assert.ok(Number.isFinite(end.outcome.score));
});
test("medic acts before captain and applies only to first subaction", () => {
  let r = scenario([[["A", "B"]], [["special:medic:basic"]]], [], {
    doubleActions: true,
  });
  r = to(r, 1, "damage");
  assert.equal(r.turnState.shots[0].strength, 6);
  assert.equal(r.ship.zones.white.shield, 3);
});

test("visual confirmation awards 1/2/3/5/7, taking only the best result each phase", () => {
  for (let count = 1; count <= 5; count++) {
    let r = scenario([], [], {
      crewSize: 5,
      programs: Array.from({ length: 5 }, (_, i) =>
        Array.from({ length: 12 }, (_, turn) =>
          i < count && turn < 2 ? { actions: ["C"] } : null,
        ),
      ),
    });
    for (const p of r.ship.crew) p.station = "white-lower";
    r = to(r, 2, "damage");
    assert.equal(r.ship.visual[0], [0, 1, 2, 3, 5, 7][count]);
  }
});
test("heroic overcharge survives unrelated damage tiles", async () => {
  const { damageShip } = await import("../src/game/resolution.js");
  const r = scenario();
  r.ship.zones.white.shield = 4;
  r.ship.zones.white.reactor = 6;
  r.ship.zones.white.damageDeck = ["shield", "structure"];
  damageShip(r, "white", 1, "test");
  assert.equal(r.ship.zones.white.shield, 4);
  assert.equal(r.ship.zones.white.reactor, 6);
  damageShip(r, "white", 1, "test");
  assert.equal(r.ship.zones.white.shield, 2);
  assert.equal(r.ship.zones.white.reactor, 6);
});
test("Medic protection follows the medic after teleport and does not protect robots", async () => {
  const { knockout } = await import("../src/game/resolution.js");
  let r = scenario(
    [[["special:medic:advanced"]], [["special:teleporter:basic"]]],
    [],
    {
      teleportTokens: [
        [0, 0],
        [0, 2],
      ],
    },
  );
  r.ship.crew[2].station = "red-upper";
  r.ship.crew[2].bots = 0;
  r.ship.bots[0].owner = 2;
  r = to(r, 1, "damage");
  knockout(r, r.ship.crew[2], "test");
  knockout(r, r.ship.crew[1], "test");
  assert.equal(r.ship.crew[2].knockedOut, false);
  assert.equal(r.ship.bots[0].disabled, true);
  assert.equal(r.ship.crew[1].knockedOut, true);
  assert.equal(r.ship.bonus, -1);
});
test("Special Ops protection ends after its action, but prevents earlier knockout", async () => {
  const { knockout } = await import("../src/game/resolution.js");
  let r = scenario([[], [["special:special-ops:advanced", "red"]]]);
  r.programs[1][0].protected = true;
  r = to(r, 1, "crew");
  knockout(r, r.ship.crew[1], "before");
  assert.equal(r.ship.crew[1].knockedOut, false);
  r = to(r, 1, "damage");
  knockout(r, r.ship.crew[1], "after");
  assert.equal(r.ship.crew[1].knockedOut, true);
});
test("Contamination damages each affected station, including two in the same zone", () => {
  let r = scenario([], [{ cardId: "SI2-04", turn: 1 }]);
  r.tracks.internal = {
    length: 10,
    marks: [
      [8, "Y"],
      [1, "Z"],
    ],
  };
  r.threats[0].track = r.tracks.internal;
  r = to(r, 1, "computer");
  assert.equal(r.ship.zones.red.damage.length, 2);
  assert.equal(r.ship.zones.blue.damage.length, 2);
});
test("all base threat cards resolve independently and leave finite resource/score values", async () => {
  const { THREATS } = await import("../src/game/catalog.js");
  for (const card of THREATS.filter((t) => !t.expansion)) {
    const r = resolveAll(
      scenario(
        [],
        [
          {
            cardId: card.id,
            turn: 1,
            ...(card.position === "external" ? { zone: "white" } : {}),
          },
        ],
      ),
    );
    assert.ok(r.outcome, card.id);
    assert.ok(Number.isFinite(r.outcome.score), card.id);
    for (const z of Object.values(r.ship.zones)) {
      assert.ok(Number.isFinite(z.shield) && z.shield >= 0, card.id);
      assert.ok(Number.isFinite(z.reactor) && z.reactor >= 0, card.id);
    }
  }
});
test("solo Teleporter tokens work for an android and replaced special cards return to their owner", () => {
  let s = started(1, {
    specializations: ["medic", "teleporter", "mechanic", "special-ops"].map(
      (name) => ({ name, level: 3 }),
    ),
  });
  const result = command(s, 0, { type: "teleport", crew: 1, from: 0, to: 2 });
  assert.ok(result.accepted, result.error);
  s = result.state;
  assert.deepEqual(s.game.teleportTokens[1], [0, 2]);
  const special = s.game.androidCards.find(
    (id) => s.game.cards[id].owner === 1,
  );
  s = command(s, 0, {
    type: "program",
    crew: 1,
    turn: 1,
    cards: [{ id: special, side: 0 }],
    slotVersion: 0,
  }).state;
  const normal = s.game.hands[0][0];
  s = command(s, 0, {
    type: "program",
    crew: 1,
    turn: 1,
    cards: [{ id: normal, side: 0 }],
    slotVersion: 1,
  }).state;
  assert.ok(s.game.androidCards.includes(special));
  assert.ok(!s.game.hands[0].includes(special));
});
