import { gameView } from "./game/planning.js";
const active = new Set(["presence", "countdown", "programming"]);
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
