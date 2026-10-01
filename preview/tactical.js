import { illustration, threatIllustration } from "./art.js";
import { pictogram, shipLocator } from "./icons.js";

export function createTacticalView({ t, esc, symbol, zoneName }) {
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
    const energyName =
      system === "shield" ? t("Bouclier", "Shield") : t("Réacteur", "Reactor");
    const charge =
      system === "shield"
        ? t("Charger le bouclier", "Charge the shield")
        : t("Recharger le réacteur", "Refill the reactor");
    const centralRefuel = station === "white-lower";
    const sourceValue = centralRefuel
      ? ship.fuel
      : system === "shield"
        ? s.reactor
        : ship.zones.white.reactor;
    const sourceName = centralRefuel
      ? t("Combustible", "Fuel")
      : `${t("Réacteur", "Reactor")} ${zoneName(system === "shield" ? zone : "white")}`;
    const sourceIcon = centralRefuel ? "fuel" : "reactor";
    const weapon = pulse
      ? t("Canon à impulsion", "Pulse cannon")
      : light
        ? t("Laser léger", "Light laser")
        : t("Laser lourd", "Heavy laser");
    const weaponArt = pulse ? "pulse" : light ? "light-laser" : "laser";
    const fireText = light
      ? t(
          "Le laser léger utilise sa propre batterie : aucune énergie du réacteur n’est dépensée.",
          "The light laser has its own battery: it spends no reactor energy.",
        )
      : t(
          "Un tir consomme 1 énergie du réacteur de cette zone. Sans énergie au moment du tir, l’arme ne tire pas.",
          "Firing uses 1 energy from this zone’s reactor. With no energy when the shot resolves, the weapon does not fire.",
        );
    const chargeText = centralRefuel
      ? t(
          "Une capsule de combustible remplit le réacteur central jusqu’à sa capacité.",
          "One fuel capsule fills the central reactor to capacity.",
        )
      : system === "shield"
        ? t(
            "B transfère l’énergie du réacteur de cette zone vers son bouclier, jusqu’à sa capacité. Cette énergie absorbera les prochaines attaques.",
            "B transfers energy from this zone’s reactor into its shield, up to capacity. That energy absorbs incoming attacks.",
          )
        : t(
            "B transfère l’énergie du réacteur central vers ce réacteur, jusqu’à sa capacité.",
            "B transfers energy from the central reactor into this reactor, up to capacity.",
          );
    const cText = {
      "white-upper": t(
        "Faites C ici aux tours 1–2, 4–5 et 8–9 pour entretenir l’ordinateur à chaque phase et éviter de retarder les programmes.",
        "Perform C here on turns 1–2, 4–5 and 8–9 to maintain the computer each phase and avoid delaying programs.",
      ),
      "blue-upper": t(
        "C prend les robots de cette salle, ou réactive ceux que vous portez déjà.",
        "C takes this room’s battlebots, or reactivates the team you already carry.",
      ),
      "red-lower": t(
        "C prend les robots de cette salle, ou réactive ceux que vous portez déjà.",
        "C takes this room’s battlebots, or reactivates the team you already carry.",
      ),
      "red-upper": t(
        "Avec des robots actifs, C vous fait décoller en intercepteur. Un seul équipier peut être dans l’espace à la fois.",
        "With active battlebots, C launches you in an interceptor. Only one crew member can be in space at a time.",
      ),
      "white-lower": t(
        "C effectue une observation visuelle, qui peut rapporter des points à la fin de la mission.",
        "C performs visual confirmation, which can earn points at the end of the mission.",
      ),
      "blue-lower": t(
        "C lance une roquette : elle attaque au tour suivant. Une seule roquette peut être lancée par tour.",
        "C launches a rocket: it attacks on the following turn. Only one rocket can launch each turn.",
      ),
    }[station];
    const flow = `<div class="energy-flow"><span>${illustration(sourceIcon)}<b>${sourceValue}</b><small>${esc(sourceName)}</small></span>${pictogram("right")}<span>${illustration(system)}<b>${s[system]}/${capacity}</b><small>${esc(energyName)}</small></span></div>`;
    const details = (key, art, text, extra = "") =>
      `<template>${key === "B" ? "" : `<div class="system-detail-art">${illustration(art)}</div>`}<p class="room-location">${esc(zoneName(zone))} · ${deck === "upper" ? t("Pont supérieur", "Upper deck") : t("Pont inférieur", "Lower deck")}</p>${extra}<p>${esc(text)}</p><p class="planning-note">${t(`Programmez ${key} à un tour où votre équipier sera dans cette salle. Une panne de ce système fait utiliser l’action pour la réparer.`, `Program ${key} on a turn when your crew member will be in this room. A malfunction of this system makes the action repair it instead.`)}</p>${canPlan ? `<button class="primary icon-label" data-pick-action="${key}"><span class="action-key">${key}</span>${t(`Voir mes cartes ${key}`, `Show my ${key} cards`)}</button>` : ""}</template>`;
    return `<div class="systems illustrated-systems">
      <div class="system-card weapon-system"><button title="${esc(weapon)}" data-inspect="system-${station}-A" data-inspect-title="${esc(weapon)}" aria-haspopup="dialog" aria-label="${esc(`${weapon} · A · ${t("Puissance", "Power")} ${power}`)}"><span class="action-key">A</span>${illustration(weaponArt)}<span class="system-caption"><strong>${t("Tirer", "Fire")}</strong><span class="power-value">${symbol("hull", t("Puissance de tir", "Firepower"), power)}</span></span></button>${details("A", weaponArt, fireText, `<div class="weapon-facts">${symbol("hull", `${t("Puissance", "Power")} ${power}`, power)}${symbol(light ? "check" : "reactor", light ? t("Batterie autonome", "Own battery") : t("Coût : 1 énergie", "Cost: 1 energy"), light ? t("Autonome", "Own battery") : "−1")}</div>`)}</div>
      <div class="system-card energy-system ${s[system] === 0 ? "depleted" : ""}"><button data-inspect="system-${station}-B" data-inspect-title="${esc(charge)}" aria-haspopup="dialog" aria-label="${esc(`${charge} · B · ${s[system]}/${capacity}`)}"><span class="action-key">B</span>${illustration(system)}<span class="system-caption"><strong>${t("Charger", "Charge")}</strong><b class="energy-value">${s[system]}/${capacity}</b>${meter(s[system], capacity)}</span></button>${details("B", system, chargeText, flow)}</div>
      <div class="system-card special-system"><button title="${esc(c)}" data-inspect="system-${station}-C" data-inspect-title="${esc(c)}" aria-haspopup="dialog" aria-label="C · ${esc(c)}"><span class="action-key">C</span>${illustration(cIcon)}<span class="system-caption"><strong>${esc(c)}</strong></span></button>${details("C", cIcon, cText)}</div>
    </div>`;
  }

  function shipCutaway({ ship, selectedCrew, canPlan, crewLabel }) {
    const zones = ["red", "white", "blue"];
    const movementHelp = (lift) =>
      `<template><div class="passage-explanation">${pictogram(lift ? "lift" : "move")}</div><p>${lift ? t("Programmez une carte ↑↓ pour changer de pont dans cette zone.", "Program an ↑↓ card to change deck in this zone.") : t("Programmez une flèche gauche ou droite pour passer dans la salle voisine du même pont.", "Program a left or right arrow to enter the next room on the same deck.")}</p>${canPlan ? `<button class="primary icon-label" data-pick-action="move">${pictogram("move")}${t("Voir mes déplacements", "Show my movement cards")}</button>` : ""}</template>`;
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
            "red-upper": ["interceptor", t("Intercepteurs", "Interceptors")],
            "white-upper": ["computer", t("Ordinateur", "Computer")],
            "blue-upper": ["bots", t("Robots", "Battlebots")],
            "red-lower": ["bots", t("Robots", "Battlebots")],
            "white-lower": [
              "observation",
              t("Observation", "Visual confirmation"),
            ],
            "blue-lower": ["rocket", t("Roquette", "Rocket")],
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
              ? t("Pont supérieur", "Upper deck")
              : t("Pont inférieur", "Lower deck");
          return `<section class="station ${occupants.some((p) => p.id === selectedCrew) ? "selected-station" : ""}" data-station="${station}" style="--zone:var(--${zone})" aria-label="${esc(zoneName(zone))} · ${deckName}"><div class="station-title">${esc(zoneName(zone))}${symbol(level === "upper" ? "up" : "down", deckName)}${level === "upper" && s.damage.length ? `<span class="damage">${symbol("warning", `${t("Dégâts de la zone", "Zone damage")} : ${s.damage.length}/6`, `${s.damage.length}/6`)}</span>` : ""}</div>${stationControls({ station, zone, deck: level, ship, power, capacity, system, cIcon, c, canPlan })}<div class="occupants">${occupants.map((p) => `<span class="crew-pawn ${p.id === selectedCrew ? "selected" : ""} ${p.knockedOut ? "out" : ""}" role="img" title="${esc(crewLabel(p.id))}${p.knockedOut ? " · " + t("Hors combat", "Knocked out") : ""}${p.bots !== null ? " · " + t("Robots", "Battlebots") : ""}" aria-label="${esc(crewLabel(p.id))}${p.knockedOut ? " · " + t("Hors combat", "Knocked out") : ""}${p.bots !== null ? " · " + t("Robots", "Battlebots") : ""}"><svg viewBox="0 0 24 30" aria-hidden="true"><path d="M4 28v-9a8 8 0 0 1 16 0v9Z"/><circle cx="12" cy="8" r="7"/><path class="visor" d="M7 6h10v5H7z"/></svg><b>${p.id + 1}</b>${p.bots !== null ? `<i>${pictogram("bots")}</i>` : ""}</span>`).join("")}</div></section>`;
        })
        .join(
          "",
        )}${[1, 2].map((i) => `<div class="ship-passage passage-${i}"><button data-inspect="door-${level}-${i}" data-inspect-title="${t("Portes · Même pont", "Doors · Same deck")}" aria-label="${t("Passage", "Passage")} ${esc(zoneName(zones[i - 1]))} ↔ ${esc(zoneName(zones[i]))} · ${level === "upper" ? t("Pont supérieur", "Upper deck") : t("Pont inférieur", "Lower deck")}" aria-haspopup="dialog">${pictogram("move")}</button>${movementHelp(false)}</div>`).join("")}</div>`;
    return `<div class="ship-bow" aria-hidden="true"><svg viewBox="0 0 600 46" preserveAspectRatio="none"><path class="hull-shell" d="M8 45 40 24 200 12 240 3h120l40 9 160 12 32 21Z"/><path class="bridge-window" d="m237 16 11-6h104l11 6-13 12H250Z"/><path d="M275 11v16m50-16v16M32 39h135m266 0h135"/></svg></div>${deck("upper")}<div class="between-decks"><svg class="energy-conduits" viewBox="0 0 600 44" preserveAspectRatio="none" aria-hidden="true"><path class="conduit-back" d="M300 44V28H120V44m180-16h180v16M100 44V0M300 28V0M500 44V0"/><path d="M300 44V28H120V44m180-16h180v16M100 44V0M300 28V0M500 44V0"/><path d="m96 6 4-4 4 4m192 0 4-4 4 4m192 0 4-4 4 4M116 38l4 4 4-4m352 0 4 4 4-4M193 24l-5 4 5 4m214-8 5 4-5 4"/></svg>${zones.map((z) => `<div class="lift-bay"><button class="lift-control ${ship.zones[z].damage.includes("lift") ? "damaged-lift" : ""}" data-inspect="lift-${z}" data-inspect-title="${t("Ascenseur", "Gravolift")} · ${esc(zoneName(z))}" aria-label="${t("Ascenseur", "Gravolift")} · ${esc(zoneName(z))}${ship.zones[z].damage.includes("lift") ? " · " + t("Endommagé", "Damaged") : ""}" aria-haspopup="dialog">${pictogram("lift")}</button>${movementHelp(true)}</div>`).join("")}</div>${deck("lower")}<div class="ship-stern" aria-hidden="true">${zones.map(() => `<span><i></i><i></i><i></i></span>`).join("")}</div><div class="ship-key"><span><b>A</b>${t("Tirer", "Fire")}</span><span><b>B</b>${t("Énergie", "Energy")}</span><span><b>C</b>${t("Systèmes", "Systems")}</span></div>`;
  }

  function threatPortrait(th) {
    const hp = Math.max(0, th.hp - (th.damage ?? 0));
    const gone = ["destroyed", "survived", "discarded"].includes(th.status);
    const status =
      th.status === "destroyed"
        ? t("Détruite", "Destroyed")
        : th.status === "survived"
          ? t("Échappée", "Escaped")
          : th.status === "discarded"
            ? t("Écartée", "Discarded")
            : null;
    const visual = threatIllustration(th);
    const internal = th.position === "internal";
    const stations = internal
      ? (th.stations ?? [])
      : [`${th.zone}-upper`, `${th.zone}-lower`];
    const targetName = internal
      ? `${t("Salles touchées", "Affected rooms")} : ${stations
          .map((s) => {
            const [z, d] = s.split("-");
            return `${zoneName(z)} ${d === "upper" ? "↑" : "↓"}`;
          })
          .join(", ")}`
      : `${t("Trajectoire", "Trajectory")} : ${zoneName(th.zone)}`;
    const target = `<span class="threat-target" style="--zone:var(--${["red", "white", "blue"].includes(th.zone) ? th.zone : "cyan"})" role="img" aria-label="${esc(targetName)}" title="${esc(targetName)}">${shipLocator(stations, internal ? null : th.zone)}</span>`;
    return `<span class="threat-portrait ${gone ? "resolved-threat" : ""}">${visual}<span class="threat-hud"><span class="hull-gauge"><span>${symbol("hull", `${t("Points de vie", "Hit points")} : ${hp}/${th.hp}`, `<b>${hp}<small>/${th.hp}</small></b>`)}</span><span class="hull-bar"><i style="width:${Math.max(0, Math.min(100, (hp / Math.max(1, th.hp)) * 100))}%"></i></span></span>${target}<span class="shield-badge">${symbol("shield", `${t("Bouclier", "Shield")} : ${th.shield}`, `<b>${th.shield}</b>`)}</span></span>${status ? `<span class="threat-outcome">${esc(status)}</span>` : ""}</span>`;
  }
  return { shipCutaway, threatPortrait };
}
