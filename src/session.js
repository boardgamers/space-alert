import {
  createGame,
  dealPhase,
  onAnnouncement,
  finishGamePlanning,
  GAME_COMMAND_FIELDS,
  gameCommand,
} from "./game/planning.js";
import { compileTimeline } from "./missions.js";

export const PRESENCE_WINDOW_MS = 120_000;
export const LAUNCH_COUNTDOWN_MS = 3_000;
const active = new Set(["presence", "countdown", "programming"]);
function timestamp(now) {
  if (!Number.isSafeInteger(now) || now < 0)
    throw new Error("Invalid trusted timestamp");
}
function append(state, at, type, details = {}) {
  state.log.push({ id: state.log.length + 1, at, type, ...details });
  state.revision++;
}
export function createSession(
  {
    players,
    crewSize = Math.max(4, players),
    mission,
    gameOptions,
    connectionChecks = false,
  },
  now,
) {
  timestamp(now);
  if (!Number.isInteger(players) || players < 1 || players > 5)
    throw new Error("Invalid player count");
  if (crewSize < players || (crewSize === 3 && players !== 3))
    throw new Error("Invalid crew configuration");
  const timeline = compileTimeline(mission, crewSize);
  const state = {
    version: 1,
    stage: "presence",
    revision: 0,
    observedAt: now,
    createdAt: now,
    connectionChecks,
    missionStartAt: null,
    mission: {
      id: mission.id,
      title: mission.title,
      doubleActions: mission.doubleActions,
      phaseEndsMs: [...mission.phaseEndsMs],
    },
    crewSize,
    players: Array.from({ length: players }, (_, seat) => ({
      seat,
      ready: false,
      readyUntil: null,
      present: !connectionChecks,
      planningPhase: 0,
      finishedPlanning: false,
      lastSequence: 0,
    })),
    phase: 0,
    communicationsAvailable: true,
    transferClosesAt: null,
    timeline,
    cursor: 0,
    log: [],
    cancellation: null,
  };
  if (gameOptions) state.game = createGame(state, gameOptions);
  return state;
}
function finish(state, at, early = false) {
  state.stage = "resolution";
  state.transferClosesAt = null;
  state.communicationsAvailable = true;
  state.players.forEach((p) => (p.finishedPlanning = true));
  finishGamePlanning(state);
  append(state, at, "programming-complete", { early });
}

// Only the trusted host may call this with its clock. Browser timestamps and
// timer callbacks are presentation hints, never authoritative game inputs.
export function advanceClock(input, now) {
  timestamp(now);
  const state = structuredClone(input);
  state.observedAt = Math.max(now, state.observedAt);
  now = state.observedAt;
  if (["presence", "countdown"].includes(state.stage)) {
    // A delayed wakeup must settle readiness at launch time, not after the flight.
    const at =
      state.stage === "countdown" ? Math.min(now, state.missionStartAt) : now;
    for (const player of state.players) {
      if (
        player.ready &&
        (player.readyUntil <= at || (state.connectionChecks && !player.present))
      ) {
        player.ready = false;
        player.readyUntil = null;
        append(state, at, "ready-expired", { seat: player.seat });
      }
    }
    if (state.stage === "countdown" && !state.players.every((p) => p.ready)) {
      state.stage = "presence";
      state.missionStartAt = null;
      append(state, at, "launch-postponed");
    }
  }
  if (state.stage === "countdown" && now >= state.missionStartAt) {
    state.stage = "programming";
  }
  if (state.stage !== "programming") return state;
  while (state.cursor < state.timeline.length) {
    const event = state.timeline[state.cursor];
    const at = state.missionStartAt + event.atMs;
    if (at > now) break;
    state.cursor++;
    if (event.type === "mission-complete") {
      finish(state, at);
      break;
    }
    if (event.type === "phase-start") {
      state.phase = event.phase;
      for (const player of state.players)
        player.planningPhase = Math.max(player.planningPhase, state.phase);
    } else if (event.type === "communications-down")
      state.communicationsAvailable = false;
    else if (event.type === "communications-restored")
      state.communicationsAvailable = true;
    else if (event.type === "data-transfer")
      state.transferClosesAt = at + event.durationMs;
    else if (event.type === "data-transfer-end") state.transferClosesAt = null;
    onAnnouncement(state, event);
    const { atMs, ...announcement } = event;
    append(state, at, "announcement", { event: announcement });
  }
  return state;
}

