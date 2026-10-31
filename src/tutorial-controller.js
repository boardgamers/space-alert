import { translate, loadLocale } from "../preview/i18n.js";
import { createTutorial } from "@boardgamers/protocol/tutorial";
import { LESSONS, createLesson } from "./tutorials.js";
import { advanceClock, submit } from "./session.js";

export function completedTurns(state) {
  const r = state.game.resolution;
  return r?.step === "damage" ? r.turn : Math.max(0, (r?.turn ?? 0) - 1);
}

// BGS owns checkpoints and saved action history. All moves still use our engine.
export async function createLessonTutorial(
  id,
  { locale = "en", storage, onProgress } = {},
) {
  locale = await loadLocale(locale);
  const lesson = LESSONS.find((l) => l.id === id);
  if (!lesson) throw Error("Unknown lesson");
  const t = (key, params) => translate(locale, key, params);
  const settleClock = (state) => {
    if (lesson.basics && state.stage === "resolution") {
      state.game.resolution.lastTurn = 3;
      state.game.resolution.finalTurn = 4;
    }
    if (state.stage === "resolution" && state.tutorial.clockRunning) {
      state.tutorial.remainingMs = Math.max(
        0,
        state.missionStartAt +
          state.mission.phaseEndsMs.at(-1) -
          state.observedAt,
      );
      state.tutorial.clockRunning = false;
    }
    return state;
  };
  return createTutorial({
    game: "space-alert",
    id,
    version: lesson.basics ? 4 : 2,
    storage,
    onProgress,
    initialState: () => createLesson(id, 1000, { timing: lesson.basics }),
    move(state, move) {
      if (move.type === "practice-phase-deadline") {
        if (
          !lesson.phaseLesson ||
          state.stage !== "programming" ||
          state.phase !== 1
        )
          throw Error("First planning phase has ended");
        state.tutorial.clockRunning = true;
        return advanceClock(
          state,
          Math.max(
            state.observedAt,
            state.missionStartAt + state.mission.phaseEndsMs[0] - 5000,
          ),
        );
      }
      if (move.type === "practice-timeout") {
        if (
          !lesson.basics ||
          state.tutorial.scenario !== "early" ||
          completedTurns(state) < 3
        )
          throw Error("Finish the first exercise first");
        let next = createLesson(id, 1000, { timing: true });
        next = advanceClock(next, next.missionStartAt + 595000);
        next.tutorial.scenario = "deadline";
        next.tutorial.targetStation = undefined;
        // One physical card makes the unfilled turns unambiguous.
        const card = next.game.hands[0].find((id) =>
          next.game.cards[id].sides.some(
            (side) => side.length === 1 && side[0] === "blue",
          ),
        );
        next.game.hands[0] = [card];
        next.revision = state.revision + 1;
        return next;
      }
      if (move.type === "practice-deadline") {
        if (state.stage !== "programming") throw Error("Planning has ended");
        state.tutorial.clockRunning = true;
        return settleClock(
          advanceClock(
            state,
            Math.max(
              state.observedAt,
              state.missionStartAt + state.mission.phaseEndsMs.at(-1) - 5000,
            ),
          ),
        );
      }
      if (move.type === "practice-run") {
        if (state.stage !== "programming") throw Error("Planning has ended");
        // Record the objective-based ending in new histories. Older saved
        // full-mission runs remain replayable without losing completed progress.
        state.tutorial.stopAtTarget = id === "first-shot";
        if (lesson.basics || lesson.phaseLesson) {
          const result = submit(
            state,
            0,
            {
              type: "finish-planning",
              sequence: state.players[0].lastSequence + 1,
            },
            state.observedAt,
          );
          if (!result.accepted) throw Error(result.error);
          return settleClock(result.state);
        }
        while (state.stage === "programming")
          state = advanceClock(
            state,
            state.missionStartAt + state.mission.phaseEndsMs[state.phase - 1],
          );
        return settleClock(state);
      }
      if (move.type === "practice-phase") {
        if (state.stage !== "programming") throw Error("Planning has ended");
        return settleClock(
          advanceClock(
            state,
            state.missionStartAt + state.mission.phaseEndsMs[state.phase - 1],
          ),
        );
      }
      if (move.type === "practice-clock") {
        if (state.stage !== "programming") throw Error("Planning has ended");
        state.tutorial.clockRunning = !!move.running;
        if (move.running) state.tutorial.clockStarted = true;
        state.revision++;
        return state;
      }
      if (move.type === "practice-tick") {
        if (!state.tutorial.clockRunning || state.stage !== "programming")
          return state;
        if (!Number.isSafeInteger(move.ms) || move.ms < 0)
          throw Error("Invalid practice time");
        return settleClock(advanceClock(state, state.observedAt + move.ms));
      }
      const result = submit(
        state,
        0,
        { ...move, sequence: state.players[0].lastSequence + 1 },
        state.observedAt,
      );
      if (!result.accepted) throw Error(result.error);
      return result.state;
    },
    steps: lesson.phaseLesson
      ? [
          {
            id: "discover",
            title: t(lesson.title),
            text: t("lesson.planning-phases.instruction.0"),
          },
          {
            id: "first-phase",
            title: t("phases.first"),
            text: (state) =>
              t(
                !state.tutorial.clockStarted
                  ? "phases.start"
                  : !state.game.threats.length
                    ? "phases.listen"
                    : "phases.revealed",
              ),
            complete: (state) => state.phase === 2,
          },
          {
            id: "second-phase",
            title: t("phases.second"),
            text: t("phases.locked"),
            complete: (state) => state.stage === "resolution",
          },
          {
            id: "whole-mission",
            title: t("phases.execute"),
            text: t("phases.all_turns"),
            complete: (state) => !!state.game.resolution?.outcome,
          },
        ]
      : [
          {
            id: "discover",
            title: t(lesson.title),
            text: lesson.basics
              ? t(
                  "tutorial_controller.the_clock_limits_planning_time_your_turns_execute",
                )
              : lesson.instructions[0]
                ? t(lesson.instructions[0])
                : "",
          },
          {
            id: "plan",
            title: t("tutorial_controller.plan_the_program"),
            text: (state) =>
              id === "first-shot"
                ? t(
                    "tutorial_controller.place_a_shot_in_each_highlighted_slot_then",
                  )
                : lesson.basics
                  ? t(
                      state.tutorial.clockStarted
                        ? "timing.plan_early"
                        : "timing.start_clock",
                    )
                  : t(lesson.instructions[1] ?? lesson.instructions[0]),
            complete: (state) => state.stage === "resolution",
          },
          {
            id: "execute",
            title: t("basics.run_the_turns"),
            text: lesson.basics
              ? t("timing.executing")
              : t(
                  "tutorial_controller.program_locked_crew_act_together_then_threats",
                ),
            complete: (state) =>
              lesson.basics
                ? completedTurns(state) >= 3 &&
                  state.game.resolution.ship.crew[0].station ===
                    state.tutorial.targetStation
                : id === "first-shot" && state.tutorial.stopAtTarget
                  ? state.game.resolution.threats.some(
                      (threat) =>
                        threat.id === lesson.threat &&
                        threat.status === "destroyed",
                    )
                  : !!state.game.resolution?.outcome,
          },
          ...(lesson.basics
            ? [
                {
                  id: "deadline-intro",
                  title: t("timing.try_deadline"),
                  text: t("timing.early_done"),
                  complete: (state) => state.tutorial.scenario === "deadline",
                },
                {
                  id: "deadline-plan",
                  title: t("timing.let_time_run_out"),
                  text: t("timing.deadline_plan"),
                  complete: (state) => state.stage === "resolution",
                },
                {
                  id: "deadline-execute",
                  title: t("basics.run_the_turns"),
                  text: t("timing.empty_waits"),
                  complete: (state) => completedTurns(state) >= 3,
                },
              ]
            : []),
        ],
    completion: {
      title: t("tutorial_controller.exercise_complete"),
      text: lesson.basics
        ? t("timing.complete")
        : id === "first-shot"
          ? t("tutorial_controller.target_destroyed")
          : t(
              "tutorial_controller.replay_to_compare_another_program_or_move_on",
            ),
    },
  });
}
