import {
  createGame,
  dealPhase,
  onAnnouncement,
  finishGamePlanning,
  GAME_COMMAND_FIELDS,
  gameCommand,
  gameView,
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
  { players, crewSize = Math.max(4, players), mission, gameOptions },
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
    presenceDeadline: now + PRESENCE_WINDOW_MS,
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
  if (state.stage === "presence" && now >= state.presenceDeadline) {
    state.stage = "cancelled";
    state.cancellation = {
      reason: "presence-timeout",
      missingSeats: state.players.filter((p) => !p.ready).map((p) => p.seat),
    };
    append(state, state.presenceDeadline, "cancelled", state.cancellation);
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

export function nextWakeup(state) {
  if (state.stage === "presence") return state.presenceDeadline;
  if (state.stage === "countdown") return state.missionStartAt;
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
  if (command.type === "ready") {
    if (state.stage !== "presence") return reject("Presence check is closed");
    if (!player.ready) {
      player.ready = true;
      append(state, now, "ready", { seat });
    }
    if (state.players.every((p) => p.ready)) {
      state.stage = "countdown";
      state.missionStartAt = now + LAUNCH_COUNTDOWN_MS;
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

export function snapshot(state, seat) {
  // An allowlist keeps the unannounced schedule out of every player/spectator view.
  return structuredClone({
    game: gameView(state, seat),
    version: state.version,
    revision: state.revision,
    stage: state.stage,
    serverNow: state.observedAt,
    presenceDeadline: state.presenceDeadline,
    missionStartAt: state.missionStartAt,
    mission: state.mission,
    crewSize: state.crewSize,
    players: state.players.map(({ lastSequence, ...player }) => player),
    nextSequence: Number.isInteger(seat)
      ? (state.players[seat]?.lastSequence ?? 0) + 1
      : null,
    phase: state.phase,
    communicationsAvailable: state.communicationsAvailable,
    transferClosesAt: state.transferClosesAt,
    log: state.log,
    cancellation: state.cancellation,
    clockRunning: active.has(state.stage),
  });
}
