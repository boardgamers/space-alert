// New Frontier experience rules and official explorer sheet. See docs/components.md.
import { SPECIALIZATIONS } from "./cards.js";
const check = (condition, message) => {
  if (!condition) throw Error(message);
};
export const LEVEL_BOXES = Array.from(
  { length: 30 },
  (_, level) => 8 + 4 * level,
);
export const HARDCORE_SKIPS = Array.from({ length: 30 }, (_, level) =>
  level < 2 ? 0 : level < 7 ? 3 * level - 2 : 4 + 2 * level,
);
export function createExplorer(id, name, cloning = true) {
  check(
    typeof id === "string" &&
      id &&
      typeof name === "string" &&
      name.trim() &&
      name.length <= 80,
    "Invalid explorer",
  );
  return {
    id,
    name: name.trim(),
    cloning: !!cloning,
    dead: false,
    level: 0,
    boxes: 0,
    xp: 0,
    clones: 0,
    specializations: {},
    achievements: [],
    runs: [],
    activeRun: null,
  };
}
export function experienceFor(score, count = 1, limit = 3) {
  check(
    Number.isFinite(score) &&
      Number.isInteger(count) &&
      count >= 1 &&
      count <= limit,
    "Invalid mission result",
  );
  return (
    (count === 1 ? 2 : count === limit ? 4 * count : 4 * count - 2) +
    Math.floor(Math.max(0, score) / 10)
  );
}
function gain(e, amount) {
  e.xp += amount;
  while (amount > 0 && e.level < 30) {
    // Dotted boxes count as skipped only when a following blank is actually filled.
    const skip = e.cloning ? 0 : Math.max(0, HARDCORE_SKIPS[e.level] - e.boxes);
    e.boxes += skip + 1;
    amount--;
    if (e.boxes === LEVEL_BOXES[e.level]) {
      e.level++;
      e.boxes = 0;
    }
  }
}
export function startExplorer(input, runId) {
  const e = structuredClone(input);
  check(!e.dead, "This explorer died");
  check(!e.activeRun, "Explorer is already on a mission");
  check(
    e.runs.every((r) => r.id !== runId),
    "Run already recorded",
  );
  check(
    Object.values(e.specializations).reduce((a, b) => a + b, 0) === e.level,
    "Choose earned specialization levels before departure",
  );
  e.activeRun = runId;
  return e;
}
export function settleExplorer(input, result) {
  const e = structuredClone(input);
  if (e.runs.some((r) => r.id === result.id)) return e;
  check(e.activeRun === result.id, "Result does not match the active mission");
  e.activeRun = null;
  const r = structuredClone(result);
  r.startLevel = e.level;
  r.achievements = [];
  r.xp = 0;
  if (!r.training) {
    if (r.survived) {
      r.xp = experienceFor(r.score, r.count ?? 1, r.limit ?? 3);
      gain(e, r.xp);
    } else if (e.cloning) e.clones++;
    else e.dead = true;
  }
  e.runs.push(r);
  return e;
}
export function cancelExplorer(input, runId) {
  const e = structuredClone(input);
  check(e.activeRun === runId, "Wrong active run");
  e.activeRun = null;
  return e;
}
export function consentToCloning(input) {
  const e = structuredClone(input);
  check(
    !e.activeRun && !e.dead,
    "Change cloning consent between missions or campaigns",
  );
  e.cloning = true;
  return e;
}
export function learnSpecialization(input, name) {
  const e = structuredClone(input);
  check(!e.activeRun && !e.dead, "Learn between missions");
  check(SPECIALIZATIONS.includes(name), "Unknown specialization");
  const spent = Object.values(e.specializations).reduce((a, b) => a + b, 0),
    level = (e.specializations[name] ?? 0) + 1;
  check(spent < e.level, "No unspent specialization level");
  const earnedAt = spent + 1;
  check(
    level <= 3 && (level < 2 || earnedAt >= 3) && (level < 3 || earnedAt >= 6),
    "This specialization level is not available yet",
  );
  e.specializations[name] = level;
  return e;
}
export const ACHIEVEMENTS = [];
const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
function add(category, name, xp, minLevel = 0, requirements = {}) {
  ACHIEVEMENTS.push({
    id: slug(name),
    name,
    category,
    xp,
    minLevel,
    ...requirements,
  });
}
const pools = ["white-yellow", "yellow", "yellow-red", "red", "all"];
for (const [i, name] of [
  "Lone Wolf",
  "Dynamic Duo",
  "Three Musketeers",
  "Fantastic Four",
  "Take Five",
].entries())
  add("missions", name, 3, 0, { humans: i + 1 });
