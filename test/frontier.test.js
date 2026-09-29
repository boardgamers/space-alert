import test from "node:test";
import assert from "node:assert/strict";
import { THREATS, TRACKS } from "../src/game/catalog.js";
import { doubleDeck } from "../src/game/cards.js";
import {
  beginResolution,
  stepResolution,
  resolveAll,
  execute,
  attack,
} from "../src/game/resolution.js";
import { createSession, snapshot } from "../src/session.js";
import { getMission, missionSummaries } from "../src/missions.js";
function scenario(card, options = {}) {
  const cards = Array.isArray(card)
    ? card
    : card
      ? [{ cardId: card, turn: 1, zone: "white" }]
      : [];
  return beginResolution({
    crewSize: 4,
    seed: "frontier",
    programs: Array.from({ length: 4 }, () => Array(12).fill(null)),
    threats: cards,
    tracks: Object.fromEntries(
      ["red", "white", "blue", "internal"].map((z) => [z, TRACKS[6]]),
    ),
    ...options,
  });
}
function at(r, turn, step) {
  let n = 0;
  while (!r.outcome && (r.turn !== turn || r.step !== step) && n++ < 100)
    r = stepResolution(r);
  return r;
}
test("90 physical double cards retain their side order and 78 combinations", () => {
  const d = doubleDeck();
  assert.equal(d.length, 90);
  assert.equal(new Set(d.map((c) => c.id)).size, 90);
  assert.equal(new Set(d.map((c) => JSON.stringify(c.sides))).size, 78);
  assert.ok(d.every((c) => c.sides[0].length === 2 && c.sides[1].length === 1));
});
test("full 103-card catalogue, including 48 expansion cards, resolves without invalid numbers", () => {
  assert.equal(THREATS.length, 103);
  assert.equal(THREATS.filter((t) => t.expansion).length, 48);
  for (const card of THREATS) {
    const calls = Object.values(card.effects)
      .flat()
      .find((e) => e.type === "call");
    const r = scenario([
      {
        cardId: card.id,
        turn: 1,
        zone: card.position === "external" ? "white" : null,
        calledCard: calls
          ? { cardId: calls.position === "external" ? "E1-07" : "I1-01" }
          : null,
        vortexCard: card.vortex ? { cardId: "I1-01" } : null,
      },
    ]);
    const end = resolveAll(r);
    assert.ok(Number.isFinite(end.outcome.score), card.id);
    assert.deepEqual(
      resolveAll(JSON.parse(JSON.stringify(r))),
      end,
      card.id + " replay",
    );
    for (const z of Object.values(end.ship.zones))
      for (const n of ["reactor", "shield"])
        assert.ok(Number.isFinite(z[n]) && z[n] >= 0, card.id);
  }
});
test("pulse cannon targets every zone once, including a spanning threat", () => {
  let r = scenario([
    { cardId: "E1-07", turn: 1, zone: "red" },
    { cardId: "E1-07", turn: 1, zone: "blue" },
    { cardId: "SE3-103", turn: 1, zone: "white" },
  ]);
  r = at(r, 1, "crew");
  r.ship.crew[0].station = "white-lower";
  r.threats.forEach((t) => {
    t.positionOnTrack = 8;
    t.shield = 0;
  });
  execute(r, r.ship.crew[0], "A");
  r = at(r, 1, "threats");
  assert.deepEqual(
    r.threats.map((t) => t.damage),
    [1, 1, 1],
  );
});
test("phasing alternates vulnerability while bracketed attacks still execute", () => {
  let r = scenario("E2-102");
  r = at(r, 1, "crew");
  r.threats[0].track = {
    length: 16,
    marks: [
      [13, "X"],
      [10, "Y"],
      [1, "Z"],
    ],
  };
  execute(r, r.ship.crew[0], "A");
  r = at(r, 2, "crew");
  assert.equal(r.threats[0].phasedOut, true);
  const damage = r.threats[0].damage;
  execute(r, r.ship.crew[0], "A");
  r = at(r, 2, "threats");
  assert.equal(r.threats[0].damage, damage);
  r = at(r, 3, "crew");
  assert.equal(r.threats[0].phasedOut, false);
  const hits = r.log.filter((e) => e.type === "attack");
  assert.equal(hits[1].damage, 1);
});
test("inaccessibility absorbs a combined first repair point, and remote repairs cannot finish", () => {
  let r = at(scenario("SI2-101"), 1, "crew");
  execute(r, r.ship.crew[0], "C");
  assert.equal(r.threats[0].damage, 0);
  execute(r, r.ship.crew[1], "C");
  assert.equal(r.threats[0].damage, 1);
  execute(r, r.ship.crew[2], "special:data-analyst:basic");
  assert.equal(r.threats[0].damage, 1);
  execute(r, r.ship.crew[3], "C");
  assert.equal(r.threats[0].status, "destroyed");
});
test("polarization halves all lasers together, before shields, while pulse stays full", () => {
  let r = at(scenario("E3-108"), 1, "crew");
  r.threats[0].zone = "red";
  r.threats[0].positionOnTrack = 8;
  r.ship.crew[0].station = "red-upper";
  r.ship.crew[1].station = "red-lower";
  r.ship.crew[2].station = "white-lower";
  r.ship.zones.red.damage = ["lower-weapon"];
  for (let i = 0; i < 3; i++) execute(r, r.ship.crew[i], "A");
  r = at(r, 1, "threats");
  assert.equal(r.threats[0].damage, 3);
});
test("carrier protection depends on interceptor range, not targeting or damage", () => {
  let r = at(scenario("E2-101"), 1, "crew");
  r.ship.crew[0].space = 1;
  r.threats[0].positionOnTrack = 11;
  attack(r, r.threats[0], 2);
  assert.equal(r.ship.zones.white.shield, 1);
  assert.equal(r.ship.zones.white.damage.length, 0);
  r.doubleActions = true;
  r.ship.crew[0].space = 3;
  r.threats[0].positionOnTrack = 5;
  attack(r, r.threats[0], 2);
  assert.equal(r.ship.zones.white.damage.length, 1);
});
test("jumps retain the distance and use only markers on the original trajectory this turn", () => {
  let r = at(scenario("E3-105"), 1, "threats");
  r.threats[0].positionOnTrack = 10;
  r.threats[0].track = {
    length: 10,
    marks: [
      [9, "X"],
      [7, "Y"],
      [1, "Z"],
    ],
  };
  r.tracks.red = { length: 10, marks: [[8, "Z"]] };
  r = stepResolution(r);
  assert.equal(r.threats[0].status, "active");
  assert.equal(r.threats[0].zone, "blue");
  assert.equal(r.threats[0].positionOnTrack, 7);
  assert.deepEqual(
    r.log.filter((e) => e.type === "threat-action").map((e) => e.mark),
    ["X", "Y"],
  );
});
test("called threats appear after movement; preventing the call awards both destroyed cards", () => {
  const setup = [
    {
      cardId: "SE3-105",
      turn: 1,
      zone: "white",
      calledCard: { cardId: "E1-07" },
    },
  ];
  let r = at(scenario(setup), 1, "threats");
  r.threats[0].positionOnTrack = 13;
  r = stepResolution(r);
  assert.equal(r.threats[1].status, "active");
  assert.equal(r.threats[1].positionOnTrack, 16);
  let prevented = at(scenario(setup), 1, "crew");
  prevented.threats[0].hp = 1;
  prevented.threats[0].shield = 0;
  execute(prevented, prevented.ship.crew[0], "A");
  prevented = at(prevented, 1, "threats");
  assert.deepEqual(
    prevented.threats.map((t) => t.status),
    ["destroyed", "destroyed"],
  );
});
test("heroic movement respects sealed doors while Teleporter crosses them", () => {
  let r = at(scenario("I3-104"), 1, "crew");
  r.threats[0].flags = ["sealed-red"];
  execute(r, r.ship.crew[0], "teleport:red-lower");
  assert.equal(r.ship.crew[0].station, "white-lower");
  r.teleportTokens[0] = [0, 1];
  r.ship.crew[1].station = "red-lower";
  execute(r, r.ship.crew[0], "special:teleporter:basic");
  assert.equal(r.ship.crew[0].station, "red-lower");
});
test("Hypernavigator jumps straight to final step, ignoring skipped threat spawns and resolving last rocket", () => {
  let r = scenario([{ cardId: "E1-07", turn: 11, zone: "blue" }]);
  r.programs[0][9] = { actions: ["special:hypernavigator:advanced"] };
  r.ship.crew[0].station = "white-lower";
  r.ship.computer = [true, true, true];
  r = at(r, 10, "crew");
  r.ship.rocketFlight = [{ launched: 10, strength: 3, crew: 1 }];
  r = resolveAll(r);
  assert.equal(r.turn, 13);
  assert.equal(r.threats[0].status, "pending");
  assert.ok(r.outcome);
  assert.ok(!r.frames.some((f) => f.turn === 11 || f.turn === 12));
});
test("all missions set up with independent common/serious difficulty; future cards stay private", () => {
  for (const mission of missionSummaries)
    for (const difficulty of [1, 2, 3]) {
      const s = createSession(
        {
          players: 4,
          mission: getMission(mission.id),
          gameOptions: {
            seed: mission.id,
            threatExpansion: true,
            difficulty,
            seriousDifficulty: 3,
          },
        },
        0,
      );
      assert.equal(snapshot(s, 0).game.threats.length, 0);
      assert.ok(!JSON.stringify(snapshot(s, 0)).includes("vortexCard"));
    }
});

