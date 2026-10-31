import { translate } from "./i18n.js";
const choose = (key, locale) => (key ? translate(locale, key) : undefined);
const zoneLabels = {
  red: "text.left",
  white: "text.center",
  blue: "text.right",
};
export function zoneLabel(zone, locale) {
  return choose(zoneLabels[zone], locale) ?? zone;
}
const specials = {
  rocketeer: [
    "text.launch_a_rocket_from_any_station_a_remote",
    "text.lower_right_launch_two_rockets_as_a_strength",
  ],
  "data-analyst": [
    "text.maintain_the_computer_remotely_and_gain_1_point",
    "text.visual_confirmation_counts_as_three_crew_members_elsewhere",
  ],
  "energy-technician": [
    "text.refuel_the_central_reactor_with_one_capsule_from",
    "text.upper_deck_temporary_shields_of_2_in_your",
  ],
  "pulse-gunner": [
    "text.fire_the_local_laser_and_pulse_cannon_if",
    "text.pulse_strength_2_in_normal_range_strength_1",
  ],
  medic: [
    "text.before_the_captain_enhance_the_first_a_b",
    "text.before_the_captain_nobody_with_you_can_be",
  ],
  teleporter: [
    "text.teleport_the_departure_token_crew_member_to_the",
    "text.from_a_side_zone_teleport_to_the_opposite",
  ],
  hypernavigator: [
    "text.lower_deck_all_threats_move_one_fewer_space",
    "text.lower_center_on_turn_10_or_11_finish",
  ],
  "special-ops": [
    "text.prepare_your_next_a_b_or_battlebot_action",
    "text.combine_with_another_card_protect_its_execution_from",
  ],
  "squad-leader": [
    "text.active_battlebots_repair_one_damage_in_your_zone",
    "text.with_active_battlebots_except_in_lower_right_reach",
  ],
  mechanic: [
    "text.prepare_the_local_weapon_1_strength_on_its",
    "text.repair_a_local_a_b_or_c_malfunction",
  ],
};
export function specialDescription(action, locale) {
  const [, name, tier] = action.split(":");
  return (
    choose(specials[name]?.[tier === "advanced" ? 1 : 0], locale) ?? action
  );
}
const traits = {
  stealth: "text.untargetable_until_x_weapons_ignore_it",
  cryo: "text.cryoshield_absorbs_the_first_volley_regardless_of_strength",
  pulseBreaksShield: "text.ignore_its_shields_when_pulse_targets_it_this",
  noRockets: "text.rockets_ignore_this_threat",
  rocketImmune: "text.rockets_can_target_it_but_deal_no_damage",
  noHeavy: "text.heavy_lasers_ignore_this_threat",
  rocketMagnet: "text.all_rockets_target_it_even_outside_range_1",
  behemoth: "text.lone_interceptor_target_strength_9_but_the_pilot",
  retaliates: "text.after_receiving_damage_attack_1_on_each_zone",
  deathSplash: "text.destroyed_deals_1_damage_to_every_other_external",
  returnsFire:
    "text.returns_fire_disables_attacking_battlebots_unless_their_attack",
  grows: "text.after_x_disables_attacking_battlebots_unless_their_attack",
  rocketHp: "text.hit_points_equal_the_rockets_remaining_when_it",
  deathKnockout: "text.final_repair_knocks_out_crew_in_lower_left",
  deathKnocksAttacker:
    "text.destroyed_knocks_out_its_attacker_and_disables_battlebots",
  removeTokenOnHit: "text.each_battlebot_attack_clears_a_station_clearing_the",
  slime: "text.entering_delays_the_next_action_original_2_hit",
  rocketDeflects: "text.a_rocket_sends_it_off_course_it_will",
  megashield: "text.each_turn_it_is_targeted_loses_1_shield",
};
Object.assign(traits, {
  phasing: "text.alternates_visible_phased_out_while_phased_out_cannot",
  polarized: "text.add_laser_strength_and_halve_it_rounding_up",
  spans: "text.lasers_in_all_three_zones_can_target_it",
  web: "text.stops_at_z_if_still_present_at_the",
  accelerates: "text.gains_1_speed_after_each_threat_actions_step",
  slowsWhenHit: "text.speed_2_this_turn_if_weapon_fire_deals",
  energyHeal: "text.energy_absorbed_by_ship_shields_during_its_attacks",
  finishEnergy: "text.the_final_repair_consumes_1_local_reactor_energy",
  parityStation: "text.starts_in_upper_left_on_an_odd_threat",
  shortCircuit: "text.blocks_pulse_every_central_heavy_laser_shot_triggers",
  poison: "text.from_appearance_ninja_poisons_movements_starting_or_ending",
  infection: "text.existing_infections_persist_until_z_even_after_its",
  swapDeckOnHit: "text.whenever_damaged_all_crew_aboard_change_decks",
  vortex: "text.at_z_a_surprise_common_internal_threat_resolves",
  teleportsOnHit: "text.after_taking_damage_teleports_to_upper_left",
  gremlin: "text.if_not_destroyed_before_the_jump_knocks_out",
  parasite: "text.attaches_to_the_first_crew_member_who_moves",
});
export function traitDescriptions(th, locale) {
  const result = Object.entries(traits)
    .filter(([key]) => th[key])
    .map(([, v]) => choose(v, locale));
  const t = (key, params) => translate(locale, key, params);
  if (th.maxTargetRange)
    result.push(
      t("text.targetable_only_at_range_or_less", {
        maxTargetRange: th.maxTargetRange,
      }),
    );
  if (th.damageCap)
    result.push(
      t("text.at_most_weapon_damage_per_turn", { damageCap: th.damageCap }),
    );
  if (th.asteroid)
    result.push(
      t("text.destroyed_attack_strength_per_x_y_already_crossed", {
        asteroid: th.asteroid,
      }),
    );
  if (th.simultaneousRepairs)
    result.push(
      t("text.requires_different_repairers_in_the_same_turn", {
        simultaneousRepairs: th.simultaneousRepairs,
      }),
    );
  if (th.multiRepairBonus)
    result.push(
      t("text.repair_if_all_its_stations_are_repaired_in", {
        multiRepairBonus: th.multiRepairBonus,
      }),
    );
  if (th.carrier)
    result.push(
      t("text.interceptors_in_its_range_or_closer_reduce_its", {
        carrier: th.carrier,
      }),
    );
  if (th.inaccessibility)
    result.push(
      t("text.absorbs_the_first_damage_each_turn", {
        inaccessibility: th.inaccessibility,
      }),
    );
  if (th.loneRepair)
    result.push(
      t("text.exactly_one_repairer_this_turn_repair", {
        loneRepair: th.loneRepair,
      }),
    );
  if (th.botsRepairBonus)
    result.push(
      t("text.with_active_battlebots_repair", {
        botsRepairBonus: th.botsRepairBonus,
      }),
    );
  return result;
}
const dictionary = {
  red: "text.left_109c98",
  white: "text.center_3e2797",
  blue: "text.right_835203",
  shield: "text.shield",
  reactor: "text.reactor",
  speed: "text.speed",
  fragments: "text.fragments",
  half: "text.half_the_damage_rounded_down",
  hp: "text.remaining_hit_points",
  "double-hp": "text.2_remaining_hit_points",
  "triple-hp": "text.3_remaining_hit_points",
  crew: "text.crew_present",
  all: "text.all_zones",
  other: "text.other_zones",
  lateral: "text.side_zones",
  occupied: "text.each_occupied_zone",
  stations: "text.each_occupied_station",
  station: "text.in_its_stations",
  zone: "text.in_its_zone",
  "active-bots": "text.leading_active_battlebots",
  "without-bots": "text.in_its_station_without_active_battlebots",
  "except-bridge": "text.outside_the_bridge",
  lift: "text.change_deck",
  double: "text.double_damage_after_shields",
  plasma: "text.plasma_knockout_if_no_damage_absorbed",
  "ignore-shield": "text.ignore_shields",
  revealed: "text.becomes_targetable",
  grown: "text.grows_returns_fire",
  "attack-aura": "text.1_attack_to_other_external_threats_until_destroyed",
  "shield-aura": "text.1_shield_to_all_external_threats_until_destroyed",
  "double-red": "text.double_damage_to_left_zone",
  "double-all": "text.double_damage_to_all_zones",
  "lethal-entry": "text.entering_a_contaminated_station_causes_knockout",
  "already-fired": "text.weapon_already_fired",
  "no-energy": "text.empty_reactor",
  "no-fuel": "text.no_fuel",
  "irreparable-system":
    "text.system_irreparable_or_remote_final_repair_prohibited",
  "rocket-unavailable":
    "text.no_rocket_available_or_already_launched_this_turn",
  "linked-weapons-unavailable": "text.both_linked_weapons_cannot_fire",
  "ultrafast-return": "text.ultrafast_return",
  "upper-weapon": "text.upper_weapon",
  "lower-weapon": "text.lower_weapon",
  structure: "text.structure",
};
Object.assign(dictionary, {
  inaccessibility: "text.inaccessibility",
  direct: "text.direct_damage",
  shielded: "text.shields_apply",
  "reactor+1": "text.reactor_energy_1",
  alone: "text.alone_in_their_station",
  group: "text.sharing_their_station_with_another_crew_member",
  "reverse-shields":
    "text.subsequent_attacks_drain_shields_and_add_that_energy",
  "ignore-shields": "text.subsequent_attacks_ignore_shields",
  "poison-entry": "text.poisons_crew_starting_or_ending_a_movement_in",
  "sealed-red": "text.doors_to_left_zone_sealed",
  "sealed-blue": "text.doors_to_right_zone_sealed",
  "sealed-door": "text.sealed_door",
  "cyber-gremlin": "text.cyber_gremlin_still_present_at_jump",
});
function word(x, locale) {
  return choose(dictionary[x], locale) ?? String(x ?? "");
}
export function stationLabel(x, locale) {
  if (x && typeof x === "object" && x.zone && x.deck) x = `${x.zone}-${x.deck}`;
  if (typeof x !== "string" || !/^(red|white|blue)-(upper|lower)$/.test(x))
    return "";
  const [z, d] = x.split("-");
  return `${zoneLabel(z, locale)} ${d === "upper" ? "↑" : "↓"}`;
}
export function effectDescription(e, locale) {
  const t = (key, params) => translate(locale, key, params),
    w = (x) => word(x, locale);
  let text;
  switch (e.type) {
    case "attack":
      text = `${t("text.attack")} ${w(e.amount)}${e.zones && e.zones !== "own" ? " · " + w(e.zones) : ""}${e.mode && e.mode !== "normal" ? " · " + w(e.mode) : ""}`;
      break;
    case "heal":
      text = `${t("text.heal")} ${w(e.amount)}`;
      break;
    case "change":
      text = `${w(e.stat)} ${e.amount >= 0 ? "+" : ""}${e.amount}`;
      break;
    case "set":
      text = `${w(e.stat)} = ${e.amount}`;
      break;
    case "flag":
      text = w(e.name);
      break;
    case "drain":
      text = `${t("text.drain")} ${e.amount ?? t("text.all_energy")} · ${w(e.system)}${e.zones ? " · " + w(e.zones) : ""}`;
      break;
    case "move":
      text = `${t("text.move")} ${w(e.direction)}`;
      break;
    case "drain-or-damage":
      text = t("text.drain_1_reactor_energy_or_deal_1_damage");
      break;
    case "knockout":
      text = `${t("text.knock_out_crew")} ${w(e.scope)}`;
      break;
    case "delay":
      text = `${t("text.delay_crew")} ${w(e.scope)}`;
      break;
    case "slime-spread":
      text = t("text.each_slime_spreads_one_station_toward_the_opposite");
      break;
    case "remove-rocket":
      text = t("text.destroy_one_stored_rocket");
      break;
    case "disable-stored-bots":
      text = t("text.disable_stored_battlebots_in_lower_left");
      break;
    case "fuel-lost":
      text = t("text.destroy_one_fuel_capsule");
      break;
    case "self-damage":
      text = t("text.take_damage", { amount: e.amount });
      break;
    case "seek":
      text = t("text.move_to_the_adjacent_station_with_most_crew");
      break;
    case "advance-others":
      if (e.position === "internal") {
        text = t(
          "text.advance_other_internal_threats_one_space_executing_crossed",
        );
        break;
      }
      text = t(
        "text.advance_other_external_threats_one_space_executing_crossed",
      );
      break;
    case "destroy-ship":
      text = t("text.destroy_the_ship");
      break;
    case "fill-shield":
      text = t("text.fill_its_shield_from_its_reactor");
      break;
    case "leak":
      text = t("text.empty_and_deal_that_much_damage", {
        value1: w(e.system),
        value2: e.zones ? " · " + w(e.zones) : "",
      });
      break;
    case "jump":
      text = t("text.jump_to_the_trajectory_at_the_same_distance", {
        value1:
          e.direction === "left"
            ? t("text.left_109c98")
            : t("text.right_835203"),
      });
      break;
    case "call":
      text = t("text.spawn_the_assigned_reinforcement", {
        value1:
          e.position === "internal" ? t("app.internal") : t("text.external"),
        value2:
          e.zone && e.zone !== "internal"
            ? " · " + (e.zone === "own" ? t("text.same_zone") : w(e.zone))
            : "",
      });
      if (e.undamagedSpeed)
        text += t("text.if_fewer_than_2_damage_reinforcement_speed_1");
      break;
    case "heal-others":
      text = t("text.heal_damage_from_all_threats", {
        amount: e.amount,
        value1:
          e.position === "internal"
            ? t("text.internal")
            : t("text.external_cf2f09"),
      });
      break;
    case "knockout-delay":
      text = t("text.knock_out_crew_leading_active_battlebots_delay_the");
      break;
    case "advance-zone":
      text = t("text.advance_zone_threats_by_executing_crossed_effects", {
        value1: w(e.zone),
        amount: e.amount,
      });
      break;
    case "opposite-damage":
      text = t("text.deal_damage_to_the_opposite_side_zone", {
        amount: e.amount,
      });
      break;
    case "short-circuit":
      text = t("text.consume_1_to_attack_each_zone_for_1", {
        value1:
          e.resource === "fuel"
            ? t("text.fuel_capsule")
            : t("text.central_reactor_energy"),
      });
      break;
    case "drill-move":
      text = t("text.move_one_station_toward_the_most_damaged_zone");
      break;
    case "shambler":
      text = t("text.crew_present_deal_2_zone_damage_otherwise_heal");
      break;
    case "blind":
      text = t(
        "text.obscure_targeting_visual_confirmation_or_interceptors_are_required",
        {
          value1:
            e.zone === "lateral"
              ? t("text.a_side_zone")
              : t("text.center_e08431"),
        },
      );
      break;
    case "mine":
      text = t("text.place_a_mine_in_its_station");
      break;
    case "detonate-mines":
      text = t("text.each_mine_deals_2_damage_to_its_zone");
      break;
    case "infect":
      text = t("text.infect_all_crew_in_its_station");
      break;
    case "infection-detonate":
      text = t("text.each_conscious_infected_crew_member_aboard_deals_2");
      break;
    case "poison-detonate":
      text = t("text.knock_out_poisoned_crew_if_ninja_is_still");
      break;
    case "repeat-action":
      text = t("text.repeat_this_turn_s_actions_next_turn_delaying");
      break;
    case "swap-zones":
      text = t("text.crew_in_side_zones_swap_left_right_without");
      break;
    case "vortex-draw":
      text = t("text.reveal_the_surprise_threat_resolve_its_appearance_x");
      break;
    case "absorb-reactor":
      text = t("text.empty_the_local_reactor_and_gain_that_much");
      break;
    case "sabotage":
      text = t("text.sabotage_a_b_and_c_in_its_station");
      break;
    case "parasite-drain":
      text = t("text.drain_1_energy_from_the_host_station_s");
      break;
    case "parasite-knockout":
      text = t("text.knock_out_other_crew_sharing_the_host_s");
      break;
    case "parasite-attack":
      text = t("text.5_direct_damage_to_the_host_s_zone");
      break;
    default:
      text = e.type;
  }
  if (e.phasedAmount !== undefined)
    text += t("text.phased_out", { phasedAmount: e.phasedAmount });
  if (e.phasedDirection)
    text += t("text.phased_out_ba3fa3", { value1: w(e.phasedDirection) });
  if (e.onlyPhasedIn) text += t("text.only_when_visible");
  if (e.ifCrew) text += t("text.if_crew_is_present");
  if (e.ifDamaged) text += t("text.if_damaged");
  if (e.ifUndamaged) text += t("text.if_undamaged");
  if (e.belowDamage !== undefined)
    text += t("text.if_fewer_than_damage", { belowDamage: e.belowDamage });
  if (e.unlessFlag) text += t("text.unless_off_course");
  return text;
}
export function eventDescription(e, locale, threats) {
  const t = (key, params) => translate(locale, key, params),
    w = (x) => word(x, locale);
  const prefix =
    e.crew !== undefined ? `${t("app.crew_49685c")} ${e.crew + 1} · ` : "";
  const found = threats.find((t) => t.instance === e.threat);
  const threat = found?.card?.name ?? found?.name ?? e.threat;
  const messages = {
    "threat-called": t("text.reinforcement_called"),
    "threat-jump": t("text.change_trajectory", { value1: w(e.zone) }),
    "parasite-attached": t("text.parasite_attached"),
    "threat-appears": t("text.threat_appears"),
    "threat-destroyed": t("text.threat_destroyed"),
    "threat-survived": t("text.threat_survived"),
    "threat-action": t("text.action", { mark: e.mark }),
    "threat-hit": t("text.damage_after_shields", {
      damage: e.damage,
      shield: e.shield,
    }),
    "cryoshield-broken": t("text.cryoshield_broken"),
    move: t("text.", {
      value1: stationLabel(e.from, locale),
      value2: stationLabel(e.to, locale),
    }),
    teleport: t("text.teleport", { value1: stationLabel(e.to, locale) }),
    fire: t("text.fire_strength_range", {
      value1: stationLabel(e.station, locale),
      strength: e.strength,
      range: e.range,
    }),
    energy: t("text.transfer_energy", {
      amount: e.amount,
      value1: stationLabel(e.station, locale),
      value2: w(e.system),
    }),
    computer: t("text.computer_maintained_phase", { phase: e.phase }),
    "computer-missed": t("text.computer_missed_phase", { phase: e.phase }),
    "rocket-launched": t("text.rocket_s_launched", { count: e.count }),
    "launch-interceptors": t("text.interceptor_launch"),
    "bots-activated": t("text.battlebots_activated"),
    "bots-reactivated": t("text.battlebots_reactivated"),
    "battlebots-hit": t("text.battlebot_attack_damage", {
      value1: e.amount ?? 1,
    }),
    repair: t("text.repair_damage", { amount: e.amount }),
    "repair-attempt": t("text.simultaneous_repair_attempted"),
    "hull-repaired": t("text.repair", { value1: w(e.tile), value2: w(e.zone) }),
    delay: t("text.program_delayed_from_t", {
      from: e.from,
      value1: e.dropped ? t("text.final_action_lost") : "",
    }),
    "knocked-out": t("text.knocked_out", { value1: w(e.reason) }),
    ineffective: t("text.no_effect", { value1: w(e.reason) }),
    "ship-damage": t("text.damage", { value1: w(e.zone), value2: w(e.tile) }),
    "ship-destroyed": t("text.ship_destroyed"),
    attack: t("text.attack_absorbed_remaining", {
      value1: w(e.zone),
      absorbed: e.absorbed,
      damage: e.damage,
    }),
    specialization: specialDescription(`special:${e.name}:${e.tier}`, locale),
  };
  return (
    prefix +
    (messages[e.type] ?? e.type) +
    (threat !== undefined ? " · " + threat : "")
  );
}
