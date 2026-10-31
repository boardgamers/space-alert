import { plannedRoute } from "./program-route.js";
import { translate, createLocaleSelection, lessonCopy } from "./i18n.js";
import { basicsView } from "./basics.js";
import { duration, practiceClockText } from "./clock.js";
import { mountNavigation } from "./navigation.js";
import {
  pictogram,
  shipLocator,
  equipmentPicture,
  specializationIcons,
} from "./icons.js";
import { createTacticalView } from "./tactical.js";
import { forecastMovement, checkpointAppearance } from "./threat-track.js";
import { illustration } from "./art.js";
import {
  specialDescription,
  traitDescriptions,
  effectDescription,
  eventDescription,
  zoneLabel,
  stationLabel,
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
  let locale = host?.locale ?? root.lang ?? "en",
    seat = Number(new URL(location.href).searchParams.get("seat") ?? 0),
    view,
    pending = false,
    received = 0,
    key = "",
    selected = [],
    placements = [],
    handFilter = "all",
    lessons = [],
    careerKey = "",
    crew = seat,
    replayFrame = null,
    sound = false,
    combine = false,
    lastSpoken = 0,
    basicsStarted = false,
    basicsPicked = false,
    basicsMarkup;
  let route = [],
    previewTurn = null;
  const t = (key, params) => translate(locale, key, params);
  const actionWords = (text) =>
    text.replace(
      /\b[ABC]\b/g,
      (key) =>
        ({
          A: t("app.weapons"),
          B: t("app.energy"),
          C: t("app.systems"),
        })[key],
    );
  const navigation = mountNavigation(root, {
    locale: () => locale,
    hosted: !!host,
  });
  if (host && !host.tutorial) {
    const header = $("header");
    header.classList.add("compact-console-header");
    header.insertBefore(
      $("#console-nav"),
      header.querySelector(".header-tools"),
    );
  }
  let appearance = {};
  const language = createLocaleSelection((next) => {
    locale = next;
    rerender();
  });
  const playerColor = (i) => {
    const color = appearance.playerColors?.[i];
    return typeof color === "string" && /^#[a-f0-9]{6}$/i.test(color)
      ? color
      : "";
  };
  const playerBadge = (i) => {
    const badge = appearance.players?.[i]?.pro && appearance.supporterBadge;
    return badge
      ? `<img class="supporter-badge" src="${esc(badge.url)}" alt="${esc(badge.label)}" title="${esc(badge.label)}" width="14" height="14">`
      : "";
  };
  const playerName = (i) =>
    esc(view?.players[i]?.name ?? `${t("app.player")} ${i + 1}`);
  const zoneName = (z) => zoneLabel(z, locale);
  const names = {
    rocketeer: "app.rocketeer",
    "data-analyst": "app.data_analyst",
    "energy-technician": "app.energy_technician",
    "pulse-gunner": "app.pulse_gunner",
    medic: "app.medic",
    teleporter: "app.teleporter",
    hypernavigator: "app.hypernavigator",
    "special-ops": "app.special_ops",
    "squad-leader": "app.squad_leader",
    mechanic: "app.mechanic",
  };
  const specialName = (n) => (names[n] ? t(names[n]) : n);
  const label = (a) =>
    ({
      A: t("app.weapons_fire_or_repair"),
      B: t("app.energy_transfer_or_repair"),
      C: t("app.systems_operate_or_repair"),
      bots: t("app.battlebot_attack"),
      red: t("app.move_left"),
      blue: t("app.move_right"),
      lift: t("app.change_deck"),
    })[a] ??
    (a.startsWith("special:")
      ? `${specialName(a.split(":")[1])} · ${a.endsWith("advanced") ? t("app.advanced") : t("app.basic")}`
      : a.startsWith("teleport:")
        ? t("app.heroic_move") + stationLabel(a.slice(9), locale)
        : a.startsWith("hero:")
          ? t("app.heroic") + label(a.slice(5))
          : a);
  function icon(a) {
    if (a === "bots")
      return `<span class="card-art">${illustration("battlebots")}</span>`;
    if (a.startsWith("special:"))
      return `<span class="special-action">${pictogram(specializationIcons[a.split(":")[1]])}<small>${a.endsWith("advanced") ? "Ⅱ" : "Ⅰ"}</small></span>`;
    if (a.startsWith("hero:"))
      return `<span class="hero-action">${pictogram("star")}${icon(a.slice(5))}</span>`;
    if (a.startsWith("teleport:"))
      return `<span class="teleport-action" style="--zone:var(--${esc(a.slice(9).split("-")[0])})">${pictogram("teleport")}${shipLocator([a.slice(9)])}</span>`;
    const actionIcon = {
      A: "A",
      B: "B",
      C: "C",
      bots: "bots",
      red: "left",
      blue: "right",
      lift: "lift",
    }[a];
    return actionIcon ? pictogram(actionIcon) : esc(a);
  }
  const symbol = (name, description, content = "") =>
    `<span class="symbol-stat" role="img" title="${esc(description)}" aria-label="${esc(description)}">${pictogram(name)}${content}</span>`;
  const { shipCutaway, threatPortrait } = createTacticalView({
    t,
    esc,
    symbol,
    zoneName,
    playerColor,
  });
  function updateSound() {
    const button = $("#sound");
    const description = sound
      ? t("app.mute_voice_announcements")
      : t("app.enable_voice_announcements");
    button.title = description;
    button.setAttribute("aria-label", description);
    button.setAttribute("aria-pressed", String(sound));
    button.innerHTML = pictogram(sound ? "speaker" : "muted");
  }
  function announcement(e) {
    if (e.type === "threat")
      return `T+${e.turn} · ${e.severity === "serious" ? t("app.serious_threat") : t("app.threat")} · ${e.position === "internal" ? t("app.internal") : zoneName(e.zone)}`;
    return (
      {
        "phase-start": t("app.phase_begins", { phase: e.phase }),
        "phase-warning": t("app.phase_ends_in_seconds", {
          phase: e.phase,
          seconds: e.seconds,
        }),
        "incoming-data": t("app.incoming_data_draw_a_card"),
        "data-transfer": t("app.data_transfer_opens"),
        "data-transfer-end": t("app.data_transfer_complete"),
        "communications-down": t("app.communications_down_silence"),
        "communications-restored": t("app.communications_restored"),
      }[e.type] ?? e.type
    );
  }
  function button(command, text, disabled = false, extra = "") {
    const name = {
      ready: "check",
      unready: "close",
      "advance-phase": "step",
      "finish-planning": "lock",
      draw: "cards",
      "draw-android": "android",
      resolve: "step",
      "resolve-all": "forward",
    }[command];
    return `<button data-command="${command}" ${disabled ? "disabled" : ""} ${extra}>${name ? pictogram(name) : ""}<span>${text}</span></button>`;
  }
  function phaseFor(turn) {
    return turn <= 3 ? 1 : turn <= 7 ? 2 : 3;
  }
  function localizeSetup() {
    updateSound();
    $("#seat").setAttribute("aria-label", t("app.viewpoint"));
    $("#program-crew").setAttribute("aria-label", t("app.crew_to_program"));
    const fields = {
      players: "app.players",
      "crew-size": "app.crew",
      mission: "app.mission",
      specialization: "lesson.specializations.title",
      "threat-expansion": "app.threats",
      difficulty: "app.common_threats",
      "serious-difficulty": "app.serious_threats",
      "campaign-limit": "app.format",
      "careers-enabled": "app.experience",
      "explorer-name": "app.name",
      "explorer-cloning": "app.cloning",
    };
    for (const [id, words] of Object.entries(fields))
      $("#" + id).parentElement.firstChild.textContent = t(words) + " ";
    const options = {
      players: [
        "app.solo_4_androids",
        "app.2_2_androids",
        "app.3_1_android",
        "app.4",
        "app.5",
      ],
      "crew-size": [
        "app.standard",
        "app.5_crew_extra_android",
        "app.3_players_without_android",
      ],
      specialization: ["app.none", "app.level_1", "app.level_2", "app.level_3"],
      "threat-expansion": ["app.base_game", "app.the_new_frontier"],
      "campaign-limit": [
        "app.single_mission",
        "app.campaign_3_missions",
        "app.campaign_5_missions",
      ],
      "careers-enabled": ["app.free_play", "app.saved_careers"],
      "explorer-cloning": ["app.allowed", "app.hardcore_permanent_death"],
    };
    options.difficulty = options["serious-difficulty"] = [
      "app.level_1",
      "app.levels_1_2",
      "app.level_2",
      "app.all_levels",
      "app.levels_2_3",
      "app.level_3",
    ];
    for (const [id, values] of Object.entries(options))
      [...$("#" + id).options].forEach(
        (o, i) => (o.textContent = t(values[i])),
      );
    for (const [id, words] of Object.entries({
      "new-button": "app.prepare_mission",
      "ready-all": "app.ready_all_crew",
      "next-event": "app.next_announcement",
      "create-explorer-button": "app.create_explorer",
    }))
      $("#" + id).textContent = t(words);
  }
  function showPlannedPosition(turn) {
    previewTurn = turn;
    for (const node of root.querySelectorAll(".planned-pawn")) node.remove();
    for (const node of root.querySelectorAll(".planned-room, .previewed-turn"))
      node.classList.remove("planned-room", "previewed-turn");
    if (view?.stage !== "programming" || !turn || !route[turn - 1]) return;
    const room = $("#ship").querySelector(
      `[data-station="${route[turn - 1]}"]`,
    );
    const slot = $("#program").querySelector(`[data-turn="${turn}"]`);
    if (!room || !slot) return;
    room.classList.add("planned-room");
    slot.classList.add("previewed-turn");
    const description = t("route.planned", {
      turn,
      room: stationLabel(route[turn - 1], locale),
    });
    room.insertAdjacentHTML(
      "beforeend",
      `<span class="planned-pawn" role="img" aria-label="${esc(description)}" title="${esc(description)}">${view.game.solo || crew >= view.players.length ? equipmentPicture("android") : pictogram("crew")}<b>${crew + 1}</b><small>T+${turn}</small></span>`,
    );
  }
  for (const type of ["pointerover", "focusin"])
    listenRoot(type, (event) => {
      const slot = event.target.closest?.("#program [data-turn]");
      if (slot) showPlannedPosition(Number(slot.dataset.turn));
    });
  for (const type of ["pointerout", "focusout"])
    listenRoot(type, (event) => {
      const slot = event.target.closest?.("#program [data-turn]");
      if (!slot || slot.contains(event.relatedTarget)) return;
      const next = event.relatedTarget?.closest?.("#program [data-turn]");
      showPlannedPosition(next ? Number(next.dataset.turn) : null);
    });
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
    const basic = !!view.tutorial?.basics;
    const phaseLesson = !!view.tutorial?.phaseLesson;
    const simpleShip = basic || phaseLesson;
    const firstShot = host?.tutorial && view.tutorial?.id === "first-shot";
    const teachingActions = simpleShip
      ? ["red", "blue", "lift"]
      : firstShot
        ? ["A"]
        : null;
    root.classList.toggle("learning-basics", simpleShip);
    $("#basics-guide").hidden = !basic;
    if (basic) {
      const markup = basicsView(view, locale, {
        started: basicsStarted || view.tutorial.nativeStep > 0,
        picked: basicsPicked,
        shipMarkup: shipCutaway({
          ship: { ...view.game.ship, crew: [view.game.ship.crew[0]] },
          selectedCrew: 0,
          canPlan: false,
          isAndroid: () => true,
          crewLabel: () => t("app.android_1"),
        }),
      });
      if (markup !== basicsMarkup) {
        $("#basics-guide").innerHTML = markup;
        basicsMarkup = markup;
      }
    }
    const g = view.game,
      own = view.players[seat] ?? {
        ready: true,
        finishedPlanning: true,
        planningPhase: 0,
      },
      resolution = g?.resolution,
      frame = replayFrame !== null ? resolution?.frames[replayFrame] : null,
      ship = frame?.ship ?? g?.ship,
      activeTurn = frame?.turn ?? resolution?.turn ?? 0;
    $("#seat").innerHTML = view.players
      .map(
        (p) =>
          `<option value="${p.seat}" ${p.seat === seat ? "selected" : ""}>${playerName(p.seat)}</option>`,
      )
      .join("");
    $("#status").textContent = {
      presence: t("app.crew_report_in"),
      countdown: t("app.stand_by_for_launch"),
      programming: view.tutorial
        ? lessonCopy(view.tutorial.id, locale).title
        : view.mission.title,
      resolution: resolution?.outcome
        ? resolution.outcome.survived
          ? t("app.back_to_base")
          : t("app.ship_lost")
        : t("app.mission_resolution"),
      cancelled: t("app.launch_cancelled"),
    }[view.stage];
    $("#crew").innerHTML = view.players
      .map(
        (p) =>
          `<span style="${playerColor(p.seat) ? `--player-color:${playerColor(p.seat)}` : ""}" class="crew-member ${p.ready ? "ready" : ""} ${p.seat === seat ? "own" : ""}">${playerName(p.seat)}${playerBadge(p.seat)} · ${p.planningPhase ? `${p.finishedPlanning ? "🔒" : t("app.phase")} ${p.planningPhase}` : p.ready ? t("app.ready") : t("app.waiting")}</span>`,
      )
      .join("");
    $("#ship-title").textContent = t("app.the_ship");
    $("#threat-title").textContent = t("app.detected_threats");
    $("#program-title").textContent = t("app.flight_program");
    $("#lesson-list").innerHTML = lessons
      .map(
        (l) =>
          `<button data-lesson="${l.id}">${esc(lessonCopy(l.id, locale).title)}</button>`,
      )
      .join(" ");
    $("#lesson-guide").hidden = !view.tutorial;
    $("#lesson-guide").innerHTML =
      view.tutorial && !basic
        ? `<ol>${lessonCopy(view.tutorial.id, locale)
            .instructions.map((p) => `<li>${esc(actionWords(p))}</li>`)
            .join(
              "",
            )}</ol><div class="lesson-actions">${view.stage === "programming" ? `<button id="lesson-clock" class="icon-label">${pictogram(view.tutorial.clockRunning ? "pause" : "clock")}<span>${view.tutorial.clockRunning ? t("app.pause_clock") : t("app.start_practice_clock")}</span></button><button id="lesson-next" class="icon-label">${pictogram(view.phase === 1 ? "step" : "lock")}<span>${view.phase === 1 ? t("app.phase_2") : t("app.finish_programming")}</span></button>` : ""} <button data-lesson="${view.tutorial.id}" class="quiet icon-button" title="${t("app.restart")}" aria-label="${t("app.restart")}">${pictogram("restart")}</button></div>`
        : "";
    $("#comms").innerHTML = symbol(
      view.communicationsAvailable ? "comms" : "muted",
      view.communicationsAvailable
        ? t("app.communications_online")
        : t("app.communications_down_stay_silent"),
      view.communicationsAvailable ? "" : `<span>${t("app.silence")}</span>`,
    );
    $("#comms").classList.toggle("offline", !view.communicationsAvailable);
    $("#phase").textContent = view.phase
      ? `${t("app.phase_ed3301")} ${view.phase}`
      : "";
    if (ship) {
      $("#ship").innerHTML = shipCutaway({
        ship: simpleShip ? { ...ship, crew: [ship.crew[0]] } : ship,
        selectedCrew: crew,
        canPlan:
          !simpleShip &&
          (!host?.tutorial || view.tutorial.nativeStep === 1) &&
          view.stage === "programming" &&
          seat >= 0 &&
          (g?.solo || crew === seat || crew >= view.players.length) &&
          !own.finishedPlanning,
        isAndroid: (id) => g.solo || id >= view.players.length,
        crewLabel: (id) =>
          view.players[id]?.name ?? `${t("app.android")} ${id + 1}`,
      });
      if (simpleShip && view.tutorial.targetStation) {
        const goal = $("#ship").querySelector(
          `[data-station="${view.tutorial.targetStation}"]`,
        );
        if (goal) {
          const reached =
            view.stage === "resolution" &&
            ship.crew[0].station === view.tutorial.targetStation;
          goal.classList.add("tutorial-destination");
          goal.classList.toggle("destination-reached", reached);
          goal.insertAdjacentHTML(
            "beforeend",
            `<span class="destination-marker" role="img" aria-label="${t("app.destination")}" title="${t("app.destination")}">${pictogram(reached ? "check" : "destination")}</span>`,
          );
        }
      }
      $("#resources").innerHTML =
        `${symbol("fuel", `${t("app.fuel")} : ${ship.fuel}`, `<b>${ship.fuel}</b>`)}${symbol("rocket", `${t("app.rockets")} : ${ship.rockets}`, `<b>${ship.rockets}</b>`)}${symbol("computer", t("app.computer") + " · " + ship.computer.map((x, i) => `${t("app.phase")} ${i + 1} : ${x ? t("app.maintained") : t("app.not_maintained")}`).join(" · "), ship.computer.map((x, i) => `<span class="computer-phase ${x ? "maintained" : ""}">${i + 1}</span>`).join(""))}${symbol("bots", `${t("app.battlebots_available_squads")} : ${ship.bots.filter((b) => b.owner === null && b.station && !b.disabled).length}`, `<b>${ship.bots.filter((b) => b.owner === null && b.station && !b.disabled).length}</b><small>${t("app.squads")}</small>`)}${ship.crew
          .filter((p) => p.space)
          .map((p) =>
            symbol(
              "interceptor",
              `${t("app.crew_49685c")} ${p.id + 1} · ${t("app.range")} ${p.space}${p.knockedOut ? " · " + t("app.knocked_out") : ""}`,
              `<b>${p.id + 1}</b> · ${p.space}${p.knockedOut ? " †" : ""}`,
            ),
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
            `<article class="threat illustrated-threat" style="--zone:var(--${th.zone ?? "gold"})"><button class="threat-card" data-inspect="${th.instance}" data-inspect-title="${esc(th.name)} · T+${th.turn}" aria-haspopup="dialog" aria-label="${esc(th.name)} · ${t("app.turn")} ${th.turn} · ${esc(th.position === "internal" ? th.stations.map((s) => stationLabel(s, locale)).join(", ") : zoneName(th.zone))} · ${t("app.details")}"><span class="threat-heading"><strong>${esc(th.name)}</strong><span class="threat-timing" title="${t("app.arrival_on_turn")} ${th.turn}">${t("app.arrival")} T+${th.turn}</span></span>${threatPortrait(th)}<span class="threat-footer">${symbol("speed", `${th.speed} ${t("app.spaces_per_turn")}`, th.speed)}<span>${t("app.details")}</span></span></button>${(th.track ?? g.tracks[th.zone ?? "internal"]) ? trackHtml(th, g) : ""}<template>${threatPortrait(th)}<div class="threat-facts">${symbol("speed", `${th.speed} ${t("app.spaces_per_turn")}`, th.speed)}</div><p>${th.position === "internal" ? esc(th.stations.map((s) => stationLabel(s, locale)).join(", ")) + " · " + esc(label(th.repair)) : esc(zoneName(th.zone))}</p>${traitDescriptions(
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
              )}${calledHtml(th.calledCard)}${(th.track ?? g.tracks[th.zone ?? "internal"]) ? trackHtml(th, g) : ""}</template></article>`,
        )
        .join("") ||
      `<p class="empty">${t("app.awaiting_the_first_detections")}</p>`;
    const announcements = view.log.filter((x) => x.type === "announcement");
    $("#latest").textContent =
      view.stage === "resolution"
        ? t("app.programming_complete_resolving_actions")
        : view.stage === "cancelled"
          ? t("app.launch_cancelled_not_everyone_confirmed_within_two_minutes")
          : announcements.length
            ? announcement(announcements.at(-1).event)
            : t("app.everyone_confirms_their_presence_before_launch");
    if (sound)
      for (const item of announcements.filter((x) => x.id > lastSpoken)) {
        if (item === announcements.at(-1)) speak(announcement(item.event));
      }
    lastSpoken = announcements.at(-1)?.id ?? 0;
    $("#program-crew").innerHTML = Array.from(
      { length: view.crewSize },
      (_, i) =>
        `<option value="${i}" data-kind="${g?.solo || i >= view.players.length ? "android" : "crew"}" data-short-label="${g?.solo || i >= view.players.length ? i + 1 : playerName(i)}" data-specialization="${g?.specializations[i]?.name ?? ""}" ${crew === i ? "selected" : ""}>${g?.solo || i >= view.players.length ? `${t("app.android")} ${i + 1}` : playerName(i)}${g?.specializations[i] ? " · " + esc(specialName(g.specializations[i].name)) : ""}</option>`,
    ).join("");
    const planning = view.stage === "programming",
      canOwn =
        seat >= 0 && (g?.solo || crew === seat || crew >= view.players.length),
      ownPhase =
        g?.solo || crew >= view.players.length ? view.phase : own.planningPhase;
    route = planning
      ? plannedRoute(g?.programs[crew] ?? [], g?.ship.crew[crew]?.station)
      : [];
    $("#program").innerHTML = (g?.programs[crew] ?? [])
      .slice(
        0,
        basic || firstShot ? 3 : view.mission.phaseEndsMs.length === 2 ? 7 : 12,
      )
      .map((slot) => {
        const editable =
          (!phaseLesson || slot.turn === 1 || slot.turn === 4) &&
          (!basic ||
            slot.turn < (view.tutorial.scenario === "deadline" ? 2 : 3)) &&
          (!view.tutorial?.timing ||
            view.tutorial.scenario === "deadline" ||
            view.tutorial.clockStarted) &&
          (!firstShot || slot.turn === 2 || slot.turn === 3) &&
          (!host?.tutorial || view.tutorial.nativeStep === 1) &&
          planning &&
          canOwn &&
          !own.finishedPlanning &&
          phaseFor(slot.turn) === ownPhase;
        const destination = route[slot.turn - 1];
        const routeDescription = destination
          ? `${t("route.planned", { turn: slot.turn, room: stationLabel(destination, locale) })}. ${t("route.assumption")}`
          : "";
        const description = `T+${slot.turn} · ${slot.cards.map((c) => (c.sides ? c.sides[c.side].map(label).join(" → ") : c.category === "movement" ? t("app.movement") : t("app.action"))).join(" + ") || t("app.empty")}`;
        return `<button class="slot ${slot.cards.length ? "filled" : "empty"} ${slot.turn === activeTurn ? "current" : ""} ${phaseFor(slot.turn) < ownPhase ? "locked" : ""} ${phaseFor(slot.turn) > ownPhase ? "future" : ""}" data-turn="${slot.turn}" ${slot.turn === activeTurn ? 'aria-current="step"' : ""} ${editable ? "" : "disabled"} title="${esc(description + (routeDescription ? " · " + routeDescription : ""))}" aria-label="${esc(description + (routeDescription ? " · " + routeDescription : ""))}">${firstShot && slot.turn === 2 ? `<span class="slot-arrival" title="${t("app.target_arrives_before_this_shot")}">${pictogram("down")}${t("app.arrival")}</span>` : ""}<span class="turn">T+${slot.turn} ${phaseFor(slot.turn) < ownPhase ? pictogram("lock") : ""}</span><span class="action">${slot.cards.map((c) => (c.sides ? c.sides[c.side].map(icon).join(" ") : pictogram(c.category === "movement" ? "move" : "cards"))).join(" + ") || pictogram("wait")}</span>${slot.cards.length && destination ? `<span class="planned-location" aria-hidden="true">${shipLocator([destination])}</span>` : ""}</button>`;
      })
      .join("");
    showPlannedPosition(previewTurn);
    $("#program").setAttribute(
      "aria-keyshortcuts",
      "ArrowLeft ArrowRight ArrowUp ArrowDown Backspace",
    );
    $("#player-help").textContent = planning
      ? selected.length
        ? t("app.choose_a_turn_for_this_card")
        : t("app.click_a_card_to_fill_the_next_turn")
      : view.stage === "presence"
        ? t("app.ready_lasts_two_minutes_we_wait_until_everyone")
        : view.stage === "resolution"
          ? t("app.programs_are_locked_advance_resolution_or_review_its")
          : "";
    $("#controls").innerHTML = ["presence", "countdown"].includes(view.stage)
      ? button(
          own.ready ? "unready" : "ready",
          own.ready
            ? t("app.not_ready_yet")
            : !own.present
              ? t("app.connecting")
              : t("app.i_m_ready"),
          !view.players[seat] || !own.present,
          'class="primary"',
        )
      : planning
        ? `${g?.solo ? "" : button("advance-phase", t("app.next_phase"), own.finishedPlanning || own.planningPhase >= view.mission.phaseEndsMs.length)}${button("finish-planning", t("app.lock_my_program"), own.finishedPlanning || view.phase < view.mission.phaseEndsMs.length)}${g.dataCredits ? button("draw", `${t("app.draw")} +${g.dataCredits}`) : ""}${g.androidDataCredits ? button("draw-android", t("app.android_card") + ` +${g.androidDataCredits}`, !g.canDrawAndroid) : ""}`
        : view.stage === "resolution"
          ? `<button data-command="resolve" class="primary icon-button" title="${t("app.next_resolution_step")}" aria-label="${t("app.next_resolution_step")}" ${seat !== 0 || !!resolution?.outcome ? "disabled" : ""}>${pictogram("step")}</button><button data-command="resolve-all" class="quiet icon-button" title="${t("app.resolve_mission")}" aria-label="${t("app.resolve_mission")}" ${seat !== 0 || !!resolution?.outcome ? "disabled" : ""}>${pictogram("right")}${pictogram("right")}</button>`
          : view.stage === "cancelled"
            ? '<button id="open-setup">' + t("app.new_session") + "</button>"
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
    if (preparing)
      $("#ready-help").textContent =
        view.mission.title + " · " + $("#ready-help").textContent;
    $("#crew").hidden = view.players.length === 1 && !preparing;
    const hand = [
      ...(g?.hand ?? []),
      ...(g?.androidCards ?? []).filter((c) => c.owner === crew),
    ];
    const grouped = [];
    for (const card of hand) {
      if (
        teachingActions &&
        !card.sides.some(
          (side) => side.length === 1 && teachingActions.includes(side[0]),
        )
      )
        continue;
      const same = grouped.find(
        (c) =>
          c.kind === "normal" &&
          card.kind === "normal" &&
          JSON.stringify(
            teachingActions
              ? c.sides.filter(
                  (side) =>
                    side.length === 1 && teachingActions.includes(side[0]),
                )
              : c.sides,
          ) ===
            JSON.stringify(
              teachingActions
                ? card.sides.filter(
                    (side) =>
                      side.length === 1 && teachingActions.includes(side[0]),
                  )
                : card.sides,
            ),
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
        ? `<button id="combine" class="quiet icon-button" title="${t("app.combine_two_cards")}" aria-label="${t("app.combine_two_cards")}" aria-pressed="${combine}">${pictogram("combine")}</button>`
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
                `<div class="card ${c.kind}">${c.count > 1 ? `<span class="copies">×${c.count}</span>` : ""}${c.sides.map((side, index) => (teachingActions && !(side.length === 1 && teachingActions.includes(side[0])) ? "" : `<button ${view.tutorial?.timing && !view.tutorial.clockStarted && view.tutorial.scenario !== "deadline" ? "disabled" : ""} data-card="${esc(c.id)}" data-side="${index}" class="${selected.some((s) => s.id === c.id && s.side === index) ? "selected" : ""}" aria-pressed="${selected.some((s) => s.id === c.id && s.side === index)}" title="${esc(side.map(label).join(" → "))}" aria-label="${esc(side.map(label).join(" → "))}">${side.map(icon).join(" · ")}</button>`)).join("")}</div>`,
            )
            .join("")
        : "";
    $("#hand-filter").innerHTML =
      planning && canOwn && (grouped.length > 12 || handFilter !== "all")
        ? ["all", "A", "B", "C", "bots", "move"]
            .map(
              (f) =>
                `<button data-filter="${f}" class="quiet icon-button" aria-pressed="${handFilter === f}" title="${esc(f === "all" ? t("app.all_cards") : f === "move" ? t("app.movement_d9fd7b") : label(f))}" aria-label="${esc(f === "all" ? t("app.all_cards") : f === "move" ? t("app.movement_d9fd7b") : label(f))}">${f === "all" ? pictogram("cards") : f === "bots" ? pictogram("bots") : f === "move" ? pictogram("move") : pictogram(f)}</button>`,
            )
            .join("")
        : "";
    const teleporter = g.specializations[crew]?.name === "teleporter";
    $("#teleport").innerHTML =
      planning && canOwn && teleporter
        ? `<div class="token-controls"><label>${t("app.teleport")}<select id="teleport-from">${Array.from({ length: view.crewSize }, (_, id) => `<option value="${id}" ${g.teleportTokens[crew][0] === id ? "selected" : ""}>${t("app.crew_49685c")} ${id + 1}</option>`).join("")}</select></label><label>${t("app.to")}<select id="teleport-to">${Array.from({ length: view.crewSize }, (_, id) => `<option value="${id}" ${g.teleportTokens[crew][1] === id ? "selected" : ""}>${t("app.crew_49685c")} ${id + 1}</option>`).join("")}</select></label><button id="place-tokens" ${g.solo || view.transferClosesAt ? "" : "disabled"}>${t("app.set_tokens")}</button></div><small>${t("app.move_tokens_during_data_transfer_their_final_positions")}</small>`
        : "";
    $("#transfer").innerHTML =
      planning && view.transferClosesAt && !g.transferUsed
        ? view.players
            .filter((p) => p.seat !== seat)
            .map(
              (p) =>
                `<button data-transfer="${p.seat}" ${selected.length === 1 ? "" : "disabled"}>${t("app.send_to")} ${p.seat + 1}</button>`,
            )
            .join("")
        : "";
    $("#replay").innerHTML = resolution
      ? `<p>${resolution.outcome ? `${resolution.outcome.survived ? "✓" : "✕"} ${t("app.score")} : <b>${resolution.outcome.score}</b> · ${resolution.outcome.threatPoints} ${t("app.threats_87b951")} + ${resolution.outcome.visual} ${t("app.visual")} − ${resolution.outcome.penalties} ${t("app.penalties")}` : `T+${resolution.turn} · ${esc({ appear: t("app.appearances"), crew: t("app.crew_actions"), damage: t("app.damage"), threats: t("app.threat_actions"), computer: t("app.computer") }[resolution.step])}`}</p><label>${t("app.review_a_step")} <input id="replay-slider" type="range" min="0" max="${resolution.frames.length - 1}" value="${replayFrame ?? resolution.frames.length - 1}"></label>${replayFrame !== null ? '<button id="live" class="quiet">' + t("app.back_to_live") + "</button>" : ""}`
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
    $("#ready-all").hidden = $("#ready-all").disabled;
    $("#next-event").hidden = $("#next-event").disabled;
    $("#help").innerHTML =
      `<div class="pictogram-legend">${[
        ["laser", t("app.laser")],
        ["pulse", t("app.pulse")],
        ["shield", t("app.shield")],
        ["reactor", t("app.reactor")],
        ["fuel", t("app.fuel")],
        ["computer", t("app.computer")],
        ["bots", t("app.battlebots")],
        ["android", t("app.android")],
        ["interceptor", t("app.interceptors")],
        ["observation", t("app.visual_confirmation")],
        ["rocket", t("app.rocket")],
        ["hull", t("app.hit_points")],
      ]
        .map(([name, text]) => `<span>${pictogram(name)}${esc(text)}</span>`)
        .join("")}</div>` +
      `<p>${t("app.left_center_and_right_correspond_to_red_white")}</p>` +
      t("app.plan_choose_a_card_then_a_turn_click");
    navigation.sync();
  }
  function calledHtml(data) {
    if (!data) return "";
    const c = data.card;
    return `<div class="called-threat"><h4>${t("app.reinforcement")} · ${esc(c.name)}</h4><p>${c.hp} ♥ · ${c.shield} ⛨ · ${t("app.speed")} ${c.speed}${c.stations ? " · " + esc(c.stations.map((s) => stationLabel(s, locale)).join(", ")) + " · " + esc(label(c.repair)) : ""}</p>${traitDescriptions(
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
    const pending = ["pending", "announced", "waiting"].includes(th.status);
    const context =
      (replayFrame !== null
        ? g.resolution?.frames[replayFrame]
        : g.resolution) ?? {};
    const groups = forecastMovement(th, track, {
      ...context,
      threats:
        context.threats ?? g.threats.map((item) => ({ ...item, ...item.card })),
    });
    const projection = t(
      "app.forecast_without_crew_intervention_includes_the_threat_s",
    );
    return `<div class="approach-track"><div class="track-distance" style="--track-length:${track.length}"><div class="track" aria-label="${t("app.approach_track")}">${Array.from(
      { length: track.length },
      (_, i) => track.length - i,
    )
      .map((n) => {
        const mark = track.marks.find(([position]) => position === n)?.[1];
        const effects = th.effects?.[mark] ?? [];
        const appearance = checkpointAppearance(th, effects);
        const groupIndex = groups.findIndex((group) =>
          group.positions.includes(n),
        );
        const group = groups[groupIndex];
        const description = `${mark ? effects.map((effect) => effectDescription(effect, locale)).join(" · ") || t("app.no_effect") : t("app.space") + " " + n}${group ? ` · T+${group.turn} · ${projection}` : ""}`;
        const current = !pending && th.positionOnTrack === n;
        return `<span title="${esc(description)}" aria-label="${esc(description)}" ${current ? 'aria-current="step"' : ""} ${group ? `data-forecast-turn="${group.turn}"` : ""} class="${current ? "current" : ""} ${pending && n === track.length ? "entry" : ""} ${appearance ? "mark effect-mark" : ""} ${group ? `forecast-cell forecast-tone-${groupIndex % 2} ${n === group.positions[0] ? "forecast-start" : ""} ${n === group.positions.at(-1) ? "forecast-end" : ""}` : ""}">${appearance ? `${pictogram(appearance.icon)}<b>${esc(appearance.value)}</b>` : current ? "●" : ""}</span>`;
      })
      .join(
        "",
      )}</div>${groups.length ? `<div class="track-turns" aria-label="${esc(projection)}"><small title="${esc(projection)}">T+</small>${groups.map((group, i) => `<span class="forecast-tone-${i % 2}" style="grid-column:${track.length - group.positions[0] + 1} / span ${group.positions.length}" title="${esc(`T+${group.turn} · ${group.positions.length} ${t("app.spaces")} · ${projection}`)}" aria-label="${esc(`T+${group.turn} · ${projection}`)}">${group.turn}</span>`).join("")}</div>` : ""}</div>${pictogram("ship")}</div>`;
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
            `<label>${t("app.player")} ${id + 1}<select id="career-seat-${id}" data-career-seat="${id}"><option value="">${t("app.choose_explorer")}</option>${(
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
            return `<label>${t("app.crew_49685c")} ${id + 1}<select id="specialist-${id}">${careers ? `<option value="">${t("app.no_specialization")}</option>` : ""}${choices.map((s) => `<option value="${s.name}" data-level="${s.level}" ${selected === s.name ? "selected" : ""}>${esc(specialName(s.name))} ${careers ? s.level : ""}</option>`).join("")}</select></label>`;
          }).join("")
        : "";
    navigation.syncChoices();
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
      if (host.tutorialPost) return host.tutorialPost(path, body);
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
    let content = `<h3>${t("app.campaign")} · ${c.missions.length}/${c.limit}</h3>`;
    if (c.stage === "decision")
      content += `<p>${t("app.continuing_requires_everyone_s_agreement_returning_ends_the")}</p><button id="campaign-continue" ${c.votes.includes(seat) ? "disabled" : ""}>${t("app.continue")}</button> <button id="campaign-return">${t("app.return_to_base")}</button>`;
    if (c.stage === "repairs") {
      const may =
        view.game.solo ||
        c.repairCursor === seat ||
        c.repairCursor >= view.players.length;
      content += `<p>${t("app.repair_for_crew")} ${c.repairCursor + 1}</p>`;
      for (const [zone, tiles] of Object.entries(c.carried.zones))
        for (const tile of tiles)
          content += `<button data-repair-zone="${zone}" data-repair-tile="${tile}" ${!may || c.repairedZones[zone] >= 2 ? "disabled" : ""}>${esc(zoneName(zone))} · ${esc(tile)}</button> `;
      c.carried.disabledBots.forEach((disabled, bot) => {
        if (disabled)
          content += `<button data-repair-bot="${bot}" ${may ? "" : "disabled"}>♟ ${bot + 1}</button>`;
      });
      content += `<button id="repair-skip" ${may ? "" : "disabled"}>${t("app.skip_repair")}</button>`;
    }
    if (c.stage === "ready" && host)
      content += `<label>${t("app.next_mission")}<select id="campaign-mission">${host.missions
        .filter((m) => /^(realmission|double)/.test(m.id))
        .map(
          (m) =>
            `<option value="${m.id}" ${m.id === view.mission.id ? "selected" : ""}>${esc(m.title)}</option>`,
        )
        .join("")}</select></label>`;
    if (c.stage === "ready")
      content += `<p>${t("app.next_mission_the_one_selected_in_setup")}</p><label>${t("app.if_one_battlebot_squad_remains")}<select id="campaign-bots"><option value="red-lower">${stationLabel("red-lower", locale)}</option><option value="blue-upper">${stationLabel("blue-upper", locale)}</option></select></label><button id="campaign-next" ${seat === 0 ? "" : "disabled"}>${t("app.next_mission_bda8db")}</button>`;
    if (c.outcome)
      content += `<p>${t("app.campaign_score")} : <strong>${c.outcome.score}</strong></p>`;
    $("#campaign").innerHTML = content;
  }
  function renderCareers(next) {
    const k = JSON.stringify([locale, next.explorers]);
    if (k === careerKey) return;
    careerKey = k;
    $("#explorers").innerHTML = (next.explorers ?? [])
      .map((e) => {
        const spent = Object.values(e.specializations).reduce(
            (n, v) => n + v,
            0,
          ),
          unspent = e.level - spent;
        const learn =
          unspent && !e.activeRun && !e.dead && (!host || e.editable)
            ? `<p>${unspent} ${t("app.level_s_to_assign")}</p>${Object.keys(
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
            ? `<p><a target="_blank" rel="noopener" href="https://filemanager.czechgames.com/storage/files/space-alert-the-new-frontier/other-downloads/achievements/space-alert-2-achievements-${locale === "fr" ? "fr" : "en"}.pdf">${t("app.official_achievement_requirements")}</a></p><label><input type="checkbox" data-agrees="${e.id}">${t("app.requirements_checked_crew_agrees_where_required")}</label><select id="claim-${e.id}" aria-label="${t("app.achievement")}" data-claim-choice="${e.id}">${e.eligible.map((a) => `<option value="${a.id}">${esc(a.name)} · +${a.xp}</option>`).join("")}</select><button data-claim="${e.id}">${t("app.record_achievement")}</button>`
            : "";
        return `<article class="explorer-card" data-explorer="${e.id}"><h3>${esc(e.name)} · ${t("app.level")} ${e.level} · ${e.xp} XP ${e.dead ? "†" : e.activeRun ? "· " + t("app.on_mission") : ""}</h3><p>${e.cloning ? t("app.cloning_enabled") : t("app.hardcore")} · ${e.clones} ${t("app.clone_s")}</p><p>${Object.entries(
          e.specializations,
        )
          .map(([n, l]) => `${esc(specialName(n))} ${l}`)
          .join(
            " · ",
          )}</p>${!e.cloning && !e.activeRun && !e.dead && (!host || e.editable) ? `<button data-consent="${e.id}">${t("app.consent_to_cloning")}</button>` : ""}${learn}${claims}${
          host &&
          e.editable &&
          view.stage === "presence" &&
          !view.players[seat]?.ready
            ? e.dead
              ? `<button data-new-explorer="${e.id}">${t("app.new_explorer")}</button>`
              : Object.keys(e.specializations)
                  .map(
                    (n) =>
                      `<button data-equip="${n}">${t("app.choose")} ${esc(specialName(n))}</button>`,
                  )
                  .join(" ")
            : ""
        }<ol>${e.runs
          .slice(-5)
          .map(
            (r) =>
              `<li>${r.survived ? "✓" : "✕"} ${r.score} · +${r.xp} XP</li>`,
          )
          .join("")}</ol></article>`;
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
      const result = await host.command({
        type,
        sequence: view.nextSequence,
        ...extra,
      });
      if (type === "program") host.cue?.("place");
      if (type === "remove") host.cue?.("remove");
      return result;
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
      $("#connection").textContent = "";
    } catch {
      $("#connection").textContent = t("app.reconnecting");
    }
  }
  function rerender() {
    if (view) render(view, true);
  }
  const editableTurns = () =>
    [...root.querySelectorAll("#program [data-turn]:not(:disabled)")]
      .filter((button) => button.getClientRects().length > 0)
      .map((button) => Number(button.dataset.turn));
  async function placeCard(turn, cards) {
    const owner = crew;
    await command("program", {
      crew: owner,
      turn,
      slotVersion: view.game.programs[owner][turn - 1].revision,
      cards,
    });
    placements.push({
      crew: owner,
      turn,
      ids: cards.map((c) => c.id).join(","),
    });
    selected = [];
    previewTurn = turn;
    rerender();
  }
  const handlePlanningKey = (event) => {
    if (
      ![
        "Enter",
        "Backspace",
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
      ].includes(event.key) ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      event.shiftKey
    )
      return;
    if (
      event.target.closest?.(
        "input, textarea, select, [contenteditable]:not([contenteditable=false]), dialog",
      )
    )
      return;
    if (root.querySelector("dialog[open]")) return;
    if (event.key === "Enter") {
      const run = $("#basics-run") ?? $('[data-guide="run"]');
      if (!run || !run.getClientRects().length) return;
      event.preventDefault();
      if (!run.disabled && !pending && !event.repeat) run.click();
      return;
    }
    const editable = editableTurns();
    if (!editable.length) return;
    event.preventDefault();
    if (pending || event.repeat) return;
    if (event.key !== "Backspace") {
      const action = {
        ArrowLeft: "red",
        ArrowRight: "blue",
        ArrowUp: "lift",
        ArrowDown: "lift",
      }[event.key];
      const turn = editable.find(
        (n) => !view.game.programs[crew][n - 1].cards.length,
      );
      const hand = [
        ...(view.game.hand ?? []),
        ...(view.game.androidCards ?? []).filter((c) => c.owner === crew),
      ];
      const card = hand.find((c) =>
        c.sides.some((side) => side.length === 1 && side[0] === action),
      );
      if (turn !== undefined && card) {
        const side = card.sides.findIndex(
          (side) => side.length === 1 && side[0] === action,
        );
        perform(() => placeCard(turn, [{ id: card.id, side }]));
      }
      return;
    }
    const matches = placements.filter(
      (p) =>
        p.crew === crew &&
        editable.includes(p.turn) &&
        view.game.programs[crew][p.turn - 1].cards
          .map((c) => c.id)
          .join(",") === p.ids,
    );
    const turn =
      matches.at(-1)?.turn ??
      editable
        .filter((n) => view.game.programs[crew][n - 1].cards.length)
        .at(-1);
    if (!turn) return;
    event.preventDefault();
    perform(async () => {
      await command("remove", {
        crew,
        turn,
        slotVersion: view.game.programs[crew][turn - 1].revision,
      });
      selected = [];
      rerender();
    });
  };
  root.ownerDocument.addEventListener("keydown", handlePlanningKey);
  listenRoot("click", (e) => {
    const el = e.target.closest("button");
    if (host && ["ready-all", "next-event", "open-setup"].includes(el?.id))
      return;
    if (!el || pending) return;
    if (el.id === "open-setup") {
      navigation.openPanel("setup");
      return;
    }
    if (el.id === "basics-start" || el.dataset.basicsPick) {
      host?.cue?.("select");
      if (el.id === "basics-start") basicsStarted = true;
      else
        basicsPicked =
          basicsPicked === el.dataset.basicsPick
            ? false
            : el.dataset.basicsPick;
      rerender();
      return;
    }
    if (el.dataset.basicsTurn) {
      const turn = Number(el.dataset.basicsTurn);
      if (turn > 2) return;
      perform(async () => {
        if (!basicsPicked) {
          await command("remove", {
            crew: 0,
            turn,
            slotVersion: view.game.programs[0][turn - 1].revision,
          });
          return;
        }
        const action = basicsPicked;
        const card = view.game.hand.find((c) =>
          c.sides.some((s) => s.length === 1 && s[0] === action),
        );
        if (!card) throw Error(t("app.card_unavailable"));
        basicsPicked = false;
        await command("program", {
          crew: 0,
          turn,
          slotVersion: view.game.programs[0][turn - 1].revision,
          cards: [
            {
              id: card.id,
              side: card.sides.findIndex(
                (s) => s.length === 1 && s[0] === action,
              ),
            },
          ],
        });
      });
      return;
    }
    if (el.id === "lesson-deadline" && host?.tutorial) {
      perform(() => localPost("/api/lesson-deadline", {}));
      return;
    }
    if (el.id === "lesson-clock") {
      perform(() =>
        localPost("/api/lesson-clock", {
          running: !view.tutorial.clockRunning,
        }),
      );
      return;
    }
    if (el.id === "basics-plan") {
      if (view.stage === "resolution")
        perform(async () => {
          basicsStarted = true;
          basicsPicked = false;
          await localPost("/api/lesson-back", {});
        });
      return;
    }
    if (el.id === "basics-run" || el.id === "basics-execute") {
      if (view.stage === "resolution") return;
      perform(async () => {
        while (view.stage === "programming")
          await localPost("/api/lesson-next", {});
        host?.cue?.("start");
        rerender();
      });
      return;
    }
    if (el.dataset.lesson) {
      if (host?.tutorial) {
        host.openLesson(el.dataset.lesson);
        return;
      }
      if (!host) {
        location.assign(
          `/learn?chapter=${encodeURIComponent(el.dataset.lesson)}&locale=${locale}`,
        );
        return;
      }
      perform(async () => {
        seat = 0;
        crew = 0;
        selected = [];
        replayFrame = null;
        basicsStarted = false;
        basicsPicked = false;
        await localPost("/api/lesson", { lesson: el.dataset.lesson });
        navigation.closePanel();
        $(
          view.tutorial?.basics ? "#basics-guide" : "#lesson-guide",
        ).scrollIntoView({ block: "start" });
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
    if (el.dataset.pickAction) {
      handFilter = el.dataset.pickAction;
      selected = [];
      navigation.closePanel();
      rerender();
      $("#hand-filter").scrollIntoView({ block: "center" });
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
            t("app.check_the_achievement_requirements_before_recording_it"),
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
      host?.cue?.("select");
      const choice = { id: el.dataset.card, side: Number(el.dataset.side) };
      if (e.shiftKey || combine)
        selected = [
          ...selected.filter((c) => c.id !== choice.id),
          choice,
        ].slice(-2);
      else {
        const turn = editableTurns().find(
          (n) => !view.game.programs[crew][n - 1].cards.length,
        );
        if (turn !== undefined) {
          perform(() => placeCard(turn, [choice]));
          return;
        }
        selected = selected.some(
          (c) => c.id === choice.id && c.side === choice.side,
        )
          ? []
          : [choice];
      }
      rerender();
      return;
    }
    if (el.dataset.turn) {
      const turn = Number(el.dataset.turn),
        slot = view.game.programs[crew][turn - 1];
      perform(async () => {
        if (selected.length) await placeCard(turn, selected);
        else if (slot.cards.length)
          await command("remove", { crew, turn, slotVersion: slot.revision });
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
          !confirm(t("app.this_permanently_locks_the_current_phase_continue"))
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
      updateSound();
      if (sound) speak(t("app.announcements_enabled"));
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
      navigation.closePanel();
    });
  });
  if (!host) intervals.push(setInterval(refresh, 650));
  intervals.push(
    setInterval(() => {
      if (!view) return;
      const paused = view.tutorial && !view.tutorial.clockRunning;
      const now = view.serverNow + (paused ? 0 : performance.now() - received);
      const end =
        view.stage === "presence"
          ? view.players[seat]?.readyUntil
          : view.stage === "countdown"
            ? view.missionStartAt
            : view.stage === "programming"
              ? view.missionStartAt + view.mission.phaseEndsMs.at(-1)
              : now;
      const practiceTime = $("[data-practice-time]");
      if (practiceTime) {
        const text = practiceClockText(
          view,
          locale,
          performance.now() - received,
        );
        if (practiceTime.textContent !== text) practiceTime.textContent = text;
      }
      $("#clock").textContent = paused
        ? t("app.paused_afa0b8")
        : view.stage === "presence" && !view.players[seat]?.ready
          ? t("app.waiting_bade46")
          : duration((end ?? now) - now);
      $("#clock-caption").textContent = view.tutorial
        ? ""
        : view.stage === "programming"
          ? t("app.until_jump")
          : view.stage === "presence"
            ? view.players[seat]?.ready
              ? t("app.ready_for")
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
    $("#connection").textContent = "";
    $(".brand").removeAttribute("href");
  } else {
    void (async () => {
      lessons = await fetch("/api/lessons").then((r) => r.json());
      fillMissions(await fetch("/api/missions").then((r) => r.json()));
      await refresh();
    })();
  }
  return {
    resetTutorial() {
      previewTurn = null;
      placements.length = 0;
      $("#error").textContent = "";
      basicsPicked = false;
      basicsStarted = false;
      selected = [];
      replayFrame = null;
      key = "";
    },
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
      if (host) $("#connection").textContent = "";
    },
    setPlayer(index) {
      const nextSeat = index ?? -1;
      // BGS repeats player information during state/presence updates. Only an
      // actual seat change should discard the locally selected android/cards.
      if (seat === nextSeat) return;
      seat = nextSeat;
      crew = Math.max(0, seat);
      previewTurn = null;
      selected = [];
      rerender();
    },
    setPreferences(prefs) {
      appearance = prefs.bgs ?? {};

      if (prefs.sound !== undefined) sound = !!prefs.sound;
      if (prefs.locale) return language.set(prefs.locale);
      rerender();
    },
    destroy() {
      language.destroy();
      root.ownerDocument.removeEventListener("keydown", handlePlanningKey);
      navigation.destroy();
      for (const id of intervals) clearInterval(id);
      for (const [type, fn] of rootListeners)
        root.removeEventListener(type, fn);
      if (sound && "speechSynthesis" in window) speechSynthesis.cancel();
    },
  };
}
