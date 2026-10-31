import { illustration, threatIllustration } from "./art.js";
import { pictogram, shipLocator, equipmentPicture } from "./icons.js";

export function createTacticalView({
  t,
  esc,
  symbol,
  zoneName,
  playerColor = () => "",
}) {
  const actionName = (key) =>
    ({
      A: t("app.weapons"),
      B: t("app.energy"),
      C: t("app.systems"),
    })[key];
  const actionWords = (text) => text.replace(/\b[ABC]\b/g, actionName);
  const meter = (value, capacity) =>
    `<span class="charge-pips" aria-hidden="true">${Array.from({ length: capacity }, (_, i) => `<i class="${i < value ? "filled" : ""}"></i>`).join("")}</span>`;

  function stationControls({
    station,
    zone,
    deck,
    ship,
    power,
    capacity,
    system,
    cIcon,
    c,
    canPlan,
  }) {
    const s = ship.zones[zone];
    const pulse = station === "white-lower";
    const light = deck === "lower" && !pulse;
    const energyName = system === "shield" ? t("app.shield") : t("app.reactor");
    const charge =
      system === "shield"
        ? t("tactical.charge_the_shield")
        : t("tactical.refill_the_reactor");
    const centralRefuel = station === "white-lower";
    const sourceValue = centralRefuel
      ? ship.fuel
      : system === "shield"
        ? s.reactor
        : ship.zones.white.reactor;
    const sourceName = centralRefuel
      ? t("app.fuel")
      : `${t("app.reactor")} ${zoneName(system === "shield" ? zone : "white")}`;
    const sourceIcon = centralRefuel ? "fuel" : "reactor";
    const weapon = pulse
      ? t("tactical.pulse_cannon")
      : light
        ? t("tactical.light_laser")
        : t("tactical.heavy_laser");
    const weaponArt = pulse ? "pulse" : light ? "light-laser" : "laser";
    const fireText = light
      ? t("tactical.the_light_laser_has_its_own_battery_it")
      : t("tactical.firing_uses_1_energy_from_this_zone_s");
    const chargeText = centralRefuel
      ? t("tactical.one_fuel_capsule_fills_the_central_reactor_to")
      : system === "shield"
        ? t("tactical.b_transfers_energy_from_this_zone_s_reactor")
        : t("tactical.b_transfers_energy_from_the_central_reactor_into");
    const cText = {
      "white-upper": t("tactical.perform_c_here_on_turns_1_2_4"),
      "blue-upper": t("tactical.c_takes_this_room_s_battlebots_or_reactivates"),
      "red-lower": t("tactical.c_takes_this_room_s_battlebots_or_reactivates"),
      "red-upper": t("tactical.with_active_battlebots_c_launches_you_in_an"),
      "white-lower": t(
        "tactical.c_performs_visual_confirmation_which_can_earn_points",
      ),
      "blue-lower": t("tactical.c_launches_a_rocket_it_attacks_on_the"),
    }[station];
    const flow = `<div class="energy-flow"><span>${illustration(sourceIcon)}<b>${sourceValue}</b><small>${esc(sourceName)}</small></span>${pictogram("right")}<span>${illustration(system)}<b>${s[system]}/${capacity}</b><small>${esc(energyName)}</small></span></div>`;
    const details = (key, art, text, extra = "") =>
      `<template>${key === "B" ? "" : `<div class="system-detail-art">${illustration(art)}</div>`}<p class="room-location">${esc(zoneName(zone))} · ${deck === "upper" ? t("tactical.upper_deck") : t("tactical.lower_deck")}</p>${extra}<p>${esc(actionWords(text))}</p><p class="planning-note">${t("tactical.program_on_a_turn_when_your_crew_member", { value1: actionName(key) })}</p>${canPlan ? `<button class="primary icon-label" data-pick-action="${key}"><span class="action-key">${pictogram(key)}</span>${t("tactical.show_my_cards", { value1: actionName(key) })}</button>` : ""}</template>`;
    return `<div class="systems illustrated-systems">
      <div class="system-card weapon-system"><button title="${esc(weapon)}" data-inspect="system-${station}-A" data-inspect-title="${esc(weapon)}" aria-haspopup="dialog" aria-label="${esc(`${weapon} · ${t("tactical.power")} ${power}`)}"><span class="action-key">${pictogram("A")}</span>${illustration(weaponArt)}<span class="system-caption"><strong>${t("tactical.fire")}</strong><span class="power-value">${symbol("laser", t("tactical.firepower"), power)}</span></span></button>${details("A", weaponArt, fireText, `<div class="weapon-facts">${symbol("laser", `${t("tactical.firepower")} ${power}`, power)}${symbol(light ? "check" : "reactor", light ? t("tactical.own_battery") : t("tactical.cost_1_energy"), light ? t("tactical.own_battery_defc21") : "−1")}</div>`)}</div>
      <div class="system-card energy-system ${s[system] === 0 ? "depleted" : ""}"><button data-inspect="system-${station}-B" data-inspect-title="${esc(charge)}" aria-haspopup="dialog" aria-label="${esc(`${charge} · ${s[system]}/${capacity}`)}"><span class="action-key">${pictogram("B")}</span>${illustration(system)}<span class="system-caption"><strong>${t("tactical.charge")}</strong><b class="energy-value">${s[system]}/${capacity}</b>${meter(s[system], capacity)}</span></button>${details("B", system, chargeText, flow)}</div>
      <div class="system-card special-system"><button title="${esc(c)}" data-inspect="system-${station}-C" data-inspect-title="${esc(c)}" aria-haspopup="dialog" aria-label="${esc(c)}"><span class="action-key">${pictogram("C")}</span>${illustration(cIcon)}<span class="system-caption"><strong>${esc(c)}</strong></span></button>${details("C", cIcon, cText)}</div>
    </div>`;
  }

  function shipCutaway({
    ship,
    selectedCrew,
    canPlan,
    crewLabel,
    isAndroid = () => false,
  }) {
    const zones = ["red", "white", "blue"];
    const movementHelp = (lift) =>
      `<template><div class="passage-explanation">${pictogram(lift ? "lift" : "move")}</div><p>${lift ? t("tactical.program_an_card_to_change_deck_in_this") : t("tactical.program_a_left_or_right_arrow_to_enter")}</p>${canPlan ? `<button class="primary icon-label" data-pick-action="move">${pictogram("move")}${t("tactical.show_my_movement_cards")}</button>` : ""}</template>`;
    const deck = (level) =>
      `<div class="ship-deck deck-${level}">${zones
        .map((zone) => {
          const station = `${zone}-${level}`,
            s = ship.zones[zone];
          const system = level === "upper" ? "shield" : "reactor";
          const capacity =
            (system === "shield"
              ? zone === "white"
                ? 3
                : 2
              : zone === "white"
                ? 5
                : 3) - Number(s.damage.includes(system));
          const [cIcon, c] = {
            "red-upper": ["interceptor", t("app.interceptors")],
            "white-upper": ["computer", t("app.computer")],
            "blue-upper": ["bots", t("app.battlebots")],
            "red-lower": ["bots", t("app.battlebots")],
            "white-lower": ["observation", t("app.visual_confirmation")],
            "blue-lower": ["rocket", t("app.rocket")],
          }[station];
          const pulse = station === "white-lower";
          const power =
            (level === "upper" ? (zone === "white" ? 5 : 4) : pulse ? 1 : 2) -
            Number(s.damage.includes(`${level}-weapon`) && !pulse);
          const occupants = ship.crew.filter(
            (p) => p.station === station && !p.space,
          );
          const deckName =
            level === "upper"
              ? t("tactical.upper_deck")
              : t("tactical.lower_deck");
          return `<section class="station ${occupants.some((p) => p.id === selectedCrew) ? "selected-station" : ""}" data-station="${station}" style="--zone:var(--${zone})" aria-label="${esc(zoneName(zone))} · ${deckName}"><div class="station-title">${level === "upper" && s.damage.length ? `<span class="damage">${symbol("warning", `${t("tactical.zone_damage")} : ${s.damage.length}/6`, `${s.damage.length}/6`)}</span>` : ""}</div>${stationControls({ station, zone, deck: level, ship, power, capacity, system, cIcon, c, canPlan })}<div class="occupants">${occupants.map((p) => `<span style="${playerColor(p.id) ? `--player-color:${playerColor(p.id)};--player-stroke:#c4d4e0` : ""}" data-crew="${p.id}" class="crew-pawn ${p.id === selectedCrew ? "selected" : ""} ${p.knockedOut ? "out" : ""}" role="img" title="${esc(crewLabel(p.id))}${p.knockedOut ? " · " + t("tactical.knocked_out") : ""}${p.bots !== null ? " · " + t("app.battlebots") : ""}" aria-label="${esc(crewLabel(p.id))}${p.knockedOut ? " · " + t("tactical.knocked_out") : ""}${p.bots !== null ? " · " + t("app.battlebots") : ""}">${isAndroid(p.id) ? equipmentPicture("android") : pictogram("crew")}<b>${p.id + 1}</b>${p.bots !== null ? `<i>${pictogram("bots")}</i>` : ""}</span>`).join("")}</div></section>`;
        })
        .join(
          "",
        )}${[1, 2].map((i) => `<div class="ship-passage passage-${i}"><button data-inspect="door-${level}-${i}" data-inspect-title="${t("tactical.doors_same_deck")}" aria-label="${t("tactical.passage")} ${esc(zoneName(zones[i - 1]))} ↔ ${esc(zoneName(zones[i]))} · ${level === "upper" ? t("tactical.upper_deck") : t("tactical.lower_deck")}" aria-haspopup="dialog">${pictogram("move")}</button>${movementHelp(false)}</div>`).join("")}</div>`;
    return `<div class="ship-hull"><div class="ship-bow" aria-hidden="true"><svg viewBox="0 0 600 46" preserveAspectRatio="none"><path class="hull-shell" d="M2 46V32L40 20 200 10 240 3h120l40 7 160 10 38 12v14"/><path class="bridge-window" d="m237 16 11-6h104l11 6-13 12H250Z"/><path d="M275 11v16m50-16v16M32 39h135m266 0h135"/></svg></div>${deck("upper")}<div class="between-decks"><svg class="energy-conduits" viewBox="0 0 600 44" preserveAspectRatio="none" aria-hidden="true"><path class="conduit-back" d="M300 44V28H120V44m180-16h180v16M100 44V0M300 28V0M500 44V0"/><path d="M300 44V28H120V44m180-16h180v16M100 44V0M300 28V0M500 44V0"/><path d="m96 6 4-4 4 4m192 0 4-4 4 4m192 0 4-4 4 4M116 38l4 4 4-4m352 0 4 4 4-4M193 24l-5 4 5 4m214-8 5 4-5 4"/></svg>${zones.map((z) => `<div class="lift-bay"><button class="lift-control ${ship.zones[z].damage.includes("lift") ? "damaged-lift" : ""}" data-inspect="lift-${z}" data-inspect-title="${t("tactical.gravolift")} · ${esc(zoneName(z))}" aria-label="${t("tactical.gravolift")} · ${esc(zoneName(z))}${ship.zones[z].damage.includes("lift") ? " · " + t("tactical.damaged") : ""}" aria-haspopup="dialog">${pictogram("lift")}</button>${movementHelp(true)}</div>`).join("")}</div>${deck("lower")}</div><div class="ship-stern" aria-hidden="true">${zones.map(() => `<span><i></i><i></i><i></i></span>`).join("")}</div><div class="ship-key"><span>${pictogram("A")}${t("tactical.fire")}</span><span>${pictogram("B")}${t("app.energy")}</span><span>${pictogram("C")}${t("app.systems")}</span></div>`;
  }

  function threatPortrait(th) {
    const hp = Math.max(0, th.hp - (th.damage ?? 0));
    const pending = ["pending", "announced", "waiting"].includes(th.status);
    const gone = ["destroyed", "survived", "discarded"].includes(th.status);
    const impacted = th.positionOnTrack === 1 && th.effects?.Z?.some(
      (effect) => effect.type === "attack" &&
        ["hp", "double-hp", "triple-hp"].includes(effect.amount),
    );
    const status =
      th.status === "destroyed"
        ? t("tactical.destroyed")
        : th.status === "survived"
          ? t(impacted ? "tactical.impact" : "tactical.escaped")
          : th.status === "discarded"
            ? t("tactical.discarded")
            : null;
    const visual = threatIllustration(th);
    const internal = th.position === "internal";
    const stations = internal
      ? (th.stations ?? [])
      : [`${th.zone}-upper`, `${th.zone}-lower`];
    const targetName = internal
      ? `${t("tactical.affected_rooms")} : ${stations
          .map((s) => {
            const [z, d] = s.split("-");
            return `${zoneName(z)} ${d === "upper" ? "↑" : "↓"}`;
          })
          .join(", ")}`
      : `${t("tactical.trajectory")} : ${zoneName(th.zone)}`;
    const target = `<span class="threat-target" style="--zone:var(--${["red", "white", "blue"].includes(th.zone) ? th.zone : "cyan"})" role="img" aria-label="${esc(targetName)}" title="${esc(targetName)}">${shipLocator(stations, internal ? null : th.zone)}</span>`;
    return `<span class="threat-portrait ${pending ? "pending-threat" : ""} ${gone ? "resolved-threat" : ""}">${target}${visual}<span class="threat-hud"><span class="hull-gauge"><span>${symbol("hull", `${t("app.hit_points")} : ${hp}/${th.hp}`, `<b>${hp}<small>/${th.hp}</small></b>`)}</span><span class="hull-bar"><i style="width:${Math.max(0, Math.min(100, (hp / Math.max(1, th.hp)) * 100))}%"></i></span></span><span class="shield-badge">${symbol("shield", `${t("app.shield")} : ${th.shield}`, `<b>${th.shield}</b>`)}</span></span>${status ? `<span class="threat-outcome">${esc(status)}</span>` : ""}</span>`;
  }
  return { shipCutaway, threatPortrait };
}
