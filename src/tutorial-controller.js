import { createTutorial } from "@boardgamers/protocol/tutorial";
import { LESSONS, createLesson } from "./tutorials.js";
import { advanceClock, submit } from "./session.js";

export function completedTurns(state) {
  const r = state.game.resolution;
  return r?.step === "damage" ? r.turn : Math.max(0, (r?.turn ?? 0) - 1);
}

// BGS owns checkpoints and saved action history. All moves still use our engine.
export function createLessonTutorial(id, { locale = "en", storage, onProgress } = {}) {
  const lesson = LESSONS.find(l => l.id === id);
  if (!lesson) throw Error("Unknown lesson");
  const t = (fr, en) => locale === "fr" ? fr : en;
  return createTutorial({
    game: "space-alert", id, version: lesson.basics ? 3 : 2, storage, onProgress,
    initialState: () => createLesson(id, 1000),
    move(state, move) {
      if (move.type === "practice-deadline") {
        if (state.stage !== "programming") throw Error("Planning has ended");
        state.tutorial.clockRunning = true;
        return advanceClock(state, Math.max(state.observedAt,
          state.missionStartAt + state.mission.phaseEndsMs.at(-1) - 5000));
      }
      if (move.type === "practice-run") {
        if (state.stage !== "programming") throw Error("Planning has ended");
        // Record the objective-based ending in new histories. Older saved
        // full-mission runs remain replayable without losing completed progress.
        state.tutorial.stopAtTarget = id === "first-shot";
        while (state.stage === "programming")
          state = advanceClock(state, state.missionStartAt + state.mission.phaseEndsMs[state.phase - 1]);
        return state;
      }
      if (move.type === "practice-phase") {
        if (state.stage !== "programming") throw Error("Planning has ended");
        return advanceClock(state, state.missionStartAt + state.mission.phaseEndsMs[state.phase - 1]);
      }
      if (move.type === "practice-clock") {
        if (state.stage !== "programming") throw Error("Planning has ended");
        state.tutorial.clockRunning = !!move.running;
        state.revision++;
        return state;
      }
      if (move.type === "practice-tick") {
        if (!state.tutorial.clockRunning || state.stage !== "programming") return state;
        if (!Number.isSafeInteger(move.ms) || move.ms < 0) throw Error("Invalid practice time");
        return advanceClock(state, state.observedAt + move.ms);
      }
      const result = submit(state, 0, { ...move, sequence: state.players[0].lastSequence + 1 }, state.observedAt);
      if (!result.accepted) throw Error(result.error);
      return result.state;
    },
    steps: [
      { id: "discover", title: lesson.title[locale === "fr" ? 0 : 1],
        text: lesson.basics ? t("Le chrono limite la préparation. Les tours s’exécutent ensuite, dans l’ordre.", "The clock limits planning time. Your turns execute afterward, in order.") : lesson.instructions[0]?.[locale === "fr" ? 0 : 1] ?? "" },
      { id: "plan", title: t("Préparer le programme", "Plan the program"),
        text: id === "first-shot" ? t("Placez un tir dans chaque case surlignée, puis ↵.", "Place a shot in each highlighted slot, then ↵.") : lesson.basics ? t("Rejoignez la salle marquée en deux actions. La troisième case reste vide : attendre.", "Reach the marked room in two actions. Leave the third slot empty: wait.") : lesson.instructions[1]?.[locale === "fr" ? 0 : 1] ?? lesson.instructions[0]?.[locale === "fr" ? 0 : 1] ?? "",
        complete: state => state.stage === "resolution" },
      { id: "execute", title: t("Exécuter les tours", "Run the turns"),
        text: t("Programme verrouillé. Les équipiers agissent ensemble, puis les menaces.", "Program locked. Crew act together, then threats."),
        complete: state => lesson.basics ? completedTurns(state) >= 3 && state.game.resolution.ship.crew[0].station === state.tutorial.targetStation
          : id === "first-shot" && state.tutorial.stopAtTarget
            ? state.game.resolution.threats.some(threat => threat.id === lesson.threat && threat.status === "destroyed")
            : !!state.game.resolution?.outcome },
    ],
    completion: { title: t("Exercice terminé", "Exercise complete"), text: lesson.basics ? t("Destination atteinte ! Votre programme vous y a conduit.", "Destination reached! Your program took you there.") : id === "first-shot" ? t("Cible détruite.", "Target destroyed.") : t("Rejouez pour comparer un autre programme, ou passez à la suite.", "Replay to compare another program, or move on.") },
  });
}
