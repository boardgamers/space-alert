// Display-only forecast from public threat state. No planned crew actions are read.
// Preserve the real distance spaces: each group is one upcoming movement step.
export function forecastMovement(threat, track, context = {}) {
  if (context.outcome) return [];
  const pending = !threat.status || ["pending", "announced", "waiting"].includes(threat.status);
  if (!pending && threat.status !== "active") return [];
  if (!Number.isFinite(threat.speed) || threat.speed <= 0) return [];
  // Another threat can move this token outside its own movement step.
  if (context.threats?.some(other => other.instance !== threat.instance &&
    !["destroyed", "survived", "discarded"].includes(other.status) &&
    Object.values(other.effects ?? {}).flat().some(effect =>
      (effect.type === "advance-others" && (effect.position ?? "external") === threat.position) ||
      (effect.type === "advance-zone" && effect.zone === threat.zone)))) return [];

  const nextTurn = (context.turn ?? 0) + (['crew', 'damage', 'threats'].includes(context.step) ? 0 : 1);
  let turn = Math.max(threat.turn ?? 1, nextTurn);
  const t = structuredClone(threat);
  t.flags ??= [];
  t.damage ??= 0;
  let position = pending ? track.length : t.positionOnTrack;
  const groups = [];
  for (; position > 1 && groups.length < 24 && turn <= (context.finalTurn ?? Infinity); turn++) {
    // Changes crossed this turn affect the NEXT movement, just as in the resolver.
    const speed = Math.max(0, t.speed);
    if (!speed) break;
    const end = Math.max(1, position - speed);
    const group = { turn, speed, positions: [] };
    let stop = false;
    for (let at = position - 1; at >= end; at--) {
      group.positions.push(at);
      const mark = track.marks.find(([n]) => n === at)?.[1];
      for (const effect of t.effects?.[mark] ?? []) {
        if ((effect.onlyPhasedIn && t.phasedOut) ||
          (effect.ifDamaged && !t.damage) || (effect.ifUndamaged && t.damage) ||
          (effect.belowDamage !== undefined && t.damage >= effect.belowDamage) ||
          (effect.unlessFlag && t.flags.includes(effect.unlessFlag))) continue;
        if (effect.ifCrew || ["jump", "absorb-reactor"].includes(effect.type)) stop = true;
        else if (effect.type === "change") t[effect.stat] = (t[effect.stat] ?? 0) + effect.amount;
        else if (effect.type === "set") t[effect.stat] = effect.amount;
        else if (effect.type === "flag") t.flags.push(effect.name);
        else if (effect.type === "heal") t.damage = Math.max(0, t.damage - (effect.amount === "half" ? Math.floor(t.damage / 2) : effect.amount));
        else if (effect.type === "self-damage") {
          t.damage += effect.amount;
          if (t.damage >= t.hp) stop = true;
        } else if (effect.type === "destroy-ship") stop = true;
      }
      if (mark === "Z") stop = true;
      // A jump or conditional effect makes the remainder uncertain. Do not
      // label spaces beyond that checkpoint with a promised arrival turn.
      if (stop) break;
    }
    groups.push(group);
    if (stop) break;
    position = end;
    if (t.phasing) t.phasedOut = !t.phasedOut;
    t.speed += t.accelerates ?? 0;
  }
  return groups;
}

export function checkpointAppearance(threat, effects) {
  if (!effects.length) return null;
  if (effects.length > 1) return { icon: "systems", value: "+" };
  const effect = effects[0];
  if (effect.type === "attack") {
    const hpMultiplier = { hp: 1, "double-hp": 2, "triple-hp": 3 }[effect.amount];
    if (hpMultiplier) return { icon: "impact", value: hpMultiplier * Math.max(0, threat.hp - (threat.damage ?? 0)) };
    return { icon: "laser", value: typeof effect.amount === "number" ? effect.amount : "?" };
  }
  if (effect.type === "heal") return { icon: "medic", value: typeof effect.amount === "number" ? effect.amount : "½" };
  if (["change", "set"].includes(effect.type) && ["speed", "shield"].includes(effect.stat))
    return { icon: effect.stat, value: `${effect.type === "change" && effect.amount > 0 ? "+" : ""}${effect.amount}` };
  return { icon: "systems", value: "" };
}
