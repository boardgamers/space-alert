import { equipmentPicture, pictogram } from "./icons.js";

export function illustration(name) {
  return (
    equipmentPicture(name) ??
    `<span class="equipment-symbol">${pictogram(name)}</span>`
  );
}

export function threatIllustration(threat) {
  if (threat.position === "internal")
    return illustration(threat.repair === "bots" ? "battlebots" : "computer");
  // Canonical catalogue names do not change with the viewer's language.
  const family =
    [
      [/asteroid|meteoroid|planetoid/i, "asteroid"],
      [/swarm/i, "swarm"],
      [/satellite|saucer/i, "satellite"],
      [/capsule/i, "capsule"],
      [/amoeba|jellyfish|octopus|crab|spider|snake|dragon/i, "organism"],
      [/cloud|maelstrom|pulse ball|phasing pulser/i, "energy-cloud"],
      [
        /destroyer|frigate|man-of-war|tanker|carrier|juggernaut|behemoth|overlord/i,
        "cruiser",
      ],
    ].find(([pattern]) => pattern.test(threat.name))?.[1] ?? "fighter";
  return illustration(family);
}