add("missions", "Fifth Wheel", 3, 0, { humans: 4, crew: 5 });
add("missions", "D’Artagnan Missing", 5, 0, { humans: 3, crew: 3 });
for (const [i, name] of [
  "Scrambled Alert",
  "Yellow Alert",
  "Orange Alert",
  "Red Alert",
  "Random Alert",
].entries())
  add("missions", name, [3, 5, 7, 9, 6][i], [0, 0, 0, 2, 2][i], {
    pool: pools[i],
  });
add("missions", "Double Trouble", 2, 0, { double: true, easyAllowed: true });
for (const [i, name] of [
  "Double Solo",
  "Double Duo",
  "Double Trio",
  "Double Quartet",
  "Double Quintet",
].entries())
  add("missions", name, 4, 0, { double: true, humans: i + 1 });
for (const [i, name] of [
  "Double Scramble",
  "Double Yellow",
  "Double Orange",
  "Double Red",
  "Double Random",
].entries())
  add("missions", name, [5, 7, 9, 11, 8][i], [0, 2, 2, 5, 2][i], {
    double: true,
    pool: pools[i],
  });
for (const [i, name] of [
  "Not Even a Scratch",
  "Clean as a Whistle",
  "Spotless",
  "Flawless",
  "Peerless",
  "Favored by Fortune",
].entries())
  add("missions", name, [3, 6, 9, 12, 15, 10][i], [0, 2, 2, 2, 5, 5][i], {
    perfect: true,
    ...(i ? { pool: pools[i - 1] } : {}),
  });
for (const [i, name] of [
  "Perfect Double",
  "Clean as Two Whistles",
  "Doubly Spotless",
  "Doubly Flawless",
  "Doubly Peerless",
  "Doubly Fortunate",
].entries())
  add("missions", name, [4, 8, 12, 16, 20, 13][i], [2, 2, 5, 5, 5, 5][i], {
    perfect: true,
    double: true,
    ...(i ? { pool: pools[i - 1] } : {}),
  });
for (const [name, requirements] of [
  ["Robinson Crusoe", { humans: 1 }],
  ["... and Friday", { humans: 2 }],
  ["Honeymoon", { humans: 2, judged: true }],
  ["Tour", { minimumHumans: 3 }],
  ["Transgalactic Tour", { minimumMissions: 5 }],
])
  add(
    "campaigns",
    name,
    6,
    name === "Transgalactic Tour" ? 5 : 2,
    requirements,
  );
for (const [name, requirements] of [
  ["Double Crusoe", { humans: 1 }],
  ["Double Friday", { humans: 2 }],
  ["Double Tour", { minimumHumans: 3 }],
])
  add("campaigns", name, 9, 2, { double: true, ...requirements });
for (const [i, name] of [
  "Cracked",
  "Loony",
  "Crazy",
  "Insane",
  "Psychedelic",
].entries())
  add(
    "campaigns",
    name,
    [8, 12, 16, 20, 13][i],
    [2, 2, 5, 5, 5][i],
    i === 4 ? { differentPools: true } : { pool: pools[i] },
  );
for (const [i, name] of [
  "Scramble Challenge",
  "Rainbow Challenge",
  "Orange Challenge",
].entries())
  add("campaigns", name, [10, 15, 20][i], [2, 5, 5][i], {
    double: true,
    pool: ["white-yellow", "all", "yellow-red"][i],
  });
for (const [i, name] of [
  "Not Going to Happen",
  "Forget This",
  "Not Possible",
  "Beyond Impossible",
  "Are you serious?",
].entries())
  add("campaigns", name, 7 * (i + 1), [2, 2, 5, 5, 5][i], {
    perfect: true,
    ...(i ? { pool: pools[i - 1] } : {}),
  });
