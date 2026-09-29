// The New Frontier pp. 16–23. The engine owns the meaning of an action;
// UI descriptions never decide whether an effect is legal.
import { shuffle, random } from "./random.js";
export function specialAction(r, p, name, tier, api) {
  const { fire, transferEnergy, actionC, repair, note } = api;
  const advanced = tier === "advanced",
    station = p.station,
    zone = station.split("-")[0];
  const damaged = (s, a) =>
    r.threats.some(
      (t) =>
        t.position === "internal" &&
        t.repair === a &&
        t.stations.includes(s) &&
        !["pending", "destroyed"].includes(t.status) &&
        !t.phasedOut,
    );
  note(r, "specialization", { crew: p.id, name, tier });
  if (name === "rocketeer") {
    if (!advanced) actionC(r, p, "blue-lower", { remote: true });
    else actionC(r, p, station, { doubleRocket: station === "blue-lower" });
  } else if (name === "data-analyst") {
    if (!advanced) {
      actionC(r, p, "white-upper", { remote: true });
      r.ship.bonus++;
    } else
      actionC(r, p, station, { visual: station === "white-lower" ? 3 : 1 });
  } else if (name === "energy-technician") {
    if (!advanced) transferEnergy(r, p, false, "white-lower", true);
    else if (station.endsWith("upper"))
      for (const z of ["red", "white", "blue"])
        r.turnState.temporaryShields[z] += z === zone ? 2 : 1;
  } else if (name === "pulse-gunner") {
    if (advanced) {
      fire(
        r,
        p,
        false,
        station,
        station === "white-lower" && !damaged(station, "A"),
      );
      return;
    }
    if (station === "white-lower" || damaged(station, "A")) {
      fire(r, p);
      return;
    }
    const prepared = r.ship.preparedWeapons.includes(station);
    const energy = r.ship.zones[zone].reactor;
    const sameReactor = station === "white-upper";
    const eligible =
      !r.turnState.fired.includes(station) &&
      !r.turnState.fired.includes("white-lower") &&
      !damaged("white-lower", "A") &&
      r.ship.zones.white.reactor >= (sameReactor ? 2 : 1) &&
      (station.endsWith("lower") || energy > 0);
    if (eligible) {
      fire(r, p);
      fire(r, p, false, "white-lower");
    } else {
      if (prepared)
        r.ship.preparedWeapons = r.ship.preparedWeapons.filter(
          (s) => s !== station,
        );
      note(r, "ineffective", {
        crew: p.id,
        reason: "linked-weapons-unavailable",
      });
    }
  } else if (name === "medic") {
    if (advanced) {
      r.turnState.protectingMedics.push(p.id);
      r.ship.bonus--;
    } else
      r.turnState.stimulated.push(
        ...r.ship.crew
          .filter((c) => !c.space && c.station === station)
          .map((c) => c.id),
      );
  } else if (name === "teleporter") {
    if (advanced) {
      if (zone !== "white")
        p.station = `${zone === "red" ? "blue" : "red"}-${station.endsWith("upper") ? "lower" : "upper"}`;
    } else {
      const pair = r.teleportTokens[p.id] ?? [p.id, p.id],
        from = r.ship.crew[pair[0]],
        to = r.ship.crew[pair[1]];
      if (from && to && !from.space && !to.space) from.station = to.station;
    }
  } else if (name === "hypernavigator") {
    if (!advanced && station.endsWith("lower")) r.turnState.slow = 1;
    else if (advanced && station === "white-lower" && [10, 11].includes(r.turn))
      r.turnState.earlyJump = true;
  } else if (name === "special-ops") {
    if (!advanced) p.prepared = true;
    // Advanced is interpreted on the program entry: protection wraps both subactions.
  } else if (name === "squad-leader") {
    if (p.bots === null) return;
    const bot = r.ship.bots[p.bots];
    if (advanced) {
      if (bot.disabled || station === "blue-lower") return;
      api.heroicMovement(r, p, "red-upper");
      if (p.station === "red-upper" && !damaged(p.station, "C")) actionC(r, p);
    } else if (bot.disabled) bot.disabled = false;
    else {
      const z = r.ship.zones[zone],
        upper = station.endsWith("upper");
      const priority = upper
        ? [
            "upper-weapon",
            "lower-weapon",
            "lift",
            "shield",
            "reactor",
            "structure",
          ]
        : [
            "lower-weapon",
            "upper-weapon",
            "lift",
            "reactor",
            "shield",
            "structure",
          ];
      const tile = priority.find((t) => z.damage.includes(t));
      if (tile) {
        z.damage = z.damage.filter((t) => t !== tile);
        z.damageDeck = shuffle(
          [...z.damageDeck, tile],
          random(`${r.turn}/${p.id}/${r.log.length}/${z.damageDeck.join()}`),
        );
        if (tile === "structure") z.carriedStructure = false;
        note(r, "hull-repaired", { crew: p.id, zone, tile });
      }
    }
  } else if (name === "mechanic") {
    if (!advanced) {
      if (!damaged(station, "A") && !r.ship.preparedWeapons.includes(station))
        r.ship.preparedWeapons.push(station);
    } else {
      const t = r.threats.find(
        (t) =>
          t.position === "internal" &&
          t.status === "active" &&
          !t.phasedOut &&
          t.stations.includes(station) &&
          ["A", "B", "C"].includes(t.repair),
      );
      if (t) repair(r, p, t.repair, true);
    }
  } else throw Error(`Unsupported specialization: ${name}`);
}
