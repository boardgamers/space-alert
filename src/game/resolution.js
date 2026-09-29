import { TRACKS, threatById } from "./catalog.js";
import { shuffle, random } from "./random.js";
import { phaseForTurn } from "./cards.js";
import { specialAction } from "./specializations.js";
export const ZONES = ["red", "white", "blue"];
export const STATIONS = [
  "red-upper",
  "white-upper",
  "blue-upper",
  "red-lower",
  "white-lower",
  "blue-lower",
];
export const DAMAGE = [
  "upper-weapon",
  "lower-weapon",
  "shield",
  "reactor",
  "lift",
  "structure",
];
const zoneOf = (station) => station.split("-")[0];
const deckOf = (station) => station.split("-")[1];
const live = (t) => t.status === "active";
const ongoing = (t) => ["active", "survived"].includes(t.status);
export function createShip(crewSize, seed, carried = null) {
  const rng = random(`${seed}/damage`);
  const ship = {
    zones: Object.fromEntries(
      ZONES.map((z) => [
        z,
        {
          shield: 1,
          reactor: z === "white" ? 3 : 2,
          damage: [],
          damageDeck: shuffle(DAMAGE, rng),
        },
      ]),
    ),
    fuel: 3,
    rockets: 3,
    rocketFlight: [],
    bots: [
      { station: "blue-upper", owner: null, disabled: false },
      { station: "red-lower", owner: null, disabled: false },
    ],
    crew: Array.from({ length: crewSize }, (_, id) => ({
      id,
      station: "white-upper",
      knockedOut: false,
      bots: null,
      space: 0,
      prepared: false,
    })),
    computer: [false, false, false],
    visual: [0, 0, 0],
    preparedWeapons: [],
    bonus: 0,
    destroyed: false,
  };
  if (carried)
    for (const z of ZONES) {
      const damage = carried.zones?.[z] ?? carried[z];
      ship.zones[z].damage = [...damage];
      ship.zones[z].damageDeck = ship.zones[z].damageDeck.filter(
        (d) => !damage.includes(d),
      );
      ship.zones[z].carriedStructure = damage.includes("structure");
      if (damage.includes("shield")) ship.zones[z].shield--;
      if (damage.includes("reactor")) ship.zones[z].reactor--;
    }
  if (carried?.disabledBots) {
    ship.bots.forEach((b, i) => {
      b.disabled = carried.disabledBots[i];
      if (b.disabled) b.station = null;
    });
    const available = ship.bots.filter((b) => !b.disabled);
    if (available.length === 1)
      available[0].station = carried.botStation ?? "red-lower";
  }
  return ship;
}
export function beginResolution({
  crewSize,
  seed,
  programs,
  threats,
  tracks,
  doubleActions = false,
  turns = 12,
  teleportTokens = [],
  carried = null,
}) {
  const r = {
    turn: 0,
    step: "appear",
    lastTurn: turns,
    finalTurn: turns + 1,
    ship: createShip(crewSize, seed, carried),
    programs: structuredClone(programs),
    threats: threats
      .map((t, index) => ({
        ...threatById(t.cardId),
        instance: t.instance ?? index,
        turn: t.turn,
        zone: t.zone ?? null,
        track: tracks[t.zone ?? "internal"],
        calledCard: t.calledCard ?? null,
        vortexCard: t.vortexCard ?? null,
        status: "pending",
        damage: 0,
        flags: [],
        positionOnTrack: 0,
      }))
      .sort((a, b) => a.turn - b.turn || a.instance - b.instance),
    tracks: structuredClone(tracks),
    doubleActions,
    teleportTokens,
    log: [],
    frames: [],
    outcome: null,
    delayed: {},
    nextCalled: 0,
  };
  capture(r);
  return r;
}
export function note(r, type, data = {}) {
  r.log.push({
    id: r.log.length + 1,
    turn: r.turn,
    step: r.step,
    type,
    ...data,
  });
}
export function capacity(r, zone, system) {
  return (
    (system === "reactor"
      ? zone === "white"
        ? 5
        : 3
      : zone === "white"
        ? 3
        : 2) - Number(r.ship.zones[zone].damage.includes(system))
  );
}
export function knockout(r, p, reason, protectedConsequence = false) {
  if (protectedConsequence || r.turnState?.pendingProtected?.includes(p.id))
    return;
  if (p.bots !== null) r.ship.bots[p.bots].disabled = true;
  const medic = r.turnState?.protectingMedics?.some(
    (id) => !p.space && r.ship.crew[id].station === p.station,
  );
  if (
    p.knockedOut ||
    medic ||
    protectedConsequence ||
    r.turnState?.pendingProtected?.includes(p.id)
  )
    return;
  p.knockedOut = true;
  note(r, "knocked-out", { crew: p.id, reason });
  syncParasites(r);
}
export function damageShip(r, zone, amount, source) {
  const z = r.ship.zones[zone];
  if (
    z.carriedStructure ||
    r.threats.some(
      (t) =>
        live(t) &&
        (t.flags.includes("double-all") ||
          (zone === "red" && t.flags.includes("double-red"))),
    )
  )
    amount *= 2;
  for (let i = 0; i < amount && !r.ship.destroyed; i++) {
    if (!z.damageDeck.length) {
      r.ship.destroyed = true;
      note(r, "ship-destroyed", { zone, source });
      break;
    }
    const tile = z.damageDeck.pop();
    z.damage.push(tile);
    if (tile === "shield" || tile === "reactor")
      z[tile] = Math.min(z[tile], capacity(r, zone, tile));
    note(r, "ship-damage", { zone, tile, source });
  }
}
export function attack(r, t, amount, zone = t.zone, mode = "normal") {
  if ((t.position === "internal" && mode !== "shielded") || mode === "direct") {
    damageShip(r, zone, amount, t.instance);
    return;
  }
  if (
    t.carrier &&
    r.ship.crew.some(
      (p) =>
        p.space &&
        !p.knockedOut &&
        (!r.doubleActions ||
          p.space <= Math.min(3, Math.ceil(t.positionOnTrack / 5))),
    )
  )
    amount = Math.max(0, amount - t.carrier);
  amount += r.threats.filter(
    (o) =>
      ongoing(o) &&
      o.flags.includes("attack-aura") &&
      o.instance !== t.instance,
  ).length;
  if (mode === "ignore-shield") {
    damageShip(r, zone, amount, t.instance);
    return;
  }
  const z = r.ship.zones[zone];
  const temporary = Math.min(amount, r.turnState.temporaryShields[zone] ?? 0);
  r.turnState.temporaryShields[zone] -= temporary;
  amount -= temporary;
  const reversed = r.threats.filter((x) => ongoing(x));
  if (amount > 0 && reversed.some((x) => x.flags.includes("reverse-shields"))) {
    amount += z.shield;
    z.shield = 0;
  }
  const absorbed = reversed.some((x) => x.flags.includes("ignore-shields"))
    ? 0
    : Math.min(z.shield, amount);
  z.shield -= absorbed;
  amount -= absorbed;
  if (t.energyHeal) t.damage = Math.max(0, t.damage - absorbed - temporary);
  note(r, "attack", {
    threat: t.instance,
    zone,
    absorbed: absorbed + temporary,
    damage: amount,
    mode,
  });
  damageShip(r, zone, amount * (mode === "double" ? 2 : 1), t.instance);
  if (mode === "plasma" && absorbed + temporary === 0)
    for (const p of r.ship.crew)
      if (!p.space && zoneOf(p.station) === zone) knockout(r, p, "plasma");
}
export function delay(r, p, turn) {
  if (turn > r.lastTurn || p.knockedOut || p.space) return false;
  if (r.delayed[`${p.id}/${turn}`]) return false;
  const program = r.programs[p.id];
  if (program[turn - 1]?.protected && r.turnState.splitPending !== p.id)
    return false;
  r.delayed[`${p.id}/${turn}`] = true;
  let carry = null;
  for (let i = turn - 1; i < r.lastTurn; i++) {
    const next = program[i];
    program[i] = carry;
    carry = next;
    if (!next) break;
  }
  note(r, "delay", { crew: p.id, from: turn, dropped: carry ?? null });
  return true;
}
function activeMalfunctions(r, station, action) {
  return r.threats.filter(
    (t) =>
      t.position === "internal" &&
      t.repair === action &&
      t.stations.includes(station) &&
      ongoing(t) &&
      !t.phasedOut,
  );
}
function repair(
  r,
  p,
  action,
  hero = false,
  station = p.station,
  remote = false,
) {
  const all = activeMalfunctions(r, station, action);
  if (!all.length) return false;
  const t = all.find(live);
  if (t) {
    t.repairsThisTurn ??= [];
    t.repairsThisTurn.push({ station, crew: p.id });
    if (t.simultaneousRepairs) {
      note(r, "repair-attempt", { crew: p.id, threat: t.instance });
      return true;
    }
    const bonus =
      t.botsRepairBonus && p.bots !== null && !r.ship.bots[p.bots].disabled
        ? t.botsRepairBonus
        : 0;
    const amount = hitInternal(
      r,
      t,
      (hero ? 2 : 1) + bonus,
      p,
      station,
      remote,
    );
    note(r, "repair", { crew: p.id, threat: t.instance, amount });
    if (t.damage >= t.hp && !t.slime) destroyThreat(r, t);
  } else
    note(r, "ineffective", {
      crew: p.id,
      action,
      reason: "irreparable-system",
    });
  return true;
}
export function fire(
  r,
  p,
  hero = false,
  station = p.station,
  enhanced = false,
) {
  const zone = zoneOf(station),
    deck = deckOf(station),
    z = r.ship.zones[zone];
  const prepared = r.ship.preparedWeapons.includes(station);
  r.ship.preparedWeapons = r.ship.preparedWeapons.filter((x) => x !== station);
  if (repair(r, p, "A", hero, station)) return;
  if (r.turnState.fired.includes(station)) {
    note(r, "ineffective", {
      crew: p.id,
      action: "A",
      reason: "already-fired",
    });
    return;
  }
  const pulse = station === "white-lower",
    light = deck === "lower" && !pulse;
  if (!light && z.reactor === 0) {
    note(r, "ineffective", { crew: p.id, action: "A", reason: "no-energy" });
    return;
  }
  if (!light) z.reactor--;
  const damaged = z.damage.includes(`${deck}-weapon`);
  const strength =
    (pulse ? (enhanced ? 2 : 1) : light ? 2 : zone === "white" ? 5 : 4) +
    Number(hero) +
    Number(prepared && !pulse) -
    Number(damaged && !pulse);
  const range = pulse ? 2 - Number(damaged) + Number(prepared) : 3;
  r.turnState.fired.push(station);
  r.turnState.shots.push({
    kind: pulse ? "pulse" : light ? "light" : "heavy",
    zone: pulse ? "all" : zone,
    strength,
    range,
    enhanced,
    crew: p.id,
  });
  note(r, "fire", { crew: p.id, station, strength, range });
  if (station === "white-upper")
    for (const t of r.threats.filter(
      (t) => live(t) && !t.phasedOut && t.shortCircuit,
    ))
      for (const z of ZONES) attack(r, t, 1, z, "shielded");
}
export function transferEnergy(
  r,
  p,
  hero = false,
  station = p.station,
  remote = false,
) {
  if (repair(r, p, "B", hero, station, remote)) return;
  const zone = zoneOf(station),
    system = deckOf(station) === "upper" ? "shield" : "reactor",
    z = r.ship.zones[zone];
  const source = system === "shield" ? z : r.ship.zones.white;
  let count;
  if (system === "reactor" && zone === "white") {
    if (!r.ship.fuel) {
      note(r, "ineffective", { crew: p.id, action: "B", reason: "no-fuel" });
      return;
    }
    r.ship.fuel--;
    count = Math.max(0, capacity(r, zone, system) - z[system]);
    z[system] += count;
  } else {
    count = Math.max(
      0,
      Math.min(source.reactor, capacity(r, zone, system) - z[system]),
    );
    source.reactor -= count;
    z[system] += count;
  }
  if (hero && count > 0) z[system]++;
  note(r, "energy", {
    crew: p.id,
    station,
    amount: count + Number(hero && count > 0),
    system,
  });
}
export function actionC(
  r,
  p,
  station = p.station,
  { remote = false, doubleRocket = false, visual = 1 } = {},
) {
  if (repair(r, p, "C", false, station, remote)) return;
  if (station === "white-upper") {
    if ([1, 2, 4, 5, 8, 9].includes(r.turn))
      r.ship.computer[phaseForTurn(r.turn) - 1] = true;
    note(r, "computer", { crew: p.id, phase: phaseForTurn(r.turn) });
  } else if (station === "blue-lower") {
    if (
      !r.ship.rockets ||
      r.ship.rocketFlight.some((x) => x.launched === r.turn)
    ) {
      note(r, "ineffective", {
        crew: p.id,
        action: "C",
        reason: "rocket-unavailable",
      });
      return;
    }
    const count = doubleRocket && r.ship.rockets >= 2 ? 2 : 1;
    r.ship.rockets -= count;
    r.ship.rocketFlight.push({
      launched: r.turn,
      strength: count === 2 ? 5 : 3,
      crew: p.id,
    });
    note(r, "rocket-launched", { crew: p.id, count });
  } else if (station === "white-lower") r.turnState.visual += visual;
  else if (station === "red-upper") {
    if (
      p.bots === null ||
      r.ship.bots[p.bots].disabled ||
      r.ship.crew.some((x) => x.space)
    )
      return;
    p.space = 1;
    note(r, "launch-interceptors", { crew: p.id });
  } else {
    if (p.bots !== null) {
      r.ship.bots[p.bots].disabled = false;
      note(r, "bots-reactivated", { crew: p.id });
      return;
    }
    const i = r.ship.bots.findIndex(
      (b) => b.station === station && b.owner === null,
    );
    if (i >= 0) {
      r.ship.bots[i].owner = p.id;
      p.bots = i;
      note(r, "bots-activated", { crew: p.id });
    }
  }
}
function moveStation(station, direction) {
  const z = zoneOf(station),
    deck = deckOf(station);
  if (direction === "lift")
    return `${z}-${deck === "upper" ? "lower" : "upper"}`;
  return `${ZONES[Math.max(0, Math.min(2, ZONES.indexOf(z) + (direction === "red" ? -1 : 1)))]}-${deck}`;
}
function doorBlocked(r, from, to) {
  if (zoneOf(from) === zoneOf(to)) return false;
  return r.threats.some(
    (t) =>
      ongoing(t) &&
      ((t.flags.includes("sealed-red") &&
        [zoneOf(from), zoneOf(to)].includes("red")) ||
        (t.flags.includes("sealed-blue") &&
          [zoneOf(from), zoneOf(to)].includes("blue"))),
  );
}
function entryEffects(r, p, old, protectedAction = false, ordinary = true) {
  if (old === p.station || protectedAction) return false;
  let delayed = false;
  for (const t of r.threats) {
    if (
      ongoing(t) &&
      !t.phasedOut &&
      t.flags.includes("lethal-entry") &&
      t.stations.includes(p.station)
    )
      knockout(r, p, t.instance);
    if (
      ongoing(t) &&
      !t.phasedOut &&
      t.slime &&
      t.stations.includes(p.station)
    ) {
      delay(r, p, r.turn + 1);
      delayed = true;
    }
    if (ordinary && live(t) && t.parasite && t.host === undefined) {
      t.host = p.id;
      t.stations = [p.station];
      t.zone = zoneOf(p.station);
      note(r, "parasite-attached", { threat: t.instance, crew: p.id });
    }
  }
  return delayed;
}
function recordMovement(r, p, old, protectedAction) {
  if (old !== p.station && !protectedAction)
    (r.turnState.movements[p.id] ??= []).push([old, p.station]);
}
export function moveCrew(r, p, direction, protectedAction = false) {
  const old = p.station,
    target = moveStation(old, direction);
  if (!protectedAction && doorBlocked(r, old, target)) {
    note(r, "ineffective", {
      crew: p.id,
      action: direction,
      reason: "sealed-door",
    });
    return false;
  }
  p.station = target;
  recordMovement(r, p, old, protectedAction);
  note(r, "move", { crew: p.id, from: old, to: p.station });
  const slimed = entryEffects(r, p, old, protectedAction);
  if (direction === "lift") {
    const zone = zoneOf(old),
      busy =
        r.turnState.lifts.includes(zone) ||
        r.ship.zones[zone].damage.includes("lift");
    r.turnState.lifts.push(zone);
    if (busy && !protectedAction) {
      delay(r, p, r.turn + 1);
      return true;
    }
  }
  return slimed;
}
export function heroicMovement(r, p, target, protectedAction = false) {
  const old = p.station;
  let current = old;
  while (zoneOf(current) !== zoneOf(target)) {
    const next = moveStation(
      current,
      ZONES.indexOf(zoneOf(current)) < ZONES.indexOf(zoneOf(target))
        ? "blue"
        : "red",
    );
    if (!protectedAction && doorBlocked(r, current, next)) break;
    current = next;
  }
  p.station = `${zoneOf(current)}-${deckOf(target)}`;
  recordMovement(r, p, old, protectedAction);
  note(r, "move", { crew: p.id, from: old, to: p.station });
  return entryEffects(r, p, old, protectedAction);
}
function hitInternal(r, t, amount, p, station = p?.station, remote = false) {
  const absorbed = Math.min(
    amount,
    Math.max(0, (t.inaccessibility ?? 0) - (t.absorbedThisTurn ?? 0)),
  );
  t.absorbedThisTurn = (t.absorbedThisTurn ?? 0) + absorbed;
  amount -= absorbed;
  if (t.damage + amount >= t.hp) {
    if (remote) amount = Math.max(0, t.hp - t.damage - 1);
    else if (t.finishEnergy) {
      const z = r.ship.zones[zoneOf(station)];
      if (z.reactor > 0) z.reactor--;
      else amount = Math.max(0, t.hp - t.damage - 1);
    }
  }
  t.damage += amount;
  if (amount && t.swapDeckOnHit)
    for (const c of r.ship.crew)
      if (!c.space && !r.turnState.pendingProtected.includes(c.id))
        c.station = moveStation(c.station, "lift");
  if (amount && t.teleportsOnHit) {
    t.stations = [t.teleportsOnHit];
    t.zone = zoneOf(t.teleportsOnHit);
  }
  if (t.damage >= t.hp) {
    destroyThreat(r, t);
    if (t.parasite && t.host !== undefined)
      knockout(r, r.ship.crew[t.host], t.instance);
  }
  return amount;
}
function battle(r, p, hero) {
  if (p.bots === null || r.ship.bots[p.bots].disabled) return;
  const t = r.threats.find(
    (t) =>
      live(t) &&
      t.position === "internal" &&
      t.repair === "bots" &&
      !t.phasedOut &&
      (!t.parasite ||
        (t.host !== undefined &&
          t.host !== p.id &&
          !r.ship.crew[t.host].space)) &&
      t.stations.includes(p.station),
  );
  if (!t) return;
  if (t.slime) {
    const token = t.slimeTokens.find((x) => x.station === p.station);
    token.hp--;
    if (token.original) t.damage++;
    if (token.hp <= 0) {
      t.slimeTokens = t.slimeTokens.filter((x) => x !== token);
      t.stations = t.slimeTokens.map((x) => x.station);
    }
    if (!t.slimeTokens.length) destroyThreat(r, t);
    note(r, "battlebots-hit", { crew: p.id, threat: t.instance, amount: 1 });
    return;
  }
  const amount = hitInternal(r, t, 1, p);
  note(r, "battlebots-hit", { crew: p.id, threat: t.instance, amount });
  if ((t.returnsFire || (t.grows && t.flags.includes("grown"))) && !hero)
    r.ship.bots[p.bots].disabled = true;
  if (t.removeTokenOnHit)
    t.stations = t.stations.filter((s) => s !== p.station);
  if (t.damage >= t.hp) {
    destroyThreat(r, t);
    if (t.deathKnocksAttacker) knockout(r, p, t.instance);
  }
}
export function execute(r, p, action, protectedAction = false) {
  let heroic = action.startsWith("hero:");
  if (heroic) action = action.slice(5);
  if (
    ["A", "B", "bots"].includes(action) &&
    (p.prepared || r.turnState.stimulated.includes(p.id))
  ) {
    heroic = true;
    p.prepared = false;
  }
  if (["red", "blue", "lift"].includes(action))
    return moveCrew(r, p, action, protectedAction);
  if (action.startsWith("teleport:")) {
    return heroicMovement(r, p, action.slice(9), protectedAction);
  }
  if (action.startsWith("special:")) {
    specialAction(r, p, action.split(":")[1], action.split(":")[2], {
      fire,
      transferEnergy,
      actionC,
      repair,
      execute,
      delay,
      note,
      capacity,
      heroicMovement,
    });
    return false;
  }
  if (action === "A") fire(r, p, heroic);
  else if (action === "B") transferEnergy(r, p, heroic);
  else if (action === "C") actionC(r, p);
  else if (action === "bots") battle(r, p, heroic);
  return false;
}
function inSpace(r, p, actions) {
  if (actions.includes("C") && r.doubleActions) {
    p.space++;
    if (p.space > 3) {
      p.space = 0;
      p.station = "red-upper";
      knockout(r, p, "ultrafast-return");
      entryEffects(r, p, "space", false, false);
    }
  } else if (
    actions.some(
      (x) =>
        x === "bots" ||
        x === "hero:bots" ||
        x === "special:squad-leader:advanced",
    )
  ) {
    if (
      actions.includes("hero:bots") ||
      actions.includes("special:squad-leader:advanced")
    )
      r.turnState.interceptorBonus = 1;
  } else {
    if (actions.length) {
      // In-space delays still shift the program, even though other delays don't affect pilots.
      const space = p.space;
      p.space = 0;
      delay(r, p, r.turn);
      p.space = space;
    }
    p.space--;
    if (p.space === 0) {
      p.station = "red-upper";
      entryEffects(r, p, "space", false, false);
    }
  }
}
function crewActions(r) {
  const order = [...r.ship.crew].sort(
    (a, b) =>
      Number(
        r.programs[b.id][r.turn - 1]?.actions?.some((x) =>
          x.startsWith("special:medic:"),
        ),
      ) -
      Number(
        r.programs[a.id][r.turn - 1]?.actions?.some((x) =>
          x.startsWith("special:medic:"),
        ),
      ),
  );
  for (const p of order) {
    if (p.knockedOut) continue;
    const entry = r.programs[p.id][r.turn - 1],
      actions = entry?.actions ?? [];
    if (p.space) {
      inSpace(r, p, actions);
      if (entry?.protected) r.turnState.protectedPilot = p.id;
      r.turnState.pendingProtected = r.turnState.pendingProtected.filter(
        (id) => id !== p.id,
      );
      continue;
    }
    for (let i = 0; i < actions.length; i++) {
      r.turnState.splitPending = i < actions.length - 1 ? p.id : null;
      const delayed = execute(r, p, actions[i], entry?.protected);
      r.turnState.splitPending = null;
      r.turnState.stimulated = r.turnState.stimulated.filter((x) => x !== p.id);
      if (p.space || p.knockedOut) break;
      if (delayed && i < actions.length - 1) {
        r.programs[p.id][r.turn] = { ...entry, actions: actions.slice(i + 1) };
        break;
      }
    }
    const movements = r.turnState.movements[p.id] ?? [];
    // Consecutive movement halves form one path for Ninja poison; passing through is safe.
    if (movements.length) {
      const ends = [movements[0][0], movements.at(-1)[1]];
      for (const t of r.threats.filter(
        (t) => live(t) && t.poison && t.flags.includes("poison-entry"),
      ))
        if (ends.some((s) => ["blue-upper", "white-lower"].includes(s)))
          t.affected = [...new Set([...(t.affected ?? []), p.id])];
    }
    syncParasites(r);
    r.turnState.stimulated = r.turnState.stimulated.filter((x) => x !== p.id);
    if (p.space && entry?.protected) r.turnState.protectedPilot = p.id;
    r.turnState.pendingProtected = r.turnState.pendingProtected.filter(
      (id) => id !== p.id,
    );
  }
  for (const t of r.threats.filter(live)) {
    if (
      t.multiRepairBonus &&
      t.stations.every((s) => t.repairsThisTurn?.some((x) => x.station === s))
    )
      t.damage += t.multiRepairBonus;
    if (
      t.simultaneousRepairs &&
      new Set(t.repairsThisTurn?.map((x) => x.crew)).size >=
        t.simultaneousRepairs
    )
      t.damage++;
    if (
      t.loneRepair &&
      new Set(t.repairsThisTurn?.map((x) => x.crew)).size === 1
    )
      hitInternal(r, t, t.loneRepair, r.ship.crew[t.repairsThisTurn[0].crew]);
    if (t.damage >= t.hp && !t.slime) destroyThreat(r, t);
    t.repairsThisTurn = [];
  }
  const phase = phaseForTurn(r.turn) - 1;
  r.ship.visual[phase] = Math.max(
    r.ship.visual[phase],
    r.turnState.visual <= 3 ? r.turnState.visual : 2 * r.turnState.visual - 3,
  );
}
function targetable(t, shot, r) {
  if (!live(t) || t.position !== "external" || t.phasedOut) return false;
  if (t.stealth && !t.flags.includes("revealed")) return false;
  const distance = Math.min(3, Math.ceil(t.positionOnTrack / 5));
  if (shot.kind === "rocket" && t.rocketMagnet) return true;
  if (distance > (t.maxTargetRange ?? 3) || distance > shot.range) return false;
  if (shot.kind === "heavy" && t.noHeavy) return false;
  if (shot.kind === "rocket" && t.noRockets) return false;
  if (["heavy", "light"].includes(shot.kind)) {
    const blind = r.threats.some(
      (x) => ongoing(x) && x.blindZones?.includes(shot.zone),
    );
    if (
      blind &&
      !r.turnState.visual &&
      !r.ship.crew.some((p) => p.space && !p.knockedOut)
    )
      return false;
  }
  return (
    shot.zone === "all" ||
    shot.zone === t.zone ||
    (t.spans && ["heavy", "light"].includes(shot.kind))
  );
}
function destroyThreat(r, t) {
  if (!live(t)) return;
  t.status = "destroyed";
  for (const called of r.threats.filter(
    (x) => x.caller === t.instance && x.status === "waiting",
  )) {
    called.status = "destroyed";
    note(r, "threat-destroyed", { threat: called.instance, prevented: true });
  }
  if (t.calledCard && !t.hasCalled) {
    const child = makeCalled(r, t);
    child.status = "active";
    r.threats.push(child);
    destroyThreat(r, child);
  }
  note(r, "threat-destroyed", { threat: t.instance });
  if (t.deathKnockout)
    for (const p of r.ship.crew)
      if (!p.space && t.deathKnockout.includes(p.station))
        knockout(r, p, t.instance);
  if (t.asteroid) attack(r, t, t.asteroid * (t.fragments ?? 0));
  if (t.deathSplash)
    for (const other of r.threats.filter(
      (x) => live(x) && x.position === "external" && !x.phasedOut,
    )) {
      other.damage += t.deathSplash;
      if (other.damage >= other.hp) destroyThreat(r, other);
    }
}
function damageThreats(r) {
  const shots = [...r.turnState.shots];
  for (const rocket of r.ship.rocketFlight.filter(
    (x) => x.launched === (r.finalRocketTurn ?? r.turn - 1),
  ))
    shots.push({ ...rocket, kind: "rocket", range: 2, zone: "all" });
  const pilot = r.ship.crew.find((p) => p.space && !p.knockedOut);
  const fissure = r.threats.find((t) => live(t) && t.repair === "space-bots");
  if (pilot && fissure) {
    fissure.damage++;
    if (fissure.damage >= fissure.hp) destroyThreat(r, fissure);
  }
  if (pilot && !fissure) {
    const targets = r.threats.filter(
      (t) =>
        live(t) &&
        t.position === "external" &&
        Math.min(3, Math.ceil(t.positionOnTrack / 5)) === pilot.space &&
        targetable(t, { kind: "interceptors", range: 3, zone: "all" }, r),
    );
    for (const t of targets)
      shots.push({
        kind: "interceptors",
        specific: t.instance,
        range: pilot.space,
        zone: "all",
        strength:
          (targets.length === 1 ? 3 : 1) + (r.turnState.interceptorBonus ?? 0),
        crew: pilot.id,
      });
  }
  const hits = new Map();
  for (const shot of shots) {
    let targets = r.threats.filter(
      (t) =>
        targetable(t, shot, r) &&
        (shot.specific === undefined || t.instance === shot.specific),
    );
    if (shot.enhanced)
      targets = r.threats.filter((t) =>
        targetable(t, { ...shot, range: shot.range + 1 }, r),
      );
    targets.sort(
      (a, b) =>
        (shot.kind === "rocket"
          ? Number(!!b.rocketMagnet) - Number(!!a.rocketMagnet)
          : 0) ||
        a.positionOnTrack - b.positionOnTrack ||
        a.turn - b.turn ||
        a.instance - b.instance,
    );
    if (!["pulse", "interceptors"].includes(shot.kind))
      targets = targets.slice(0, 1);
    for (const t of targets) {
      const list = hits.get(t.instance) ?? [];
      list.push({
        ...shot,
        strength:
          shot.enhanced &&
          Math.min(3, Math.ceil(t.positionOnTrack / 5)) > shot.range
            ? 1
            : shot.strength,
      });
      hits.set(t.instance, list);
    }
  }
  // Compute all target assignments before any destruction or death effect.
  for (const t of [...r.threats]) {
    let h = hits.get(t.instance);
    if (!h?.length) continue;
    if (t.rocketMagnet && h.some((x) => x.kind === "rocket"))
      t.pendingShield = 1;
    if (t.rocketImmune) h = h.filter((x) => x.kind !== "rocket");
    if (t.behemoth)
      h = h.map((shot) => {
        if (shot.kind === "interceptors" && shot.strength >= 3) {
          const p = r.ship.crew[shot.crew];
          knockout(r, p, t.instance, r.turnState.protectedPilot === p.id);
          if (!p.knockedOut) {
            p.space = 0;
            p.station = "red-upper";
          }
          return { ...shot, strength: shot.strength + 6 };
        }
        return shot;
      });
    if (!h.length) continue;
    if (t.rocketDeflects && h.some((x) => x.kind === "rocket"))
      t.flags.push("off-course");
    if (t.cryo && !t.flags.includes("cryo-broken")) {
      t.flags.push("cryo-broken");
      note(r, "cryoshield-broken", { threat: t.instance });
      continue;
    }
    const shield =
      t.pulseBreaksShield && h.some((x) => x.kind === "pulse")
        ? 0
        : t.shield +
          r.threats.filter(
            (o) => o.status !== "destroyed" && o.flags.includes("shield-aura"),
          ).length;
    if (h.some((x) => x.kind === "interceptors")) t.interceptorHit = r.turn;
    const lasers = h
      .filter((x) => ["heavy", "light"].includes(x.kind))
      .reduce((n, x) => n + x.strength, 0);
    const other = h
      .filter((x) => !["heavy", "light"].includes(x.kind))
      .reduce((n, x) => n + x.strength, 0);
    const damage = Math.min(
      t.damageCap ?? Infinity,
      Math.max(
        0,
        (t.polarized ? Math.ceil(lasers / 2) : lasers) + other - shield,
      ),
    );
    t.damage += damage;
    if (damage) t.damagedThisTurn = true;
    if (t.pendingShield) {
      t.shield += t.pendingShield;
      delete t.pendingShield;
    }
    if (t.megashield) t.shield = Math.max(0, t.shield - 1);
    note(r, "threat-hit", {
      threat: t.instance,
      damage,
      shield,
      weapons: h.map((x) => x.kind),
    });
  }
  for (const t of r.threats)
    if (live(t) && !t.slime && t.damage >= t.hp) destroyThreat(r, t);
  for (const t of r.threats.filter(
    (t) => t.retaliates && t.damage > (t.damageAtTurnStart ?? 0),
  ))
    for (const z of ZONES) attack(r, t, 1, z);
  r.ship.rocketFlight = r.ship.rocketFlight.filter((x) => x.launched >= r.turn);
}
function effect(r, t, e) {
  if (
    (e.onlyPhasedIn && t.wasPhasedOut) ||
    (e.ifCrew &&
      !r.ship.crew.some((p) => !p.space && t.stations.includes(p.station))) ||
    (e.ifDamaged && !t.damage) ||
    (e.ifUndamaged && t.damage) ||
    (e.belowDamage !== undefined && t.damage >= e.belowDamage) ||
    (e.unlessFlag && t.flags.includes(e.unlessFlag))
  )
    return;
  const zones = ZONES.includes(e.zones)
    ? [e.zones]
    : e.zones === "stations"
      ? t.stations.map(zoneOf)
      : e.zones === "occupied"
        ? [...new Set(t.stations.map(zoneOf))]
        : e.zones === "all"
          ? ZONES
          : e.zones === "lateral"
            ? ["red", "blue"]
            : e.zones === "other"
              ? ZONES.filter((z) => z !== t.zone)
              : [t.zone];
  if (e.type === "attack") {
    const amount =
      e.amount === "reactor"
        ? r.ship.zones[t.zone].reactor
        : e.amount === "crew"
          ? r.ship.crew.filter(
              (p) => !p.space && t.stations.includes(p.station),
            ).length
          : e.amount === "hp"
            ? t.hp - t.damage
            : e.amount === "double-hp"
              ? 2 * (t.hp - t.damage)
              : e.amount === "triple-hp"
                ? 3 * (t.hp - t.damage)
                : t.wasPhasedOut && e.phasedAmount !== undefined
                  ? e.phasedAmount
                  : e.amount;
    for (const z of zones)
      attack(
        r,
        t,
        e.amount === "reactor+1" ? r.ship.zones[z].reactor + 1 : amount,
        z,
        e.mode,
      );
  } else if (e.type === "heal")
    t.damage = Math.max(
      0,
      t.damage - (e.amount === "half" ? Math.floor(t.damage / 2) : e.amount),
    );
  else if (e.type === "change") t[e.stat] = (t[e.stat] ?? 0) + e.amount;
  else if (e.type === "set") t[e.stat] = e.amount;
  else if (e.type === "flag") t.flags.push(e.name);
  else if (e.type === "drain")
    for (const z of zones)
      r.ship.zones[z][e.system] = Math.max(
        0,
        r.ship.zones[z][e.system] - (e.amount ?? 99),
      );
  else if (e.type === "move") {
    t.stations = t.stations.map((s) => {
      const next = moveStation(
        s,
        t.wasPhasedOut && e.phasedDirection ? e.phasedDirection : e.direction,
      );
      return doorBlocked(r, s, next) ? s : next;
    });
    t.zone = zoneOf(t.stations[0]);
  } else if (e.type === "drain-or-damage") {
    const z = r.ship.zones[t.zone];
    if (z.reactor) z.reactor--;
    else damageShip(r, t.zone, 1, t.instance);
  } else if (e.type === "knockout" || e.type === "delay") {
    for (const p of r.ship.crew)
      if (!p.space) {
        const inStation = t.stations?.includes(p.station),
          hasBots = p.bots !== null && !r.ship.bots[p.bots].disabled;
        const applies =
          e.scope === "all" ||
          (e.scope === "station" && inStation) ||
          (e.scope === "zone" && zoneOf(p.station) === t.zone) ||
          (e.scope === "active-bots" && hasBots) ||
          (e.scope === "without-bots" && inStation && !hasBots) ||
          (e.scope === "except-bridge" && p.station !== "white-upper") ||
          (e.scope === "alone" &&
            r.ship.crew.filter((c) => !c.space && c.station === p.station)
              .length === 1) ||
          (e.scope === "group" &&
            r.ship.crew.filter((c) => !c.space && c.station === p.station)
              .length > 1);
        if (applies) {
          if (e.type === "knockout") knockout(r, p, t.instance);
          else delay(r, p, r.turn + 1);
        }
      }
  } else if (e.type === "slime-spread") {
    const original = [...t.slimeTokens];
    for (const token of original) {
      const station = moveStation(token.station, t.slime);
      if (
        station !== token.station &&
        !r.threats.some(
          (o) =>
            o.slime &&
            !["destroyed", "pending"].includes(o.status) &&
            o.stations.includes(station),
        )
      )
        t.slimeTokens.push({ station, hp: 1, original: false });
    }
    t.stations = t.slimeTokens.map((x) => x.station);
  } else if (e.type === "remove-rocket") {
    if (r.ship.rockets) {
      r.ship.rockets--;
      for (const o of r.threats.filter((x) => x.rocketHp && live(x))) {
        o.hp--;
        if (o.damage >= o.hp) destroyThreat(r, o);
      }
    }
  } else if (e.type === "disable-stored-bots") {
    const b = r.ship.bots.find(
      (b) => b.station === "red-lower" && b.owner === null,
    );
    if (b) b.disabled = true;
  } else if (e.type === "fuel-lost") r.ship.fuel = Math.max(0, r.ship.fuel - 1);
  else if (e.type === "self-damage") {
    t.damage += e.amount;
    if (t.damage >= t.hp) destroyThreat(r, t);
  } else if (e.type === "seek") {
    const choices = [
      ...new Set(
        ["red", "blue", "lift"].map((d) => moveStation(t.stations[0], d)),
      ),
    ].filter((s) => s !== t.stations[0]);
    const counts = choices
      .map((s) => ({
        s,
        n: r.ship.crew.filter((p) => !p.space && p.station === s).length,
      }))
      .sort((a, b) => b.n - a.n);
    if (counts[0]?.n !== counts[1]?.n) {
      t.stations = [counts[0].s];
      t.zone = zoneOf(counts[0].s);
    }
  } else if (e.type === "advance-others")
    for (const other of r.threats
      .filter(
        (o) =>
          live(o) &&
          o.position === (e.position ?? "external") &&
          o !== t &&
          !o.phasedOut,
      )
      .sort((a, b) => a.turn - b.turn))
      advanceThreat(r, other, 1);
  else if (e.type === "destroy-ship") {
    r.ship.destroyed = true;
    note(r, "ship-destroyed", { source: t.instance });
  } else if (e.type === "fill-shield") {
    const z = r.ship.zones[t.zone],
      n = Math.max(
        0,
        Math.min(z.reactor, capacity(r, t.zone, "shield") - z.shield),
      );
    z.reactor -= n;
    z.shield += n;
  } else if (e.type === "leak")
    for (const z of zones) {
      const n = r.ship.zones[z][e.system];
      r.ship.zones[z][e.system] = 0;
      damageShip(r, z, n, t.instance);
    }
  else expansionEffect(r, t, e);
}
function advanceThreat(r, t, speed) {
  // Keep the starting trajectory for every crossed marker even if an action jumps.
  const track = t.track,
    start = t.positionOnTrack,
    end = Math.max(1, start - speed);
  for (let at = start - 1; at >= end && live(t) && !r.ship.destroyed; at--) {
    t.positionOnTrack = at;
    const mark = track.marks.find(([position]) => position === at)?.[1];
    if (!mark) continue;
    note(r, "threat-action", { threat: t.instance, mark });
    for (const e of t.effects[mark]) {
      effect(r, t, e);
      if (r.ship.destroyed) break;
    }
    if (mark === "Z" && live(t)) {
      t.status = "survived";
      t.phasedOut = false;
      note(r, "threat-survived", { threat: t.instance });
    }
  }
  if (live(t)) t.positionOnTrack = end;
}
function moveThreats(r) {
  syncParasites(r);
  const threats = r.threats.filter(
    (t) =>
      live(t) ||
      (t.status === "destroyed" &&
        (t.poison || t.infection) &&
        t.affected?.length),
  );
  threats.sort(
    (a, b) =>
      (a.calledOrder ?? -1) - (b.calledOrder ?? -1) ||
      a.turn - b.turn ||
      Number(a.position === "internal") - Number(b.position === "internal") ||
      a.instance - b.instance,
  );
  for (const t of threats) {
    if (t.status === "destroyed") {
      t.positionOnTrack = Math.max(
        1,
        t.positionOnTrack - Math.max(0, t.speed - (r.turnState.slow ?? 0)),
      );
      if (t.positionOnTrack === 1)
        expansionEffect(r, t, {
          type: t.poison ? "poison-detonate" : "infection-detonate",
        });
    } else if (live(t)) {
      t.wasPhasedOut = !!t.phasedOut;
      t.phasedOut = false;
      const speed =
        t.slowsWhenHit && t.damagedThisTurn ? t.slowsWhenHit : t.speed;
      advanceThreat(r, t, Math.max(0, speed - (r.turnState.slow ?? 0)));
      if (t.phasing && live(t)) t.phasedOut = !t.wasPhasedOut;
      if (t.accelerates && live(t)) t.speed += t.accelerates;
    }
  }
  for (const t of r.threats.filter((t) => t.status === "waiting"))
    activateThreat(r, t);
}
function activateThreat(r, t) {
  t.status = "active";
  t.positionOnTrack = t.track.length;
  t.appearedAt = r.turn;
  // Official expansion appendix: drones poison from appearance (see component audit).
  if (t.poison) t.flags.push("poison-entry");
  if (t.parityStation) t.stations = [r.turn % 2 ? "red-upper" : "blue-upper"];
  if (t.position === "internal")
    t.zone = t.stations.length ? zoneOf(t.stations[0]) : "white";
  if (t.rocketHp) t.hp = r.ship.rockets;
  if (t.slime)
    t.slimeTokens = [{ station: t.stations[0], hp: 2, original: true }];
  note(r, "threat-appears", { threat: t.instance });
  if (t.hp === 0) destroyThreat(r, t);
}
function appear(r) {
  for (const t of r.threats.filter(
    (t) => t.turn === r.turn && t.status === "pending",
  )) {
    activateThreat(r, t);
  }
}
export function score(r) {
  const damage = ZONES.map((z) => r.ship.zones[z].damage.length);
  const penalties =
    damage.reduce((a, b) => a + b, 0) +
    Math.max(...damage) +
    2 * r.ship.crew.filter((p) => p.knockedOut).length +
    r.ship.bots.filter((b) => b.disabled).length;
  const threats = r.threats.reduce(
    (sum, t) =>
      sum +
      (t.status === "destroyed"
        ? t.points[1]
        : t.status === "survived"
          ? t.points[0]
          : 0),
    0,
  );
  const visual = r.ship.visual.reduce((a, b) => a + b, 0);
  return {
    survived: !r.ship.destroyed,
    score: r.ship.destroyed ? 0 : threats + visual + r.ship.bonus - penalties,
    threatPoints: threats,
    visual,
    bonus: r.ship.bonus,
    penalties,
  };
}
function capture(r) {
  r.frames.push({
    turn: r.turn,
    step: r.step,
    ship: structuredClone(r.ship),
    threats: structuredClone(r.threats),
    logEnd: r.log.length,
  });
}
export function stepResolution(input) {
  const r = structuredClone(input);
  if (r.outcome) return r;
  if (r.step === "appear") {
    r.turn = r.jumpPending ? r.finalTurn : r.turn + 1;
    if (r.jumpPending) {
      r.finalRocketTurn = r.lastTurn;
      delete r.jumpPending;
    }
    r.turnState = {
      fired: [],
      movements: {},
      shots: [],
      lifts: [],
      visual: 0,
      stimulated: [],
      protectingMedics: [],
      pendingProtected: r.programs.flatMap((program, id) =>
        program[r.turn - 1]?.protected ? [id] : [],
      ),
      temporaryShields: { red: 0, white: 0, blue: 0 },
    };
    for (const t of r.threats) {
      t.damageAtTurnStart = t.damage;
      t.absorbedThisTurn = 0;
      t.damagedThisTurn = false;
    }
    appear(r);
    r.step = r.turn > r.lastTurn ? "damage" : "crew";
    if (r.turn > r.lastTurn)
      for (const p of r.ship.crew)
        if (p.space) {
          if (p.space > 1) knockout(r, p, "ultrafast-return");
          p.space = 0;
          p.station = "red-upper";
          entryEffects(r, p, "space", false, false);
        }
  } else if (r.step === "crew") {
    crewActions(r);
    r.step = "damage";
  } else if (r.step === "damage") {
    damageThreats(r);
    r.step = "threats";
  } else if (r.step === "threats") {
    moveThreats(r);
    r.step = "computer";
  } else if (r.step === "computer") {
    if (
      [2, 5, 9].includes(r.turn) &&
      !r.ship.computer[phaseForTurn(r.turn) - 1]
    ) {
      note(r, "computer-missed", { phase: phaseForTurn(r.turn) });
      for (const p of r.ship.crew) delay(r, p, r.turn + 1);
    }
    if (r.turn > r.lastTurn || r.turnState.earlyJump) {
      if (r.turnState.earlyJump) {
        r.lastTurn = r.turn;
        r.jumpPending = true;
      } else {
        finishThreats(r);
        r.outcome = score(r);
      }
    }
    r.step = "appear";
  }
  if (r.ship.destroyed) r.outcome = score(r);
  capture(r);
  return r;
}
export function resolveAll(input) {
  let r = input;
  for (let i = 0; i < 100 && !r.outcome; i++) r = stepResolution(r);
  if (!r.outcome) throw Error("Resolution did not terminate");
  return r;
}