export function setPresence(input, seats) {
  const state = structuredClone(input);
  for (const player of state.players)
    player.present = seats.includes(player.seat);
  return state;
}

export function nextWakeup(state) {
  if (["presence", "countdown"].includes(state.stage)) {
    const deadlines = state.players
      .filter((p) => p.ready)
      .map((p) => p.readyUntil);
    if (state.stage === "countdown") deadlines.push(state.missionStartAt);
    return deadlines.length ? Math.min(...deadlines) : null;
  }
  if (state.stage === "programming")
    return state.missionStartAt + state.timeline[state.cursor].atMs;
  return null;
}

// seat and receivedAt come from the host, not from the command body. Even a
// rejected or duplicate command returns the clock-advanced state for persistence.
export function submit(input, seat, command, receivedAt) {
  const state = advanceClock(input, receivedAt);
  const reject = (error) => ({ state, accepted: false, error });
  if (!Number.isInteger(seat) || !state.players[seat])
    return reject("Unknown player");
  if (
    !command ||
    !Number.isSafeInteger(command.sequence) ||
    command.sequence < 1
  )
    return reject("Invalid command sequence");
  if (
    ![
      "ready",
      "unready",
      "advance-phase",
      "finish-planning",
      ...Object.keys(GAME_COMMAND_FIELDS),
    ].includes(command.type)
  )
    return reject("Unsupported command");
  if (
    Object.keys(command).some(
      (key) =>
        key !== "type" &&
        key !== "sequence" &&
        !(GAME_COMMAND_FIELDS[command.type] ?? []).includes(key),
    )
  )
    return reject("Unexpected command field");
  const player = state.players[seat];
  if (command.sequence <= player.lastSequence)
    return { state, accepted: true, duplicate: true };
  if (command.sequence !== player.lastSequence + 1)
    return reject("Refresh before sending the next command");
  const now = state.observedAt;
  if (GAME_COMMAND_FIELDS[command.type]) {
    const draft = structuredClone(state);
    try {
      gameCommand(draft, seat, command);
    } catch (error) {
      return reject(error.message);
    }
    draft.players[seat].lastSequence = command.sequence;
    draft.revision++;
    return { state: draft, accepted: true, duplicate: false };
  }
  if (command.type === "unready") {
    if (!["presence", "countdown"].includes(state.stage))
      return reject("The mission has started");
    player.ready = false;
    player.readyUntil = null;
    state.stage = "presence";
    state.missionStartAt = null;
    append(state, now, "unready", { seat });
  } else if (command.type === "ready") {
    if (state.stage !== "presence") return reject("Presence check is closed");
    if (state.connectionChecks && !player.present)
      return reject("Reconnect to the table before getting ready");
    if (!player.ready) {
      player.ready = true;
      player.readyUntil = now + PRESENCE_WINDOW_MS;
      append(state, now, "ready", { seat });
    }
    if (state.players.every((p) => p.ready)) {
      state.stage = "countdown";
      state.missionStartAt =
        now + (state.connectionChecks ? 10_000 : LAUNCH_COUNTDOWN_MS);
      append(state, now, "launch-scheduled", {
        startsAt: state.missionStartAt,
      });
    }
  } else {
    if (state.stage !== "programming") return reject("Programming is closed");
    if (player.finishedPlanning) return reject("Your plan is locked");
    if (command.type === "advance-phase") {
      if (state.game?.solo)
        return reject("Solo phases follow the shared clock");
      if (player.planningPhase >= state.mission.phaseEndsMs.length)
        return reject("Already in the last phase");
      player.planningPhase++;
      dealPhase(state, seat, player.planningPhase);
      append(state, now, "player-phase", { seat, phase: player.planningPhase });
    } else {
      if (state.phase < state.mission.phaseEndsMs.length)
        return reject("The final phase has not begun");
      player.finishedPlanning = true;
      append(state, now, "player-finished", { seat });
      if (state.players.every((p) => p.finishedPlanning))
        finish(state, now, true);
    }
  }
  player.lastSequence = command.sequence;
  return { state, accepted: true, duplicate: false };
}

export function canEditTurn(state, seat, turn) {
  const player = state.players[seat];
  if (
    state.stage !== "programming" ||
    !player ||
    player.finishedPlanning ||
    !Number.isInteger(turn)
  )
    return false;
  const ranges = [
    [1, 3],
    [4, 7],
    [8, 12],
  ];
  const range = ranges[player.planningPhase - 1];
  return Boolean(range && turn >= range[0] && turn <= range[1]);
}

export { snapshot } from "./view.js";