for (const [i, name] of [
  "Doubly Difficult",
  "Doubly Impossible",
  "No Comment",
].entries())
  add("campaigns", name, 20 + 10 * i, 5, {
    perfect: true,
    double: true,
    pool: ["white-yellow", "all", "yellow-red"][i],
  });
for (const [name, xp, min] of [
  ["Aye, captain!", 5, 2],
  ["Loud and clear!", 4, 2],
  ["All zones secure!", 3, 2],
  ["Lucky Charm", 2, 2],
  ["Lead Weight", 1, 2],
  ["Superstar", 0, 2],
  ["Lunch Money", 2, 0],
  ["Children of the Night", 3, 0],
  ["Devotion", 4, 0],
  ["Promiscuity", 5, 0],
  ["Chronicler", 6, 0],
  ["Master Chronicler", 12, 0],
  ["Wolf Pack", 2, 0],
  ["Supertemporality", 3, 0],
  ["Family Business", 4, 0],
  ["Integration", 5, 0],
  ["Pangalactic", 6, 0],
  ["Respected", 6, 2],
  ["Flight Instructor", 6, 5],
])
  add("social", name, xp, min, { judged: true });
for (const [name, xp] of [
  ["Banged Up", 2],
  ["A Thorough Beating", 4],
  ["Bruised and Broken", 6],
  ["Duck!", 1],
  ["Ghost Ship", 3],
  ["Bad Luck", 5],
  ["Survivor", 7],
])
  add("close-calls", name, xp, 0, { judged: true });
for (const [name, xp, min] of [
  ["Doombringer", 7, 2],
  ["Troubleshooter", 6, 2],
  ["Ace Pilot", 5, 2],
  ["Blaster Master", 4, 2],
  ["Rocket Star", 3, 2],
  ["Transfer Technician", 2, 2],
  ["Observer", 1, 2],
  ["Lazy Bum", 2, 2],
  ["Inspector", 3, 2],
  ["Take One for the Team", 4, 2],
  ["Extra Special Specialist", 5, 5],
  ["Busy Bee", 6, 2],
  ["Grand Finale", 7, 2],
])
  add("hot-shots", name, xp, min, { judged: true });
for (const specialization of SPECIALIZATIONS)
  for (const [tier, xp] of [
    ["basic", 3],
    ["advanced", 5],
  ])
    add("expert", `${specialization} ${tier}`, xp, 0, {
      specialization,
      tier,
      judged: true,
    });
for (const [name, xp, requirements] of [
  ["Out of this World", 5, { runs: 10 }],
  ["Out of this Reality", 10, { runs: 25 }],
  ["Out of this Log Sheet", 20, { runs: 50 }],
  ["Trucker", 15, { campaigns: 5 }],
  ["Galaxy Trucker", 25, { campaigns: 15 }],
  ["Is it still me?", 3, { clones: 15 }],
  ["Veteran Explorer", 6, { days: 182, minLevel: 2 }],
  ["Senior Explorer", 12, { days: 365, minLevel: 5 }],
  ["Jack of Some Trades", 5, { basic: 3 }],
  ["Jack of Many Trades", 10, { basic: 6 }],
  ["Jack of All Trades", 15, { basic: 9 }],
  ["Master of Arts", 10, { advanced: 3 }],
  ["Master of Many Arts", 20, { advanced: 6 }],
  ["Master of All Arts", 30, { advanced: 9 }],
  ["Achievement Collector", 4, { collector: true, minLevel: 2 }],
  ["Achievement Addict", 42, { addict: true, minLevel: 5 }],
])
  add("addiction", name, xp, requirements.minLevel ?? 0, requirements);
