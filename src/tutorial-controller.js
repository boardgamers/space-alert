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
    game: "space-alert", id, version: 2, storage, onProgress,
    initialState: () => createLesson(id, 1000),
    move(state, move) {
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
        text: lesson.basics ? t("Préparez vos actions, puis regardez-les s’exécuter. Commençons sans menace, avec un seul androïde.", "Plan your actions, then watch them execute. Start without threats, with one android.") : lesson.instructions.map(p => p[locale === "fr" ? 0 : 1]).join("\n\n") },
      { id: "plan", title: t("Préparer le programme", "Plan the program"),
        text: lesson.basics ? t("Placez deux flèches dans le programme. Le vaisseau attend. La troisième case reste vide : attendre.", "Place two arrows in the program. The ship waits. The third slot stays empty: wait.") : t("Programmez les cartes sur le vaisseau, puis terminez la programmation. Le chrono est facultatif ici.", "Program cards on the ship, then finish planning. The clock is optional here."),
        complete: state => state.stage === "resolution" },
      { id: "execute", title: t("Exécuter les tours", "Run the turns"),
        text: t("Programme verrouillé. Avancez la résolution avec ▶. Les équipiers agissent ensemble, puis les menaces.", "Program locked. Advance resolution with ▶. Crew act together, then threats."),
        complete: state => lesson.basics ? completedTurns(state) >= 3 : !!state.game.resolution?.outcome },
    ],
    completion: { title: t("Exercice terminé", "Exercise complete"), text: lesson.basics ? t("Le chrono sert à préparer. Les tours exécutent ensuite votre programme. Une case vide signifie attendre.", "The clock is for planning. Turns then execute your program. An empty slot means wait.") : t("Rejouez pour comparer un autre programme, ou passez à la suite.", "Replay to compare another program, or move on.") },
  });
}