function makeCalled(r, t, e = {}) {
  if (!t.calledCard) throw Error(`Missing called threat for ${t.id}`);
  const data =
    typeof t.calledCard === "string" ? { cardId: t.calledCard } : t.calledCard;
  const card = threatById(data.cardId);
  const zone =
    card.position === "internal"
      ? null
      : ZONES.includes(e.zone)
        ? e.zone
        : t.zone;
  t.hasCalled = true;
  return {
    ...card,
    calledCard: data.calledCard ?? null,
    vortexCard: data.vortexCard ?? null,
    instance: Math.max(-1, ...r.threats.map((x) => x.instance)) + 1,
    caller: t.instance,
    calledOrder: r.nextCalled++,
    turn: r.turn,
    zone,
    track: r.tracks[zone ?? "internal"],
    status: "waiting",
    damage: 0,
    flags: [],
    positionOnTrack: 0,
  };
}
function syncParasites(r) {
  for (const t of r.threats.filter(
    (t) => live(t) && t.parasite && t.host !== undefined,
  )) {
    const p = r.ship.crew[t.host];
    if (p.knockedOut) {
      t.status = "survived";
      note(r, "threat-survived", { threat: t.instance });
    } else {
      t.stations = p.space ? [] : [p.station];
      t.zone = zoneOf(p.station);
    }
  }
}
function expansionEffect(r, t, e) {
  const crewHere = () =>
    r.ship.crew.filter((p) => !p.space && t.stations?.includes(p.station));
  if (e.type === "jump") {
    const destination =
      ZONES[(ZONES.indexOf(t.zone) + (e.direction === "left" ? 2 : 1)) % 3];
    if (r.tracks[destination].length >= t.positionOnTrack) {
      t.zone = destination;
      t.track = r.tracks[destination];
      note(r, "threat-jump", { threat: t.instance, zone: destination });
    }
  } else if (e.type === "call") {
    if (t.hasCalled) return;
    const child = makeCalled(r, t, e);
    if (e.undamagedSpeed && t.damage < 2) child.speed++;
    r.threats.push(child);
    note(r, "threat-called", { threat: child.instance, caller: t.instance });
  } else if (e.type === "heal-others") {
    for (const o of r.threats.filter(
      (o) => live(o) && !o.phasedOut && o.position === e.position,
    ))
      o.damage = Math.max(0, o.damage - e.amount);
  } else if (e.type === "knockout-delay") {
    for (const p of r.ship.crew)
      if (!p.space) {
        if (p.bots !== null && !r.ship.bots[p.bots].disabled)
          knockout(r, p, t.instance);
        else delay(r, p, r.turn + 1);
      }
  } else if (e.type === "advance-zone") {
    for (const o of [...r.threats].filter(
      (o) =>
        live(o) &&
        !o.phasedOut &&
        o.position === "external" &&
        o.zone === e.zone,
    ))
      advanceThreat(r, o, e.amount);
  } else if (e.type === "opposite-damage") {
    damageShip(r, t.zone === "red" ? "blue" : "red", e.amount, t.instance);
  } else if (e.type === "short-circuit") {
    const container = e.resource === "fuel" ? r.ship : r.ship.zones.white;
    if (container[e.resource] > 0) {
      container[e.resource]--;
      for (const z of ZONES) attack(r, t, 1, z, "shielded");
    }
  } else if (e.type === "drill-move") {
    const sorted = ZONES.map((z) => ({
      z,
      n: r.ship.zones[z].damage.length,
    })).sort((a, b) => b.n - a.n);
    const target = sorted[0].n === sorted[1].n ? "white" : sorted[0].z;
    if (target !== t.zone)
      effect(r, t, {
        type: "move",
        direction:
          ZONES.indexOf(target) < ZONES.indexOf(t.zone) ? "red" : "blue",
      });
  } else if (e.type === "shambler") {
    if (crewHere().length) damageShip(r, t.zone, 2, t.instance);
    else t.damage = Math.max(0, t.damage - 1);
  } else if (e.type === "blind") {
    t.blindZones ??= [];
    t.blindZones.push(
      e.zone === "lateral"
        ? t.blindZones.includes("red")
          ? "blue"
          : "red"
        : e.zone,
    );
  } else if (e.type === "mine") {
    (t.mines ??= []).push(t.stations[0]);
  } else if (e.type === "detonate-mines") {
    for (const s of t.mines ?? []) damageShip(r, zoneOf(s), 2, t.instance);
    t.mines = [];
  } else if (e.type === "infect") {
    t.affected = [
      ...new Set([...(t.affected ?? []), ...crewHere().map((p) => p.id)]),
    ];
  } else if (e.type === "infection-detonate") {
    for (const id of t.affected ?? []) {
      const p = r.ship.crew[id];
      if (!p.space && !p.knockedOut)
        damageShip(r, zoneOf(p.station), 2, t.instance);
    }
    t.affected = [];
  } else if (e.type === "poison-detonate") {
    for (const id of t.affected ?? []) knockout(r, r.ship.crew[id], t.instance);
    t.affected = [];
    t.flags = t.flags.filter((f) => f !== "poison-entry");
    if (live(t)) {
      const count = r.ship.rockets;
      r.ship.rockets = 0;
      for (let i = 0; i < count; i++) attack(r, t, 2, "red", "shielded");
    }
  } else if (e.type === "repeat-action") {
    for (const p of r.ship.crew) {
      const entry = structuredClone(r.programs[p.id][r.turn - 1]);
      if (delay(r, p, r.turn + 1)) r.programs[p.id][r.turn] = entry;
    }
  } else if (e.type === "swap-zones") {
    for (const p of r.ship.crew)
      if (
        !p.space &&
        !r.turnState.pendingProtected.includes(p.id) &&
        zoneOf(p.station) !== "white"
      )
        p.station = `${zoneOf(p.station) === "red" ? "blue" : "red"}-${deckOf(p.station)}`;
  } else if (e.type === "vortex-draw") {
    if (!t.vortexCard) throw Error("Missing Vortex draw");
    const data =
      typeof t.vortexCard === "string"
        ? { cardId: t.vortexCard }
        : t.vortexCard;
    const child = {
      ...threatById(data.cardId),
      calledCard: data.calledCard ?? null,
      instance: Math.max(...r.threats.map((x) => x.instance)) + 1,
      turn: r.turn,
      status: "pending",
      damage: 0,
      flags: [],
      track: r.tracks.internal,
      points: [0, 0],
    };
    r.threats.push(child);
    activateThreat(r, child);
    advanceThreat(r, child, child.track.length);
    child.status = "discarded";
  } else if (e.type === "absorb-reactor") {
    t.speed += r.ship.zones[t.zone].reactor;
    r.ship.zones[t.zone].reactor = 0;
  } else if (e.type === "sabotage") {
    for (const repair of ["A", "B", "C"])
      r.threats.push({
        id: `${t.id}/${t.stations[0]}/${repair}`,
        name: "Sabotaged system",
        instance: Math.max(...r.threats.map((x) => x.instance)) + 1,
        position: "internal",
        repair,
        stations: [...t.stations],
        zone: t.zone,
        hp: 1,
        damage: 0,
        shield: 0,
        speed: 0,
        status: "active",
        turn: t.turn,
        track: t.track,
        positionOnTrack: t.positionOnTrack,
        flags: [],
        points: [0, 0],
        effects: { X: [], Y: [], Z: [] },
        sabotage: true,
      });
  } else if (e.type.startsWith("parasite-")) {
    if (t.host === undefined) return;
    const p = r.ship.crew[t.host];
    if (p.knockedOut) return;
    if (e.type === "parasite-drain" && !p.space) {
      const z = r.ship.zones[zoneOf(p.station)],
        system = deckOf(p.station) === "upper" ? "shield" : "reactor";
      z[system] = Math.max(0, z[system] - 1);
    } else if (e.type === "parasite-knockout" && !p.space) {
      for (const c of r.ship.crew)
        if (c.id !== p.id && !c.space && c.station === p.station)
          knockout(r, c, t.instance);
    } else if (e.type === "parasite-attack") {
      if (p.space) attack(r, t, 5, "white", "shielded");
      else damageShip(r, zoneOf(p.station), 5, t.instance);
    }
  } else throw Error(`Unsupported threat effect: ${e.type}`);
}
function finishThreats(r) {
  for (const t of r.threats.filter((t) => live(t) && t.web)) {
    for (const e of t.effects.Z) effect(r, t, e);
    t.status = "survived";
    note(r, "threat-survived", { threat: t.instance });
  }
  if (r.threats.some((t) => t.gremlin && ongoing(t)))
    for (const p of r.ship.crew) knockout(r, p, "cyber-gremlin");
}
