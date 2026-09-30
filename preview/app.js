import {
  specialDescription,
  traitDescriptions,
  effectDescription,
  eventDescription,
} from "./text.js";
export function mountConsole(root, host = null) {
  const $ = (s) => root.querySelector(s);
  const intervals = [];
  const rootListeners = [];
  const listenRoot = (type, fn) => {
    root.addEventListener(type, fn);
    rootListeners.push([type, fn]);
  };
  const esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  let locale = new URL(location.href).searchParams.get("locale") ?? "fr",
    seat = Number(new URL(location.href).searchParams.get("seat") ?? 0),
    view,
    pending = false,
    received = 0,
    key = "",
    selected = [],
    handFilter = "all",
    lessons = [],
    careerKey = "",
    crew = seat,
    replayFrame = null,
    sound = false,
    combine = false,
    lastSpoken = 0;
  const t = (fr, en) => (locale === "fr" ? fr : en);
  const playerName = (i) =>
    esc(view?.players[i]?.name ?? `${t("Joueur", "Player")} ${i + 1}`);
  const zones = ["red", "white", "blue"];
  const zoneName = (z) =>
    ({
      red: t("Rouge", "Red"),
      white: t("Blanc", "White"),
      blue: t("Bleu", "Blue"),
    })[z] ?? z;
  const names = {
    rocketeer: ["Artilleur", "Rocketeer"],
    "data-analyst": ["Analyste", "Data Analyst"],
    "energy-technician": ["Énergéticien", "Energy Technician"],
    "pulse-gunner": ["Canonnier", "Pulse Gunner"],
    medic: ["Médecin", "Medic"],
    teleporter: ["Téléporteur", "Teleporter"],
    hypernavigator: ["Hypernavigateur", "Hypernavigator"],
    "special-ops": ["Agent spécial", "Special Ops"],
    "squad-leader": ["Chef d’escouade", "Squad Leader"],
    mechanic: ["Mécanicien", "Mechanic"],
  };
  const specialName = (n) => names[n]?.[locale === "fr" ? 0 : 1] ?? n;
  const label = (a) =>
    ({
      A: t("A · Tirer ou réparer l’arme", "A · Fire or repair weapon"),
      B: t(
        "B · Transférer l’énergie ou réparer",
        "B · Transfer energy or repair",
      ),
      C: t(
        "C · Système de la station ou réparation",
        "C · Station system or repair",
      ),
      bots: t("Attaquer avec les robots", "Battlebot attack"),
      red: t("Aller vers le rouge", "Move red"),
      blue: t("Aller vers le bleu", "Move blue"),
      lift: t("Changer de pont", "Change deck"),
    })[a] ??
    (a.startsWith("special:")
      ? `${specialName(a.split(":")[1])} · ${a.endsWith("advanced") ? t("avancé", "advanced") : t("basique", "basic")}`
      : a.startsWith("teleport:")
        ? t("Déplacement héroïque · ", "Heroic move · ") + a.slice(9)
        : a.startsWith("hero:")
          ? t("Héroïque · ", "Heroic · ") + label(a.slice(5))
          : a);
  function icon(a) {
    if (a.startsWith("special:"))
      return `<span class="tiny">✦ ${esc(specialName(a.split(":")[1]))}<br>${a.endsWith("advanced") ? "Ⅱ" : "Ⅰ"}</span>`;
    if (a.startsWith("hero:")) return "★" + icon(a.slice(5));
    if (a.startsWith("teleport:"))
      return `<span class="tiny">↗ ${esc(zoneName(a.split(":")[1].split("-")[0]))}<br>${a.endsWith("upper") ? "↑" : "↓"}</span>`;
    return (
      { A: "A", B: "B", C: "C", bots: "♟", red: "←", blue: "→", lift: "↕" }[
        a
      ] ?? esc(a)
    );
  }
  const duration = (ms) => {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  };
  function announcement(e) {
    if (e.type === "threat")
      return `T+${e.turn} · ${e.severity === "serious" ? t("Menace sérieuse", "Serious threat") : t("Menace", "Threat")} · ${e.position === "internal" ? t("interne", "internal") : zoneName(e.zone)}`;
    return (
      {
        "phase-start": t(
          `Début de phase ${e.phase}`,
          `Phase ${e.phase} begins`,
        ),
        "phase-warning": t(
          `Phase ${e.phase} : encore ${e.seconds} secondes`,
          `Phase ${e.phase} ends in ${e.seconds} seconds`,
        ),
        "incoming-data": t(
          "Données reçues · piochez une carte",
          "Incoming data · draw a card",
        ),
        "data-transfer": t(
          "Transfert de données ouvert",
          "Data transfer opens",
        ),
        "data-transfer-end": t("Transfert terminé", "Data transfer complete"),
        "communications-down": t(
          "Communications interrompues · silence",
          "Communications down · silence",
        ),
        "communications-restored": t(
          "Communications rétablies",
          "Communications restored",
        ),
      }[e.type] ?? e.type
    );
  }
  function button(command, text, disabled = false, extra = "") {
    return `<button data-command="${command}" ${disabled ? "disabled" : ""} ${extra}>${text}</button>`;
  }
  function phaseFor(turn) {
    return turn <= 3 ? 1 : turn <= 7 ? 2 : 3;
  }
  function localizeSetup() {
    const fields = {
      players: ["Joueurs", "Players"],
      "crew-size": ["Équipage", "Crew"],
      mission: ["Mission", "Mission"],
      specialization: ["Spécialisations", "Specializations"],
      "threat-expansion": ["Menaces", "Threats"],
      difficulty: ["Menaces communes", "Common threats"],
      "serious-difficulty": ["Menaces sérieuses", "Serious threats"],
      "campaign-limit": ["Format", "Format"],
      "careers-enabled": ["Expérience", "Experience"],
      "explorer-name": ["Nom", "Name"],
      "explorer-cloning": ["Clonage", "Cloning"],
    };
    for (const [id, words] of Object.entries(fields))
      $("#" + id).parentElement.firstChild.textContent = t(...words) + " ";
    const options = {
      players: [
        ["Solo · 4 androïdes", "Solo · 4 androids"],
        ["2 + 2 androïdes", "2 + 2 androids"],
        ["3 + 1 androïde", "3 + 1 android"],
        ["4", "4"],
        ["5", "5"],
      ],
      "crew-size": [
        ["Standard", "Standard"],
        ["5 équipiers (androïde supplémentaire)", "5 crew (extra android)"],
        ["3 joueurs sans androïde", "3 players without android"],
      ],
      specialization: [
        ["Aucune", "None"],
        ["Niveau 1", "Level 1"],
        ["Niveau 2", "Level 2"],
        ["Niveau 3", "Level 3"],
      ],
      "threat-expansion": [
        ["Jeu de base", "Base game"],
        ["+ The New Frontier", "+ The New Frontier"],
      ],
      "campaign-limit": [
        ["Mission unique", "Single mission"],
        ["Campagne · 3 missions", "Campaign · 3 missions"],
        ["Campagne · 5 missions", "Campaign · 5 missions"],
      ],
      "careers-enabled": [
        ["Partie libre", "Free play"],
        ["Carrières enregistrées", "Saved careers"],
      ],
      "explorer-cloning": [
        ["Autorisé", "Allowed"],
        ["Hardcore · mort définitive", "Hardcore · permanent death"],
      ],
    };
    options.difficulty = options["serious-difficulty"] = [
      ["Blanches", "White"],
      ["Blanches + jaunes", "White + yellow"],
      ["Jaunes", "Yellow"],
      ["Toutes", "All"],
      ["Jaunes + rouges", "Yellow + red"],
      ["Rouges", "Red"],
    ];
    for (const [id, values] of Object.entries(options))
      [...$("#" + id).options].forEach(
        (o, i) => (o.textContent = t(...values[i])),
      );
    for (const [id, words] of Object.entries({
      "new-button": ["Nouvelle session locale", "New local session"],
      "ready-all": [
        "Confirmer tous les joueurs · test local",
        "Ready all players · local test",
      ],
      "next-event": [
        "Prochaine annonce · test local",
        "Next announcement · local test",
      ],
      "create-explorer-button": ["Créer un explorateur", "Create explorer"],
    }))
      $("#" + id).textContent = t(...words);
  }
  function render(next, force = false) {
    view = next;
    received = performance.now();
    const newKey = `${view.revision}/${seat}/${locale}`;
    renderCareers(next);
    if (!force && key === newKey) return;
    key = newKey;
    if (!host && !view.players[seat]) seat = 0;
    if (crew >= view.crewSize) crew = seat;
    root.lang = locale;
    localizeSetup();
    $("#locale").value = locale;
    const openThreats = new Set(
      [...root.querySelectorAll("details[data-threat][open]")].map(
        (el) => el.dataset.threat,
      ),
    );
    const g = view.game,
      own = view.players[seat] ?? {
        ready: true,
        finishedPlanning: true,
        planningPhase: 0,
      },
      resolution = g?.resolution,
      frame = replayFrame !== null ? resolution?.frames[replayFrame] : null,
      ship = frame?.ship ?? g?.ship;
    $("#seat").innerHTML = view.players
      .map(
        (p) =>
          `<option value="${p.seat}" ${p.seat === seat ? "selected" : ""}>${playerName(p.seat)}</option>`,
      )
      .join("");
    $("#status").textContent = {
      presence: t("Équipage, au rapport", "Crew, report in"),
      countdown: t("Départ imminent", "Stand by for launch"),
      programming:
        view.tutorial?.title[locale === "fr" ? 0 : 1] ?? view.mission.title,
      resolution: resolution?.outcome
        ? resolution.outcome.survived
          ? t("Retour à la base", "Back to base")
          : t("Vaisseau perdu", "Ship lost")
        : t("Résolution de la mission", "Mission resolution"),
      cancelled: t("Départ annulé", "Launch cancelled"),
    }[view.stage];
    $("#crew").innerHTML = view.players
      .map(
        (p) =>
          `<span class="crew-member ${p.ready ? "ready" : ""} ${p.seat === seat ? "own" : ""}">${playerName(p.seat)} · ${p.planningPhase ? `${p.finishedPlanning ? "🔒" : t("Phase", "Phase")} ${p.planningPhase}` : p.ready ? t("présent", "ready") : t("attente", "waiting")}</span>`,
      )
      .join("");
    $("#ship-title").textContent = t("Le vaisseau", "The ship");
    $("#threat-title").textContent = t("Menaces détectées", "Detected threats");
    $("#program-title").textContent = t("Programme de vol", "Flight program");
    $("#journal-title").textContent = t("Journal de mission", "Mission log");
    $("#setup-title").textContent = t(
      "Session locale · configuration",
      "Local session · setup",
    );
    $("#help-title").textContent = t("Guide de bord", "Flight guide");
    $("#notice").textContent = t(
      "Jeu de base et The New Frontier · version locale en cours de validation.",
      "Base game and The New Frontier · local playtest under rules review.",
    );
    $("#scope").textContent = t(
      "103 menaces, doubles actions, spécialisations et carrières disponibles. Choisissez une mission courte pour débuter.",
      "103 threats, double actions, specializations and careers available. Choose a short mission to start.",
    );
    $("#lessons-title").textContent = t(
      "École de vol · exercices libres",
      "Flight school · untimed exercises",
    );
    $("#lesson-list").innerHTML = lessons
      .map(
        (l) =>
          `<button data-lesson="${l.id}">${esc(l.title[locale === "fr" ? 0 : 1])}</button>`,
      )
      .join(" ");
    $("#lesson-guide").hidden = !view.tutorial;
    $("#lesson-guide").innerHTML = view.tutorial
      ? `<h2>${esc(view.tutorial.title[locale === "fr" ? 0 : 1])}</h2><ol>${view.tutorial.instructions.map((p) => `<li>${esc(p[locale === "fr" ? 0 : 1])}</li>`).join("")}</ol>${view.stage === "programming" ? `<button id="lesson-next">${view.phase === 1 ? t("Phase 2 →", "Phase 2 →") : t("Terminer la programmation", "Finish programming")}</button>` : ""} <button data-lesson="${view.tutorial.id}" class="quiet">${t("Recommencer", "Restart")}</button>`
      : "";
    $("#footer").textContent = t(
      "Adaptation en cours · Space Alert, Vlaada Chvátil / Czech Games Edition. Hôte local de test ; aucune connexion à BGS.",
      "Adaptation in progress · Space Alert, Vlaada Chvátil / Czech Games Edition. Local test host; no BGS connection.",
    );
    $("#comms").textContent = view.communicationsAvailable
      ? t("COMMS · OK", "COMMS · ONLINE")
      : t("COMMS · SILENCE", "COMMS · BLACKOUT");
    $("#comms").classList.toggle("offline", !view.communicationsAvailable);
    $("#phase").textContent = view.phase
      ? `${t("PHASE", "PHASE")} ${view.phase}`
      : "";
    if (ship) {
      $("#ship").innerHTML = ["upper", "lower"]
        .flatMap((deck) =>
          zones.map((z) => {
            const station = `${z}-${deck}`,
              s = ship.zones[z],
              crewHere = ship.crew.filter(
                (p) => p.station === station && !p.space,
              );
            const system = deck === "upper" ? "shield" : "reactor",
              capacity =
                (system === "shield"
                  ? z === "white"
                    ? 3
                    : 2
                  : z === "white"
                    ? 5
                    : 3) - Number(s.damage.includes(system));
            const c = {
              "red-upper": t("Intercepteurs", "Interceptors"),
              "white-upper": t("Ordinateur", "Computer"),
              "blue-upper": t("Robots", "Battlebots"),
              "red-lower": t("Robots", "Battlebots"),
              "white-lower": t("Observation", "Visual confirmation"),
              "blue-lower": t("Roquette", "Rocket"),
            }[station];
            return `<div class="station" style="--zone:var(--${z})"><div class="station-title">${esc(zoneName(z))} ${deck === "upper" ? "↑" : "↓"}</div><div class="weapon">${deck === "lower" && z === "white" ? "◎" : "⌁"} <small>${(deck === "upper" ? (z === "white" ? 5 : 4) : z === "white" ? 1 : 2) - Number(s.damage.includes(`${deck}-weapon`) && station !== "white-lower")}</small></div><div class="systems"><div><b>A</b> ${deck === "lower" && z === "white" ? t("Impulsion", "Pulse") : t("Laser", "Laser")}</div><div><b>B</b> ${system === "shield" ? "⛨" : "⚡"} ${s[system]}/${capacity}</div><div><b>C</b> ${esc(c)}</div></div><div class="occupants">${crewHere.map((p) => `<span class="pawn ${p.knockedOut ? "out" : ""}" title="${t("Équipier", "Crew")} ${p.id + 1}${p.bots !== null ? " · ♟" : ""}">${p.id + 1}</span>`).join("")}</div>${s.damage.length ? `<div class="damage">${t("Dégâts", "Damage")} ${s.damage.length}/6</div>` : ""}</div>`;
          }),
        )
        .join("");
      $("#resources").innerHTML =
        `<span>⚡ ${t("Combustible", "Fuel")} <b>${ship.fuel}</b></span><span>↗ ${t("Roquettes", "Rockets")} <b>${ship.rockets}</b></span><span>⌨ ${ship.computer.map((x) => (x ? "●" : "○")).join(" ")}</span><span>♟ ${ship.bots.filter((b) => b.owner === null && b.station && !b.disabled).length} ${t("disponibles", "available")}</span>${ship.crew
          .filter((p) => p.space)
          .map(
            (p) =>
              `<span>↗ ${t("Équipier", "Crew")} ${p.id + 1} · ${t("portée", "range")} ${p.space}${p.knockedOut ? " †" : ""}</span>`,
          )
          .join("")}`;
    }
    const threats =
      frame?.threats ??
      resolution?.frames.at(-1)?.threats ??
      g?.threats.map((x) => ({ ...x, ...x.card, status: "announced" })) ??
      [];
    $("#threats").innerHTML =
      threats
        .map(
          (th) =>
            `<details data-threat="${th.instance}" ${openThreats.has(String(th.instance)) ? "open" : ""} class="threat" style="--zone:var(--${th.zone ?? "gold"})"><summary><span>T+${th.turn}</span><strong>${esc(th.name)}</strong><span class="stats">${th.status === "destroyed" ? "✓" : th.status === "survived" ? "↘" : `${Math.max(0, th.hp - (th.damage ?? 0))} ♥ · ${th.shield} ⛨`}</span></summary><p>${th.position === "internal" ? esc(th.stations.join(", ")) + " · " + esc(label(th.repair)) : esc(zoneName(th.zone))} · ${t("Vitesse", "Speed")} ${th.speed}</p>${traitDescriptions(
              th,
              locale,
            )
              .map((text) => `<p class="trait">${esc(text)}</p>`)
              .join("")}${Object.entries(th.effects)
              .map(
                ([mark, es]) =>
                  `<p><b>${mark}</b> ${es.map((e) => esc(effectDescription(e, locale))).join(" · ") || "—"}</p>`,
              )
              .join(
                "",
              )}${calledHtml(th.calledCard)}${(th.track ?? g.tracks[th.zone ?? "internal"]) ? trackHtml(th, g) : ""}</details>`,
        )
        .join("") ||
      `<p class="empty">${t("En attente des premières détections.", "Awaiting the first detections.")}</p>`;
    const announcements = view.log.filter((x) => x.type === "announcement");
    $("#latest").textContent =
      view.stage === "resolution"
        ? t(
            "Programmation terminée · résolution des actions",
            "Programming complete · resolving actions",
          )
        : view.stage === "cancelled"
          ? t(
              "Départ annulé : toutes les présences n’ont pas été confirmées sous deux minutes. Créez une nouvelle session pour réessayer.",
              "Launch cancelled: not everyone confirmed within two minutes. Create a new session to try again.",
            )
          : announcements.length
            ? announcement(announcements.at(-1).event)
            : t(
                "Tout le monde confirme sa présence avant le départ.",
                "Everyone confirms their presence before launch.",
              );
    if (sound)
      for (const item of announcements.filter((x) => x.id > lastSpoken)) {
        if (item === announcements.at(-1)) speak(announcement(item.event));
      }
    lastSpoken = announcements.at(-1)?.id ?? 0;
    $("#program-crew").innerHTML = Array.from(
      { length: view.crewSize },
      (_, i) =>
        `<option value="${i}" ${crew === i ? "selected" : ""}>${g?.solo || i >= view.players.length ? `${t("Androïde", "Android")} ${i + 1}` : playerName(i)}${g?.specializations[i] ? " · " + esc(specialName(g.specializations[i].name)) : ""}</option>`,
    ).join("");
    const planning = view.stage === "programming",
      canOwn =
        seat >= 0 && (g?.solo || crew === seat || crew >= view.players.length),
      ownPhase =
        g?.solo || crew >= view.players.length ? view.phase : own.planningPhase;
    $("#program").innerHTML = (g?.programs[crew] ?? [])
      .slice(0, view.mission.phaseEndsMs.length === 2 ? 7 : 12)
      .map((slot) => {
        const editable =
          planning &&
          canOwn &&
          !own.finishedPlanning &&
          phaseFor(slot.turn) === ownPhase;
        return `<button class="slot ${phaseFor(slot.turn) < ownPhase ? "locked" : ""} ${phaseFor(slot.turn) > ownPhase ? "future" : ""}" data-turn="${slot.turn}" ${editable ? "" : "disabled"} title="T+${slot.turn}"><span class="turn">T+${slot.turn} ${phaseFor(slot.turn) < ownPhase ? "🔒" : ""}</span><span class="action">${slot.cards.map((c) => (c.sides ? c.sides[c.side].map(icon).join(" ") : c.category === "movement" ? "↔" : "◆")).join(" + ") || "·"}</span></button>`;
      })
      .join("");
    $("#player-help").textContent = planning
      ? selected.length
        ? t(
            "Choisissez un tour pour cette carte.",
            "Choose a turn for this card.",
          )
        : t(
            "Choisissez une moitié de carte, puis un tour. Cliquez sur un tour rempli pour reprendre sa carte.",
            "Choose a card half, then a turn. Click a filled turn to retrieve its card.",
          )
      : view.stage === "presence"
        ? t(
            "Prêt pendant deux minutes. Nous attendons que tout le monde soit prêt.",
            "Ready lasts two minutes. We wait until everyone is ready together.",
          )
        : view.stage === "resolution"
          ? t(
              "Les programmes sont verrouillés. Avancez la résolution ou revoyez les étapes.",
              "Programs are locked. Advance resolution or review its steps.",
            )
          : "";
    $("#controls").innerHTML = ["presence", "countdown"].includes(view.stage)
      ? button(
          own.ready ? "unready" : "ready",
          own.ready
            ? t("Pas encore prêt", "Not ready yet")
            : t("Je suis prêt", "I’m ready"),
          !view.players[seat],
          'class="primary"',
        )
      : planning
        ? `${g?.solo ? "" : button("advance-phase", t("Phase suivante →", "Next phase →"), own.finishedPlanning || own.planningPhase >= view.mission.phaseEndsMs.length)}${button("finish-planning", t("Verrouiller mon programme", "Lock my program"), own.finishedPlanning || view.phase < view.mission.phaseEndsMs.length)}${g.dataCredits ? button("draw", `${t("Piocher", "Draw")} +${g.dataCredits}`) : ""}${g.androidDataCredits ? button("draw-android", t("Carte androïde", "Android card") + ` +${g.androidDataCredits}`, !g.canDrawAndroid) : ""}`
        : view.stage === "resolution"
          ? `${button("resolve", t("Étape suivante →", "Next step →"), seat !== 0 || !!resolution?.outcome, 'class="primary"')}${button("resolve-all", t("Résoudre la mission", "Resolve mission"), seat !== 0 || !!resolution?.outcome)}`
          : view.stage === "cancelled"
            ? '<button id="open-setup">' +
              t("Nouvelle session", "New session") +
              "</button>"
            : "";
    const preparing = ["presence", "countdown"].includes(view.stage);
    root.classList.toggle("preparing", preparing);
    $("#preparation").hidden = !preparing;
    $("#ready-help").textContent = preparing
      ? $("#player-help").textContent
      : "";
    $("#ready-controls").replaceChildren(
      ...(preparing ? [...$("#controls").childNodes] : []),
    );
    if (preparing && host) $("#notice").textContent = view.mission.title;
    const hand = [
      ...(g?.hand ?? []),
      ...(g?.androidCards ?? []).filter((c) => c.owner === crew),
    ];
    const grouped = [];
    for (const card of hand) {
      const same = grouped.find(
        (c) =>
          c.kind === "normal" &&
          card.kind === "normal" &&
          JSON.stringify(c.sides) === JSON.stringify(card.sides),
      );
      if (same) same.count++;
      else grouped.push({ ...card, count: 1 });
    }
    $("#selection-tools").innerHTML =
      planning &&
      canOwn &&
      g.specializations.some(
        (s) => s && ["medic", "special-ops"].includes(s.name),
      )
        ? `<button id="combine" class="quiet" aria-pressed="${combine}">${t("Combiner deux cartes", "Combine two cards")} ${combine ? "●" : ""}</button>`
        : "";
    $("#card-help").textContent = selected
      .map((choice) => {
        const card = hand.find((c) => c.id === choice.id);
        return card?.sides[choice.side]
          .map((action) =>
            action.startsWith("special:")
              ? specialDescription(action, locale)
              : label(action),
          )
          .join(" → ");
      })
      .filter(Boolean)
      .join(" + ");
    $("#hand").innerHTML =
      planning && canOwn
        ? grouped
            .filter(
              (c) =>
                handFilter === "all" ||
                c.kind !== "normal" ||
                c.sides.some((side) =>
                  side.some((a) =>
                    handFilter === "move"
                      ? ["red", "blue", "lift"].includes(a)
                      : a === handFilter,
                  ),
                ),
            )
            .map(
              (c) =>
                `<div class="card ${c.kind}">${c.count > 1 ? `<span class="copies">×${c.count}</span>` : ""}${c.sides.map((side, index) => `<button data-card="${esc(c.id)}" data-side="${index}" class="${selected.some((s) => s.id === c.id && s.side === index) ? "selected" : ""}" aria-pressed="${selected.some((s) => s.id === c.id && s.side === index)}" title="${esc(side.map(label).join(" → "))}" aria-label="${esc(side.map(label).join(" → "))}">${side.map(icon).join(" · ")}</button>`).join("")}</div>`,
            )
            .join("")
        : "";
    $("#hand-filter").innerHTML =
      planning && canOwn && grouped.length > 12
        ? ["all", "A", "B", "C", "bots", "move"]
            .map(
              (f) =>
                `<button data-filter="${f}" class="quiet" aria-pressed="${handFilter === f}">${f === "all" ? t("Tout", "All") : f === "bots" ? "♟" : f === "move" ? "↔" : f}</button>`,
            )
            .join("")
        : "";
    const teleporter = g.specializations[crew]?.name === "teleporter";
    $("#teleport").innerHTML =
      planning && canOwn && teleporter
        ? `<div class="token-controls"><label>${t("Téléporter", "Teleport")}<select id="teleport-from">${Array.from({ length: view.crewSize }, (_, id) => `<option value="${id}" ${g.teleportTokens[crew][0] === id ? "selected" : ""}>${t("Équipier", "Crew")} ${id + 1}</option>`).join("")}</select></label><label>${t("Auprès de", "To")}<select id="teleport-to">${Array.from({ length: view.crewSize }, (_, id) => `<option value="${id}" ${g.teleportTokens[crew][1] === id ? "selected" : ""}>${t("Équipier", "Crew")} ${id + 1}</option>`).join("")}</select></label><button id="place-tokens" ${g.solo || view.transferClosesAt ? "" : "disabled"}>${t("Placer les jetons", "Set tokens")}</button></div><small>${t("Changeables pendant un transfert de données. Leur position finale sera utilisée pendant la résolution.", "Move tokens during data transfer. Their final positions are used during resolution.")}</small>`
        : "";
    $("#transfer").innerHTML =
      planning && view.transferClosesAt && !g.transferUsed
        ? view.players
            .filter((p) => p.seat !== seat)
            .map(
              (p) =>
                `<button data-transfer="${p.seat}" ${selected.length === 1 ? "" : "disabled"}>${t("Envoyer à", "Send to")} ${p.seat + 1}</button>`,
            )
            .join("")
        : "";
    $("#replay").innerHTML = resolution
      ? `<p>${resolution.outcome ? `${resolution.outcome.survived ? "✓" : "✕"} ${t("Score", "Score")} : <b>${resolution.outcome.score}</b> · ${resolution.outcome.threatPoints} ${t("menaces", "threats")} + ${resolution.outcome.visual} ${t("observation", "visual")} − ${resolution.outcome.penalties} ${t("pénalités", "penalties")}` : `T+${resolution.turn} · ${esc({ appear: t("Apparitions", "Appearances"), crew: t("Actions de l’équipage", "Crew actions"), damage: t("Dégâts", "Damage"), threats: t("Actions des menaces", "Threat actions"), computer: t("Ordinateur", "Computer") }[resolution.step])}`}</p><label>${t("Revoir une étape", "Review a step")} <input id="replay-slider" type="range" min="0" max="${resolution.frames.length - 1}" value="${replayFrame ?? resolution.frames.length - 1}"></label>${replayFrame !== null ? '<button id="live" class="quiet">' + t("Revenir au direct", "Back to live") + "</button>" : ""}`
      : "";
    renderCampaign(g?.campaign);
    $("#announcements").innerHTML = resolution
      ? resolution.log
          .filter((_, i) => !frame || i < frame.logEnd)
          .map((e) => `<li>T+${e.turn} · ${esc(logText(e))}</li>`)
          .join("")
      : announcements
          .map(
            (e) =>
              `<li>${duration(e.at - view.missionStartAt)} · ${esc(announcement(e.event))}</li>`,
          )
          .join("");
    $("#ready-all").disabled = view.stage !== "presence";
    $("#next-event").disabled =
      !!view.tutorial || !["programming", "countdown"].includes(view.stage);
    $("#help").innerHTML = t(
      "<p><b>Planifier.</b> A utilise l’arme, B l’énergie, C le système indiqué dans la station. Les flèches déplacent votre équipier. Les déplacements planifiés ne déplacent pas encore les pions : tout sera exécuté pendant la résolution.</p><p><b>Coordonner.</b> Chaque arme ne tire qu’une fois par tour. Le réacteur de la zone alimente le laser lourd et l’impulsion ; les petits lasers ont leur propre batterie. Deux équipiers prenant le même ascenseur retardent le second.</p><p><b>Ordinateur.</b> Quelqu’un doit faire C sur la passerelle pendant les deux premiers tours de chaque phase (1–2, 4–5, 8–9), sinon les actions suivantes sont retardées.</p><p><b>Menaces.</b> Les tirs se combinent avant de retirer le bouclier adverse. Une roquette touche au tour suivant. Les ennemis avancent après les actions et exécutent X, Y, Z en les franchissant.</p><p><b>Coopérer à distance.</b> Utilisez une conversation vocale externe. Pendant une panne de communication, gardez le silence : cette page ne peut pas couper votre appel.</p>",
      "<p><b>Plan.</b> A operates a weapon, B transfers energy, C uses the station system. Arrows move your crew member. Planning does not move the real ship pieces; programs execute during resolution.</p><p><b>Coordinate.</b> Each weapon fires once per turn. Heavy lasers and pulse draw from the zone reactor; light lasers have their own battery. A second crew member using the same lift is delayed.</p><p><b>Computer.</b> Someone must perform C on the bridge within the first two turns of each phase (1–2, 4–5, 8–9), or the next actions are delayed.</p><p><b>Threats.</b> Combine fire before subtracting enemy shields. Rockets hit on the following turn. Threats move after crew actions and execute X, Y and Z as they cross them.</p><p><b>Remote cooperation.</b> Use external voice chat. Stay silent during communications blackouts; this page cannot mute your call.</p>",
    );
  }
  function calledHtml(data) {
    if (!data) return "";
    const c = data.card;
    return `<div class="called-threat"><h4>${t("Renfort", "Reinforcement")} · ${esc(c.name)}</h4><p>${c.hp} ♥ · ${c.shield} ⛨ · ${t("Vitesse", "Speed")} ${c.speed}${c.stations ? " · " + esc(c.stations.join(", ")) + " · " + esc(label(c.repair)) : ""}</p>${traitDescriptions(
      c,
      locale,
    )
      .map((text) => `<p>${esc(text)}</p>`)
      .join("")}${Object.entries(c.effects)
      .map(
        ([mark, es]) =>
          `<p><b>${mark}</b> ${es.map((e) => esc(effectDescription(e, locale))).join(" · ") || "—"}</p>`,
      )
      .join("")}${calledHtml(data.calledCard)}</div>`;
  }
  function trackHtml(th, g) {
    const track = th.track ?? g.tracks[th.zone ?? "internal"];
    return `<div class="track">${Array.from(
      { length: track.length },
      (_, i) => track.length - i,
    )
      .map(
        (n) =>
          `<span class="${th.positionOnTrack === n ? "current" : ""} ${track.marks.some((x) => x[0] === n) ? "mark" : ""}">${track.marks.find((x) => x[0] === n)?.[1] ?? ""}</span>`,
      )
      .join("")}</div>`;
  }
  function logText(e) {
    return eventDescription(
      e,
      locale,
      view.game.resolution?.frames.at(-1)?.threats ?? view.game.threats,
    );
  }
  function setupCrewSize() {
    return (
      Number($("#crew-size").value) || Math.max(4, Number($("#players").value))
    );
  }
  function setupSpecialists() {
    const previous = [...root.querySelectorAll("#specialists select")].map(
      (s) => s.value,
    );
    const careers = $("#careers-enabled").value === "1";
    const seats = [...root.querySelectorAll("#career-seats select")].map(
      (s) => s.value,
    );
    $("#career-seats").innerHTML = careers
      ? Array.from(
          { length: Number($("#players").value) },
          (_, id) =>
            `<label>${t("Joueur", "Player")} ${id + 1}<select data-career-seat="${id}"><option value="">${t("Choisir un explorateur", "Choose explorer")}</option>${(
              view?.explorers ?? []
            )
              .filter((e) => !e.dead && !e.activeRun)
              .map(
                (e) =>
                  `<option value="${e.id}" ${seats[id] === e.id ? "selected" : ""}>${esc(e.name)} · ${e.level}</option>`,
              )
              .join("")}</select></label>`,
        ).join("")
      : "";
    const assigned = [...root.querySelectorAll("#career-seats select")].map(
      (s) => view?.explorers.find((e) => e.id === s.value),
    );
    $("#specialization").disabled = careers;
    $("#specialists").innerHTML =
      careers || Number($("#specialization").value)
        ? Array.from({ length: setupCrewSize() }, (_, id) => {
            let choices = Object.keys(names).map((name) => ({
              name,
              level: Number($("#specialization").value),
            }));
            if (careers) {
              const owners =
                id < assigned.length && assigned.length > 1
                  ? [assigned[id]]
                  : assigned;
              choices = Object.keys(names)
                .map((name) => ({
                  name,
                  level: Math.max(
                    0,
                    ...owners.map((e) => e?.specializations[name] ?? 0),
                  ),
                }))
                .filter((s) => s.level);
            }
            const selected = previous[id] ?? (careers ? "" : choices[id]?.name);
            return `<label>${t("Équipier", "Crew")} ${id + 1}<select>${careers ? `<option value="">${t("Aucune spécialisation", "No specialization")}</option>` : ""}${choices.map((s) => `<option value="${s.name}" data-level="${s.level}" ${selected === s.name ? "selected" : ""}>${esc(specialName(s.name))} ${careers ? s.level : ""}</option>`).join("")}</select></label>`;
          }).join("")
        : "";
  }
  for (const id of [
    "players",
    "specialization",
    "crew-size",
    "careers-enabled",
  ])
    $("#" + id).addEventListener("change", setupSpecialists);
  $("#career-seats").addEventListener("change", setupSpecialists);
  async function localPost(path, body) {
    if (host) {
      if (path === "/api/campaign-next") return command("campaign-next", body);
      if (path === "/api/career") {
        if (body.id && body.id !== view.careerIds[seat])
          throw Error("Choose your own explorer");
        const { type, id, ...rest } = body;
        return command("career", { action: type, ...rest });
      }
      throw Error("Use the BGS table to start another game");
    }
    const response = await fetch(`${path}?seat=${seat}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const next = await response.json();
    if (!response.ok) throw Error(next.error);
    render(next, true);
    return next;
  }
  function renderCampaign(c) {
    if (!c) {
      $("#campaign").innerHTML = "";
      return;
    }
    let content = `<h3>${t("Campagne", "Campaign")} · ${c.missions.length}/${c.limit}</h3>`;
    if (c.stage === "decision")
      content += `<p>${t("Continuer nécessite l’accord de tous. Rentrer termine la campagne avant les réparations.", "Continuing requires everyone’s agreement. Returning ends the campaign before repairs.")}</p><button id="campaign-continue" ${c.votes.includes(seat) ? "disabled" : ""}>${t("Continuer", "Continue")}</button> <button id="campaign-return">${t("Rentrer à la base", "Return to base")}</button>`;
    if (c.stage === "repairs") {
      const may =
        view.game.solo ||
        c.repairCursor === seat ||
        c.repairCursor >= view.players.length;
      content += `<p>${t("Réparation de l’équipier", "Repair for crew")} ${c.repairCursor + 1}</p>`;
      for (const [zone, tiles] of Object.entries(c.carried.zones))
        for (const tile of tiles)
          content += `<button data-repair-zone="${zone}" data-repair-tile="${tile}" ${!may || c.repairedZones[zone] >= 2 ? "disabled" : ""}>${esc(zoneName(zone))} · ${esc(tile)}</button> `;
      c.carried.disabledBots.forEach((disabled, bot) => {
        if (disabled)
          content += `<button data-repair-bot="${bot}" ${may ? "" : "disabled"}>♟ ${bot + 1}</button>`;
      });
      content += `<button id="repair-skip" ${may ? "" : "disabled"}>${t("Ne rien réparer", "Skip repair")}</button>`;
    }
    if (c.stage === "ready" && host)
      content += `<label>${t("Prochaine mission", "Next mission")}<select id="campaign-mission">${host.missions
        .filter((m) => /^(realmission|double)/.test(m.id))
        .map(
          (m) =>
            `<option value="${m.id}" ${m.id === view.mission.id ? "selected" : ""}>${esc(m.title)}</option>`,
        )
        .join("")}</select></label>`;
    if (c.stage === "ready")
      content += `<p>${t("Prochaine mission : celle sélectionnée dans la configuration.", "Next mission: the one selected in setup.")}</p><label>${t("Si une seule escouade reste :", "If one battlebot squad remains:")}<select id="campaign-bots"><option value="red-lower">${t("Rouge ↓", "Red ↓")}</option><option value="blue-upper">${t("Bleu ↑", "Blue ↑")}</option></select></label><button id="campaign-next" ${seat === 0 ? "" : "disabled"}>${t("Mission suivante", "Next mission")}</button>`;
    if (c.outcome)
      content += `<p>${t("Score de campagne", "Campaign score")} : <strong>${c.outcome.score}</strong></p>`;
    $("#campaign").innerHTML = content;
  }
  function renderCareers(next) {
    const k = JSON.stringify([locale, next.explorers]);
    if (k === careerKey) return;
    careerKey = k;
    $("#career-title").textContent = t(
      host ? "Explorateurs · cette table" : "Explorateurs · carrières locales",
      host ? "Explorers · this table" : "Explorers · local careers",
    );
    const opened = new Set(
      [...root.querySelectorAll("details[data-explorer][open]")].map(
        (d) => d.dataset.explorer,
      ),
    );
    $("#explorers").innerHTML = (next.explorers ?? [])
      .map((e) => {
        const spent = Object.values(e.specializations).reduce(
            (n, v) => n + v,
            0,
          ),
          unspent = e.level - spent;
        const learn =
          unspent && !e.activeRun && !e.dead && (!host || e.editable)
            ? `<p>${unspent} ${t("niveau(x) à attribuer", "level(s) to assign")}</p>${Object.keys(
                names,
              )
                .map(
                  (name) =>
                    `<button data-learn="${name}" data-explorer="${e.id}" ${(e.specializations[name] ?? 0) >= 3 || ((e.specializations[name] ?? 0) >= 1 && spent + 1 < 3) || ((e.specializations[name] ?? 0) >= 2 && spent + 1 < 6) ? "disabled" : ""}>${esc(specialName(name))} ${(e.specializations[name] ?? 0) + 1}</button>`,
                )
                .join(" ")}`
            : "";
        const claims =
          !e.activeRun && !e.dead && e.eligible.length && (!host || e.editable)
            ? `<p><a target="_blank" rel="noopener" href="https://filemanager.czechgames.com/storage/files/space-alert-the-new-frontier/other-downloads/achievements/space-alert-2-achievements-${locale === "fr" ? "fr" : "en"}.pdf">${t("Conditions officielles des succès", "Official achievement requirements")}</a></p><label><input type="checkbox" data-agrees="${e.id}">${t("Conditions vérifiées ; accord de l’équipage si nécessaire.", "Requirements checked; crew agrees where required.")}</label><select data-claim-choice="${e.id}">${e.eligible.map((a) => `<option value="${a.id}">${esc(a.name)} · +${a.xp}</option>`).join("")}</select><button data-claim="${e.id}">${t("Valider le succès", "Record achievement")}</button>`
            : "";
        return `<details data-explorer="${e.id}" ${opened.has(e.id) ? "open" : ""}><summary>${esc(e.name)} · ${t("Niveau", "Level")} ${e.level} · ${e.xp} XP ${e.dead ? "†" : e.activeRun ? "· " + t("en mission", "on mission") : ""}</summary><p>${e.cloning ? t("Clonage autorisé", "Cloning enabled") : t("Hardcore", "Hardcore")} · ${e.clones} ${t("clone(s)", "clone(s)")}</p><p>${Object.entries(
          e.specializations,
        )
          .map(([n, l]) => `${esc(specialName(n))} ${l}`)
          .join(
            " · ",
          )}</p>${!e.cloning && !e.activeRun && !e.dead && (!host || e.editable) ? `<button data-consent="${e.id}">${t("Autoriser le clonage", "Consent to cloning")}</button>` : ""}${learn}${claims}${
          host &&
          e.editable &&
          view.stage === "presence" &&
          !view.players[seat]?.ready
            ? e.dead
              ? `<button data-new-explorer="${e.id}">${t("Nouvel explorateur", "New explorer")}</button>`
              : Object.keys(e.specializations)
                  .map(
                    (n) =>
                      `<button data-equip="${n}">${t("Choisir", "Choose")} ${esc(specialName(n))}</button>`,
                  )
                  .join(" ")
            : ""
        }<ol>${e.runs
          .slice(-5)
          .map(
            (r) =>
              `<li>${r.survived ? "✓" : "✕"} ${r.score} · +${r.xp} XP</li>`,
          )
          .join("")}</ol></details>`;
      })
      .join("");
    setupSpecialists();
  }
  $("#create-explorer").addEventListener("submit", (e) => {
    e.preventDefault();
    perform(async () => {
      await localPost("/api/career", {
        type: "create",
        name: $("#explorer-name").value,
        cloning: $("#explorer-cloning").value === "1",
      });
      $("#explorer-name").value = "";
    });
  });
  function speak(text) {
    if (!("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = locale === "fr" ? "fr-FR" : "en-US";
    u.rate = 1.1;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }
  async function command(type, extra = {}, target = seat) {
    if (host) {
      if (target !== seat || seat < 0)
        throw Error("Only your own seat can send commands");
      return host.command({ type, sequence: view.nextSequence, ...extra });
    }
    const s =
      target === seat
        ? view
        : await fetch(`/api/state?seat=${target}`).then((r) => r.json());
    const result = await fetch(`/api/command?seat=${target}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, sequence: s.nextSequence, ...extra }),
    }).then((r) => r.json());
    if (target === seat) render(result.view);
    if (!result.accepted) throw Error(result.error);
  }
  async function perform(fn) {
    pending = true;
    $("#error").textContent = "";
    try {
      await fn();
    } catch (e) {
      const error = $("#error");
      if (error) error.textContent = e.message;
    } finally {
      pending = false;
    }
  }
  async function refresh() {
    if (host) return;
    if (pending) return;
    try {
      const next = await fetch(`/api/state?seat=${seat}`).then((r) => r.json());
      render(next);
      $("#connection").textContent = t("HÔTE LOCAL", "LOCAL HOST");
    } catch {
      $("#connection").textContent = t("RECONNEXION", "RECONNECTING");
    }
  }
  function rerender() {
    if (view) render(view, true);
  }
  listenRoot("click", (e) => {
    const el = e.target.closest("button");
    if (host && ["ready-all", "next-event", "open-setup"].includes(el?.id))
      return;
    if (!el || pending) return;
    if (el.id === "open-setup") {
      $("#setup").open = true;
      $("#setup").scrollIntoView({ block: "start" });
      return;
    }
    if (el.dataset.lesson) {
      perform(async () => {
        seat = 0;
        crew = 0;
        selected = [];
        replayFrame = null;
        await localPost("/api/lesson", { lesson: el.dataset.lesson });
        $("#lessons").open = false;
        $("#lesson-guide").scrollIntoView({ block: "start" });
      });
      return;
    }
    if (el.id === "lesson-next") {
      perform(() => localPost("/api/lesson-next", {}));
      return;
    }
    if (el.dataset.filter) {
      handFilter = el.dataset.filter;
      rerender();
      return;
    }
    if (el.id === "campaign-continue" || el.id === "campaign-return") {
      perform(() =>
        command("campaign-vote", { continue: el.id === "campaign-continue" }),
      );
      return;
    }
    if (
      el.dataset.repairZone ||
      el.dataset.repairBot !== undefined ||
      el.id === "repair-skip"
    ) {
      perform(() =>
        command("campaign-repair", {
          crew: view.game.campaign.repairCursor,
          ...(el.id === "repair-skip"
            ? { skip: true }
            : el.dataset.repairBot !== undefined
              ? { bot: Number(el.dataset.repairBot) }
              : { zone: el.dataset.repairZone, tile: el.dataset.repairTile }),
        }),
      );
      return;
    }
    if (el.id === "campaign-next") {
      perform(async () => {
        replayFrame = null;
        selected = [];
        await localPost("/api/campaign-next", {
          mission: (host ? $("#campaign-mission") : $("#mission")).value,
          difficulty: $("#difficulty").value.split(",").map(Number),
          seriousDifficulty: $("#serious-difficulty")
            .value.split(",")
            .map(Number),
          botStation: $("#campaign-bots").value,
        });
      });
      return;
    }
    if (el.dataset.equip) {
      perform(() =>
        command("career", {
          action: "specialization",
          specialization: el.dataset.equip,
          crew: seat,
        }),
      );
      return;
    }
    if (el.dataset.newExplorer) {
      perform(() => command("career", { action: "new" }));
      return;
    }
    if (el.dataset.learn) {
      perform(() =>
        localPost("/api/career", {
          type: "learn",
          id: el.dataset.explorer,
          specialization: el.dataset.learn,
        }),
      );
      return;
    }
    if (el.dataset.consent) {
      perform(() =>
        localPost("/api/career", { type: "consent", id: el.dataset.consent }),
      );
      return;
    }
    if (el.dataset.claim) {
      perform(() => {
        const id = el.dataset.claim;
        const agrees = root.querySelector(`[data-agrees="${id}"]`).checked;
        if (!agrees)
          throw Error(
            t(
              "Vérifiez les conditions du succès avant de le valider.",
              "Check the achievement requirements before recording it.",
            ),
          );
        return localPost("/api/career", {
          type: "claim",
          id,
          runId: view.explorers.find((e) => e.id === id).runs.at(-1).id,
          achievement: root.querySelector(`[data-claim-choice="${id}"]`).value,
          crewAgrees: agrees,
        });
      });
      return;
    }
    if (el.id === "combine") {
      combine = !combine;
      selected = [];
      rerender();
      return;
    }
    if (el.id === "place-tokens") {
      perform(() =>
        command("teleport", {
          crew,
          from: Number($("#teleport-from").value),
          to: Number($("#teleport-to").value),
        }),
      );
      return;
    }
    if (el.dataset.card) {
      const choice = { id: el.dataset.card, side: Number(el.dataset.side) };
      if (e.shiftKey || combine)
        selected = [
          ...selected.filter((c) => c.id !== choice.id),
          choice,
        ].slice(-2);
      else
        selected = selected.some(
          (c) => c.id === choice.id && c.side === choice.side,
        )
          ? []
          : [choice];
      rerender();
      return;
    }
    if (el.dataset.turn) {
      const turn = Number(el.dataset.turn),
        slot = view.game.programs[crew][turn - 1];
      perform(async () => {
        await command(selected.length ? "program" : "remove", {
          crew,
          turn,
          slotVersion: slot.revision,
          ...(selected.length ? { cards: selected } : {}),
        });
        selected = [];
        rerender();
      });
      return;
    }
    if (el.dataset.command) {
      perform(async () => {
        const type = el.dataset.command;
        if (
          type === "advance-phase" &&
          !confirm(
            t(
              "Les tours de cette phase seront définitivement verrouillés. Continuer ?",
              "This permanently locks the current phase. Continue?",
            ),
          )
        )
          return;
        await command(
          type === "resolve-all"
            ? "resolve"
            : type === "draw-android"
              ? "draw"
              : type,
          type === "resolve-all"
            ? { all: true }
            : type === "draw-android"
              ? { android: true }
              : {},
        );
      });
      return;
    }
    if (el.dataset.transfer) {
      perform(async () => {
        await command("transfer", {
          card: selected[0]?.id,
          to: Number(el.dataset.transfer),
        });
        selected = [];
        rerender();
      });
      return;
    }
    if (el.id === "sound") {
      sound = !sound;
      el.setAttribute("aria-pressed", sound);
      el.textContent = sound ? "♫" : "♪";
      if (sound) speak(t("Annonces activées", "Announcements enabled"));
      else speechSynthesis.cancel();
    }
    if (el.id === "ready-all")
      perform(async () => {
        for (const p of view.players)
          if (!p.ready) await command("ready", {}, p.seat);
        await refresh();
      });
    if (el.id === "next-event")
      perform(async () => {
        const result = await fetch(`/api/advance?seat=${seat}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        }).then((r) => r.json());
        render(result);
      });
    if (el.id === "live") {
      replayFrame = null;
      rerender();
    }
  });
  $("#locale").addEventListener("change", (e) => {
    locale = e.target.value;
    rerender();
  });
  $("#seat").addEventListener("change", (e) => {
    seat = Number(e.target.value);
    crew = seat;
    selected = [];
    key = "";
    history.replaceState(null, "", `?seat=${seat}&locale=${locale}`);
    refresh();
  });
  $("#program-crew").addEventListener("change", (e) => {
    crew = Number(e.target.value);
    selected = [];
    rerender();
  });
  listenRoot("change", (e) => {
    if (e.target.id === "replay-slider") {
      replayFrame = Number(e.target.value);
      rerender();
    }
  });
  $("#new-session").addEventListener("submit", (e) => {
    e.preventDefault();
    perform(async () => {
      const players = Number($("#players").value),
        level = Number($("#specialization").value),
        specializations =
          level || $("#careers-enabled").value === "1"
            ? [...root.querySelectorAll("#specialists select")].map((select) =>
                select.value
                  ? {
                      name: select.value,
                      level:
                        $("#careers-enabled").value === "1"
                          ? Number(select.selectedOptions[0].dataset.level)
                          : level,
                    }
                  : null,
              )
            : [];
      const res = await fetch(`/api/new?seat=${seat}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          players,
          mission: $("#mission").value,
          crewSize: setupCrewSize(),
          careerIds:
            $("#careers-enabled").value === "1"
              ? [...root.querySelectorAll("#career-seats select")].map(
                  (s) => s.value,
                )
              : [],
          gameOptions: {
            specializations,
            threatExpansion: $("#threat-expansion").value === "1",
            difficulty: $("#difficulty").value.split(",").map(Number),
            seriousDifficulty: $("#serious-difficulty")
              .value.split(",")
              .map(Number),
            campaignLimit: Number($("#campaign-limit").value),
          },
        }),
      });
      const next = await res.json();
      if (!res.ok) throw Error(next.error);
      replayFrame = null;
      selected = [];
      crew = seat;
      render(next);
      $("#setup").open = false;
    });
  });
  if (!host) intervals.push(setInterval(refresh, 650));
  intervals.push(
    setInterval(() => {
      if (!view) return;
      const now = view.serverNow + performance.now() - received;
      const end =
        view.stage === "presence"
          ? view.players[seat]?.readyUntil
          : view.stage === "countdown"
            ? view.missionStartAt
            : view.stage === "programming"
              ? view.missionStartAt + view.mission.phaseEndsMs.at(-1)
              : now;
      $("#clock").textContent = view.tutorial
        ? t("Libre", "Untimed")
        : view.stage === "presence" && !view.players[seat]?.ready
          ? t("En attente", "Waiting")
          : duration((end ?? now) - now);
      $("#clock-caption").textContent = view.tutorial
        ? ""
        : view.stage === "programming"
          ? t("avant le saut", "until jump")
          : view.stage === "presence"
            ? view.players[seat]?.ready
              ? t("prêt encore", "ready for")
              : ""
            : "";
    }, 100),
  );
  function fillMissions(missions) {
    $("#mission").innerHTML = missions
      .map(
        (m) =>
          `<option value="${m.id}" ${m.id === "realmission1" ? "selected" : ""}>${esc(m.title)}</option>`,
      )
      .join("");
  }
  setupSpecialists();
  if (host) {
    root.classList.add("bgs-hosted");
    fillMissions(host.missions);
    $("#connection").textContent = "BGS";
    $(".brand").removeAttribute("href");
  } else {
    void (async () => {
      lessons = await fetch("/api/lessons").then((r) => r.json());
      fillMissions(await fetch("/api/missions").then((r) => r.json()));
      await refresh();
    })();
  }
  return {
    render(next) {
      if (host && next.bgs?.settings) {
        $("#mission").value = next.bgs.settings.mission ?? next.mission.id;
        $("#difficulty").value = next.bgs.settings.difficulty ?? "1,2";
        $("#serious-difficulty").value =
          next.bgs.settings.seriousDifficulty ??
          next.bgs.settings.difficulty ??
          "1,2";
      }
      render(next);
      if (host) $("#connection").textContent = "BGS";
    },
    setPlayer(index) {
      seat = index ?? -1;
      crew = Math.max(0, seat);
      selected = [];
      rerender();
    },
    setPreferences(prefs) {
      if (prefs.locale) locale = prefs.locale;
      if (prefs.sound !== undefined) sound = !!prefs.sound;
      rerender();
    },
    destroy() {
      for (const id of intervals) clearInterval(id);
      for (const [type, fn] of rootListeners)
        root.removeEventListener(type, fn);
      if (sound && "speechSynthesis" in window) speechSynthesis.cancel();
    },
  };
}
