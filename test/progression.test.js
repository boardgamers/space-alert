import test from "node:test";
import assert from "node:assert/strict";
import {
  createCampaign,
  recordMission,
  voteCampaign,
  repairCampaign,
  departCampaign,
} from "../src/game/campaign.js";
import { createShip } from "../src/game/resolution.js";
import {
  createExplorer,
  startExplorer,
  settleExplorer,
  consentToCloning,
  learnSpecialization,
  claimAchievement,
  eligibleAchievements,
  experienceFor,
  LEVEL_BOXES,
  HARDCORE_SKIPS,
  ACHIEVEMENTS,
} from "../src/game/career.js";
function resolved() {
  return {
    ship: createShip(4, "campaign"),
    threats: [],
    outcome: {
      survived: true,
      score: 10,
      threatPoints: 15,
      visual: 5,
      bonus: 1,
      penalties: 11,
    },
  };
}
test("campaign repairs are ordered, limited per zone, and unavailable to knocked-out crew", () => {
  let c = createCampaign("c");
  const r = resolved();
  r.ship.zones.red.damage = ["structure", "shield", "reactor"];
  r.ship.bots[0].disabled = true;
  r.ship.crew[1].knockedOut = true;
  c = recordMission(c, r);
  c = voteCampaign(c, 0, true, 2);
  assert.equal(c.stage, "decision");
  c = voteCampaign(c, 1, true, 2);
  c = repairCampaign(c, { crew: 0, zone: "red", tile: "shield" });
  assert.equal(c.repairCursor, 2);
  assert.equal(c.repairs[1].type, "recover");
  assert.throws(() => repairCampaign(c, { crew: 3, skip: true }));
  c = repairCampaign(c, { crew: 2, zone: "red", tile: "reactor" });
  assert.throws(
    () => repairCampaign(c, { crew: 3, zone: "red", tile: "structure" }),
    /two hull/,
  );
  c = repairCampaign(c, { crew: 3, bot: 0 });
  assert.equal(c.stage, "ready");
  c = departCampaign(c);
  const ship = createShip(4, "next", c.carried);
  assert.equal(ship.zones.red.carriedStructure, true);
  assert.equal(ship.zones.red.shield, 1);
  assert.equal(ship.bots[0].disabled, false);
});
test("ending a campaign scores unrepaired final damage, average visual and all threat/bonus points", () => {
  let c = recordMission(createCampaign("c"), resolved());
  c = voteCampaign(c, 0, false, 4);
  assert.equal(c.stage, "complete");
  assert.equal(c.outcome.score, 10);
  assert.throws(() => repairCampaign(c, { crew: 0, skip: true }));
  let two = createCampaign("two");
  two.missions = [
    {
      result: {
        survived: true,
        threatPoints: 10,
        visual: 4,
        bonus: 1,
        penalties: 9,
      },
      metadata: {},
    },
  ];
  two = recordMission(two, resolved());
  two = voteCampaign(two, 0, false, 1);
  assert.equal(two.outcome.score, 20);
  const failure = resolved();
  failure.outcome.survived = false;
  failure.ship.destroyed = true;
  const lost = recordMission(createCampaign("lost"), failure);
  assert.equal(lost.outcome.score, 0);
});
test("unrepaired robots stay off ship and a lone usable squad has a chosen initial station", () => {
  const carried = {
    zones: { red: ["shield", "reactor"], white: [], blue: [] },
    disabledBots: [true, false],
    botStation: "blue-upper",
  };
  const ship = createShip(4, "s", carried);
  assert.equal(ship.zones.red.shield, 0);
  assert.equal(ship.zones.red.reactor, 1);
  assert.equal(ship.bots[0].station, null);
  assert.equal(ship.bots[1].station, "blue-upper");
});
function success(id, score = 60) {
  return {
    id,
    at: 1000,
    survived: true,
    score,
    count: 1,
    limit: 3,
    humans: 4,
    penalties: 0,
    missions: [
      {
        humans: 4,
        crew: 4,
        doubleActions: false,
        difficulty: 1,
        seriousDifficulty: 1,
        threatCount: 7,
        penalties: 0,
      },
    ],
  };
}
test("experience is idempotent, rejects mismatched results and gives no training XP", () => {
  let e = startExplorer(createExplorer("eli", "Eli"), "m");
  assert.throws(() => settleExplorer(e, success("other")));
  e = settleExplorer(e, success("m"));
  assert.equal(e.xp, 8);
  assert.equal(e.level, 1);
  assert.deepEqual(settleExplorer(e, success("m")), e);
  assert.throws(() => startExplorer(e, "next"), /Choose earned/);
  e = learnSpecialization(e, "medic");
  assert.equal(e.specializations.medic, 1);
  e = startExplorer(e, "training");
  e = settleExplorer(e, { ...success("training", 999), training: true });
  assert.equal(e.xp, 8);
  assert.equal(experienceFor(59, 2, 3), 11);
  assert.equal(experienceFor(59, 3, 3), 17);
  assert.equal(experienceFor(-5), 2);
});
test("hardcore skips dotted boxes only once a following blank is marked; cloning is permanent", () => {
  assert.deepEqual(LEVEL_BOXES.slice(0, 4), [8, 12, 16, 20]);
  assert.deepEqual(HARDCORE_SKIPS.slice(0, 8), [0, 0, 4, 7, 10, 13, 16, 18]);
  let e = createExplorer("x", "X", false);
  e.level = 2;
  e.specializations = { medic: 1, mechanic: 1 };
  e = startExplorer(e, "one");
  e = settleExplorer(e, success("one", 0));
  assert.equal(e.boxes, 6);
  e = consentToCloning(e);
  assert.equal(e.boxes, 6);
  e = startExplorer(e, "two");
  assert.throws(() => consentToCloning(e));
  e = settleExplorer(e, { ...success("two"), survived: false });
  assert.equal(e.dead, false);
  assert.equal(e.clones, 1);
  assert.equal(e.xp, 2);
  let hardcore = startExplorer(createExplorer("y", "Y", false), "lost");
  hardcore = settleExplorer(hardcore, { ...success("lost"), survived: false });
  assert.equal(hardcore.dead, true);
  assert.throws(() => startExplorer(hardcore, "again"));
});
test("achievements require pre-mission level, category choice and crew judgment when applicable", () => {
  let e = settleExplorer(
    startExplorer(createExplorer("x", "X"), "one"),
    success("one"),
  );
  assert.ok(
    eligibleAchievements(e, "one").some((a) => a.id === "fantastic-four"),
  );
  assert.ok(
    !eligibleAchievements(e, "one").some((a) => a.id === "perfect-double"),
  );
  e = claimAchievement(e, "one", "fantastic-four");
  assert.equal(e.xp, 11);
  assert.throws(() => claimAchievement(e, "one", "not-even-a-scratch"));
  assert.throws(() => claimAchievement(e, "one", "duck"));
  e = claimAchievement(e, "one", "duck", { crewAgrees: true });
  assert.equal(e.xp, 12);
  assert.equal(
    new Set(ACHIEVEMENTS.map((a) => a.id)).size,
    ACHIEVEMENTS.length,
  );
});
test("specialization upgrades enforce the level when each point was earned", () => {
  let e = createExplorer("x", "X");
  e.level = 6;
  e = learnSpecialization(e, "medic");
  assert.throws(() => learnSpecialization(e, "medic"));
  e = learnSpecialization(e, "mechanic");
  e = learnSpecialization(e, "medic");
  assert.throws(() => learnSpecialization(e, "medic"));
  e = learnSpecialization(e, "teleporter");
  e = learnSpecialization(e, "rocketeer");
  e = learnSpecialization(e, "medic");
  assert.equal(e.specializations.medic, 3);
});