function poolMeets(value, required) {
  const key = [...(Array.isArray(value) ? value : [value])].sort().join("");
  return (
    {
      "white-yellow": ["12", "2", "123", "23", "3"],
      yellow: ["2", "23", "3"],
      "yellow-red": ["23", "3"],
      red: ["3"],
      all: ["123", "23", "3"],
    }[required]?.includes(key) ?? false
  );
}
export function eligibleAchievements(explorer, runId) {
  const r = explorer.runs.find((r) => r.id === runId);
  if (!r || r.training) return [];
  return ACHIEVEMENTS.filter((a) => {
    if (
      explorer.achievements.includes(a.id) ||
      a.minLevel > (a.category === "addiction" ? explorer.level : r.startLevel)
    )
      return false;
    if (
      a.category !== "addiction" &&
      (!r.survived ||
        r.achievements.some(
          (id) =>
            ACHIEVEMENTS.find((x) => x.id === id)?.category === a.category,
        ))
    )
      return false;
    const missions = r.missions ?? [];
    const fits = (m) =>
      (!a.humans || m.humans === a.humans) &&
      (!a.minimumHumans || m.humans >= a.minimumHumans) &&
      (!a.crew || m.crew === a.crew) &&
      (!a.double || m.doubleActions) &&
      (!a.pool ||
        (poolMeets(m.difficulty, a.pool) &&
          poolMeets(m.seriousDifficulty, a.pool)));
    if (a.category === "missions")
      return missions.some(
        (m) =>
          fits(m) &&
          (a.easyAllowed ||
            m.threatCount >=
              (m.doubleActions
                ? m.crew === 5
                  ? 12
                  : 10
                : m.crew === 5
                  ? 8
                  : 7)) &&
          (!a.perfect || m.penalties === 0),
      );
    if (a.category === "campaigns")
      return (
        r.count === r.limit &&
        r.count >= 3 &&
        (!a.minimumMissions || r.count >= a.minimumMissions) &&
        missions.every(
          (m) =>
            fits(m) &&
            m.threatCount >=
              (m.doubleActions
                ? m.crew === 5
                  ? 12
                  : 10
                : m.crew === 5
                  ? 8
                  : 7),
        ) &&
        (!a.perfect || r.penalties === 0) &&
        (!a.differentPools ||
          new Set(
            missions.map((m) =>
              JSON.stringify([m.difficulty, m.seriousDifficulty]),
            ),
          ).size === missions.length)
      );
    if (a.category === "expert")
      return (
        (r.usedSpecializations ?? []).includes(
          `${a.specialization}:${a.tier}`,
        ) && r.humans > 1
      );
    if (a.category === "social")
      return (
        r.humans > 1 ||
        [
          "superstar",
          "lunch-money",
          "children-of-the-night",
          "chronicler",
          "master-chronicler",
        ].includes(a.id)
      );
    if (a.category !== "addiction") return true;
    const completed = explorer.runs.filter((x) => x.survived && !x.training),
      earned = ACHIEVEMENTS.filter((x) => explorer.achievements.includes(x.id));
    if (a.runs && completed.length < a.runs) return false;
    if (
      a.campaigns &&
      completed.filter((x) => x.count >= 3 && x.count === x.limit).length <
        a.campaigns
    )
      return false;
    if (a.clones && explorer.clones < a.clones) return false;
    if (
      a.days &&
      (!completed.length || r.at - completed[0].at < a.days * 86400000)
    )
      return false;
    for (const tier of ["basic", "advanced"])
      if (
        a[tier] &&
        earned.filter((x) => x.category === "expert" && x.tier === tier)
          .length < a[tier]
      )
        return false;
    if (a.collector || a.addict)
      for (const cat of [
        "missions",
        "campaigns",
        "social",
        "close-calls",
        "hot-shots",
        "expert",
      ]) {
        const n = earned.filter((x) => x.category === cat).length,
          total = ACHIEVEMENTS.filter((x) => x.category === cat).length;
        if (
          n <
          (a.collector ? 1 : cat === "close-calls" ? 2 : Math.ceil(total / 2))
        )
          return false;
      }
    return true;
  });
}
export function claimAchievement(
  input,
  runId,
  id,
  { crewAgrees = false } = {},
) {
  const e = structuredClone(input);
  check(!e.activeRun && !e.dead, "Record achievements between missions");
  const a = eligibleAchievements(e, runId).find((a) => a.id === id);
  check(a, "Achievement is unavailable or already recorded");
  check(!a.judged || crewAgrees, "This achievement requires crew judgment");
  const r = e.runs.find((r) => r.id === runId);
  r.achievements.push(id);
  r.xp += a.xp;
  e.achievements.push(id);
  gain(e, a.xp);
  return e;
}
