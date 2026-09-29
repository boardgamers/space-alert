// Base rules §6. All transitions are pure; the host persists the returned state.
const check = (condition, message) => {
  if (!condition) throw Error(message);
};
export function createCampaign(id, limit = 3) {
  check(typeof id === "string" && id.length > 0, "Campaign ID required");
  check(
    Number.isInteger(limit) && limit >= 1 && limit <= 5,
    "Choose one to five missions",
  );
  return {
    id,
    limit,
    missions: [],
    stage: "flying",
    votes: [],
    repairs: [],
    repairCursor: 0,
    carried: null,
    usedThreats: [],
    outcome: null,
  };
}
export function recordMission(campaign, resolution, metadata = {}) {
  const c = structuredClone(campaign);
  if (c.stage !== "flying") return c;
  check(resolution.outcome, "Resolve the mission first");
  const { ship, outcome } = resolution;
  c.missions.push({
    result: structuredClone(outcome),
    metadata: structuredClone(metadata),
  });
  c.lastShip = structuredClone(ship);
  c.usedThreats = [
    ...new Set([
      ...c.usedThreats,
      ...resolution.threats
        .filter(
          (t) => ["destroyed", "survived"].includes(t.status) && !t.sabotage,
        )
        .map((t) => t.id),
    ]),
  ];
  if (!outcome.survived || c.missions.length === c.limit) finish(c);
  else {
    c.stage = "decision";
    c.votes = [];
  }
  return c;
}
function finish(c) {
  const survived = c.missions.every((m) => m.result.survived),
    last = c.missions.at(-1).result;
  const threats = c.missions.reduce((n, m) => n + m.result.threatPoints, 0),
    visual = Math.floor(
      c.missions.reduce((n, m) => n + m.result.visual, 0) / c.missions.length,
    ),
    bonus = c.missions.reduce((n, m) => n + m.result.bonus, 0);
  c.outcome = {
    survived,
    score: survived ? threats + visual + bonus - last.penalties : 0,
    threatPoints: threats,
    visual,
    bonus,
    penalties: last.penalties,
  };
  c.stage = "complete";
}
export function voteCampaign(campaign, seat, continueCampaign, humans) {
  const c = structuredClone(campaign);
  check(c.stage === "decision", "Campaign is not awaiting a decision");
  check(Number.isInteger(seat) && seat >= 0 && seat < humans, "Unknown player");
  check(typeof continueCampaign === "boolean", "Choose continue or return");
  if (!continueCampaign) {
    finish(c);
    return c;
  }
  if (!c.votes.includes(seat)) c.votes.push(seat);
  if (c.votes.length === humans) {
    c.stage = "repairs";
    c.repairs = [];
    c.repairCursor = 0;
    c.repairedZones = { red: 0, white: 0, blue: 0 };
    c.carried = {
      zones: Object.fromEntries(
        Object.entries(c.lastShip.zones).map(([z, s]) => [z, [...s.damage]]),
      ),
      disabledBots: c.lastShip.bots.map((b) => !!b.disabled),
      botStation: null,
    };
    skipUnconscious(c);
  }
  return c;
}
function skipUnconscious(c) {
  while (c.lastShip.crew[c.repairCursor]?.knockedOut) {
    c.repairs.push({ crew: c.repairCursor, type: "recover" });
    c.repairCursor++;
  }
  if (c.repairCursor === c.lastShip.crew.length) c.stage = "ready";
}
export function repairCampaign(campaign, choice) {
  const c = structuredClone(campaign);
  check(c.stage === "repairs", "Campaign is not awaiting repairs");
  check(
    choice.crew === c.repairCursor,
    "Repair in crew order, starting with the captain",
  );
  const { zone, tile, bot, skip } = choice;
  if (skip)
    check(
      zone === undefined && tile === undefined && bot === undefined,
      "Choose a single repair",
    );
  else if (bot !== undefined) {
    check(
      zone === undefined &&
        tile === undefined &&
        Number.isInteger(bot) &&
        c.carried.disabledBots[bot] === true,
      "Choose a disabled squad",
    );
    c.carried.disabledBots[bot] = false;
  } else {
    check(
      c.carried.zones[zone]?.includes(tile),
      "Choose an existing damage tile",
    );
    check(c.repairedZones[zone] < 2, "At most two hull repairs per zone");
    c.carried.zones[zone] = c.carried.zones[zone].filter((t) => t !== tile);
    c.repairedZones[zone]++;
  }
  c.repairs.push(structuredClone(choice));
  c.repairCursor++;
  skipUnconscious(c);
  return c;
}
export function departCampaign(campaign, botStation = "red-lower") {
  const c = structuredClone(campaign);
  check(c.stage === "ready", "Finish all repairs before departure");
  check(
    ["red-lower", "blue-upper"].includes(botStation),
    "Invalid battlebot station",
  );
  c.carried.botStation = botStation;
  c.stage = "flying";
  return c;
}