test("a delayed first half moves a protected later slot indirectly", () => {
  let r = scenario(null);
  r.programs[0][0] = { actions: ["lift"] };
  r.programs[1][0] = { actions: ["lift", "A"] };
  r.programs[1][1] = {
    actions: ["special:special-ops:advanced", "B"],
    protected: true,
  };
  r = at(r, 1, "damage");
  assert.deepEqual(r.programs[1][1].actions, ["A"]);
  assert.deepEqual(r.programs[1][2].actions, [
    "special:special-ops:advanced",
    "B",
  ]);
  assert.equal(r.ship.zones.white.reactor, 3, "delayed pulse has not fired");
});

test("Vortex deck changes respect the protected action waiting to execute", () => {
  let r = at(scenario("SI3-104"), 1, "crew");
  r.ship.crew[0].station = r.threats[0].stations[0];
  r.turnState.pendingProtected = [1];
  const old = r.ship.crew[1].station;
  execute(r, r.ship.crew[0], r.threats[0].repair);
  assert.equal(r.ship.crew[1].station, old);
  assert.notEqual(r.ship.crew[2].station, old);
});

test("called threats are public recursively but Vortex draws remain secret", () => {
  const s = createSession(
    {
      players: 1,
      mission: getMission("realmission1"),
      gameOptions: { seed: "secrecy", threatExpansion: true },
    },
    0,
  );
  s.game.threats = [
    {
      cardId: "SE3-105",
      instance: 0,
      turn: 1,
      zone: "white",
      calledCard: {
        cardId: "E3-107",
        calledCard: { cardId: "SI3-104", vortexCard: { cardId: "I1-01" } },
      },
    },
  ];
  const publicThreat = snapshot(s, 0).game.threats[0];
  assert.equal(
    publicThreat.calledCard.calledCard.card.name,
    "Space-Time Vortex",
  );
  assert.equal(JSON.stringify(publicThreat).includes("vortexCard"), false);
  assert.equal(
    s.game.threats[0].calledCard.calledCard.vortexCard.cardId,
    "I1-01",
    "view must not mutate state",
  );
});

test("last-turn double movement delay loses its second half", () => {
  let r = scenario(null);
  r.ship.computer = [true, true, true];
  r.programs[0][11] = { actions: ["lift"] };
  r.programs[1][11] = { actions: ["lift", "A"] };
  r = at(r, 12, "damage");
  assert.equal(r.ship.zones.white.reactor, 3);
  assert.equal(r.turnState.fired.includes("white-lower"), false);
});

test("Ninja follows the publisher appendix: poison on appearance, through-movement exempt", () => {
  let r = scenario("I2-102");
  r.programs[0][0] = { actions: ["blue"] };
  r.programs[1][0] = { actions: ["lift", "red"] };
  r = at(r, 1, "damage");
  assert.deepEqual(r.threats[0].affected, [0]);
  assert.equal(r.ship.crew[0].knockedOut, false, "poison resolves later at Z");
});
