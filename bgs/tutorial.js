import { translate, loadLocale } from "../preview/i18n.js";
import {
  createLessonTutorial,
  completedTurns,
} from "../src/tutorial-controller.js";
import { LESSONS } from "../src/tutorials.js";
import { snapshot } from "../src/view.js";
import { mountConsole } from "../preview/app.js";
import { pictogram } from "../preview/icons.js";
import { duration, practiceClockText } from "../preview/clock.js";
import { createSoundDesign } from "../preview/sound.js";
import html from "../preview/index.html";
import css from "../preview/style.css";

export async function mountLesson(
  target,
  {
    chapter = "basics",
    locale = "en",
    onProgress,
    nextChapter,
    standalone = false,
  } = {},
) {
  locale = await loadLocale(locale);
  const t = (key, params) => translate(locale, key, params);
  const index = LESSONS.findIndex((l) => l.id === chapter);
  if (index < 0) throw Error("Unknown tutorial chapter");
  const sound = createSoundDesign();
  let soundOn = true,
    disposed = false,
    lastStep = -1,
    lastTurn = 0,
    lastTick = performance.now();
  let playing = false,
    previousStage,
    previousPhase,
    previousThreats,
    playbackBusy = false;
  const shotExerciseEnded = (s) =>
    chapter === "first-shot" &&
    s.state.tutorial.stopAtTarget &&
    s.state.game.resolution?.turn >= 3 &&
    ["threats", "computer", "appear"].includes(s.state.game.resolution.step);
  const canPlay = (s) =>
    !shotExerciseEnded(s) &&
    !(chapter === 'energy' && completedTurns(s.state) >= 4) &&
    s.state.stage === "resolution" &&
    !s.completed &&
    !s.state.game.resolution?.outcome &&
    !(chapter === "basics" && completedTurns(s.state) >= 3);
  let storage;
  try {
    storage = window.localStorage;
    soundOn = storage.getItem("space-alert:tutorial-sound") !== "off";
  } catch {}
  // Unlock audio on the first real interaction, respecting browser autoplay rules.
  const unlockSound = () => sound.enable(soundOn);
  target.ownerDocument.addEventListener("pointerdown", unlockSound, true);
  target.ownerDocument.addEventListener("keydown", unlockSound, true);
  const tutorial = await createLessonTutorial(chapter, {
    locale,
    storage,
    onProgress,
  });
  target.innerHTML = html
    .split("<body>")[1]
    .split('<script type="module"')[0]
    .split("</body>")[0];
  const style = document.createElement("style");
  style.textContent = css;
  target.prepend(style);
  target.classList.add("native-tutorial");
  target.dataset.chapter = chapter;
  const guide = document.createElement("section");
  guide.className = "native-guide";
  target.querySelector("#basics-guide").before(guide);
  if (chapter === "basics" || chapter === "planning-phases") {
    target
      .querySelector("#planning")
      .append(target.querySelector("#basics-guide"));
    target.querySelector("#ship").classList.add("training-ship");
  }
  const programControls = document.createElement("div");
  programControls.className = "lesson-program-controls";
  target.querySelector("#hand").after(programControls);
  if (chapter === "first-shot") {
    const threats = target.querySelector("#threats");
    const heading = target
      .querySelector("#threat-title")
      .closest(".section-heading");
    const objective = document.createElement("section");
    objective.className = "lesson-target";
    target.querySelector("#planning").append(objective);
    objective.append(heading, threats);
  }
  const goChapter = (id) => {
    if (standalone)
      location.assign(
        `/learn?chapter=${encodeURIComponent(id)}&locale=${encodeURIComponent(locale)}`,
      );
  };
  const play = async (move) => {
    if (!(await tutorial.play(move)))
      throw Error(tutorial.snapshot.error || t("tutorial.action_unavailable"));
  };
  async function tick() {
    const now = performance.now();
    const ms = Math.floor(now - lastTick);
    lastTick = now;
    if (
      tutorial.snapshot.state.tutorial.clockRunning &&
      tutorial.snapshot.state.stage === "programming"
    )
      await play({ type: "practice-tick", ms });
  }
  const ui = mountConsole(target, {
    tutorial: true,
    missions: [],
    locale,
    command: play,
    openLesson: goChapter,
    async tutorialPost(path, body) {
      if (path === "/api/lesson-clock") {
        await tick();
        await play({ type: "practice-clock", running: body.running });
        lastTick = performance.now();
      } else if (path === "/api/lesson-deadline") {
        await play({ type: "practice-deadline" });
        lastTick = performance.now();
      } else if (path === "/api/lesson-next")
        await play({
          type: chapter === "basics" ? "practice-run" : "practice-phase",
        });
      else throw Error("Unsupported tutorial action");
    },
    cue: (kind, pan) => sound.cue(kind, pan),
  });
  ui.setPreferences({ locale });
  ui.setPlayer(0);
  const escape = (value) =>
    String(value).replace(
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
  const stageFor = (s) =>
    chapter === "planning-phases"
      ? s.step === 2
        ? 1
        : s.step === 3
          ? 2
          : s.step
      : chapter === "basics" && s.step >= 4
        ? Math.min(s.step - 3, 2)
        : Math.min(s.step, 2);
  const label =
    chapter === "planning-phases"
      ? [
          t("tutorial.discover"),
          t("phases.first"),
          t("phases.second"),
          t("tutorial.execute"),
        ]
      : [t("tutorial.discover"), t("basics.plan"), t("tutorial.execute")];
  const transport = (action, icon, title, disabled = false) =>
    `<button data-guide="${action}" class="quiet icon-button" title="${title}" aria-label="${title}" ${disabled ? "disabled" : ""}>${pictogram(icon)}</button>`;
  function missionOverview() {
    return `<div class="mission-overview"><div class="mission-flow">${[
      ["clock", "plan"],
      ["lock", "lock"],
      ["step", "play"],
    ]
      .map(
        ([icon, key], i) =>
          `${i ? `<span class="flow-arrow" aria-hidden="true">${pictogram("right")}</span>` : ""}<div class="mission-concept">${pictogram(icon)}<strong>${t(`overview.${key}`)}</strong><small>${t(`overview.${key}_detail`)}</small></div>`,
      )
      .join(
        "",
      )}</div><div class="mission-timeline"><span>${t("overview.turns")}</span><div class="mission-groups">${[
      { first: 1, last: 3 },
      { first: 4, last: 7 },
      { first: 8, last: 12 },
    ]
      .map(
        ({ first, last }, i) =>
          `<div class="mission-group ${i ? "later" : ""}" title="${t("timing.phase_group", { phase: i + 1, first, last })}">${Array.from({ length: last - first + 1 }, (_, n) => `<span>${first + n}</span>`).join("")}</div>`,
      )
      .join("")}</div>${pictogram("step")}</div></div>`;
  }
  function renderGuide(s) {
    const planned = s.state.game.programs[0].some(
      (slot) => slot?.cards?.length,
    );
    const readyToFire =
      chapter === "first-shot" &&
      [1, 2].every((i) => s.state.game.programs[0][i]?.cards?.length);
    const stage =
      chapter === "planning-phases" ? Math.min(s.step, 3) : stageFor(s);
    const phaseLesson = chapter === "planning-phases";
    const deadline = chapter === "basics" && s.step >= 4;
    const missed =
      LESSONS[index].basics &&
      s.step === 2 &&
      completedTurns(s.state) >= 3 &&
      !s.completed;
    programControls.innerHTML = `${chapter === "basics" && s.step === 3 ? `<button data-guide="timeout" class="primary icon-label" aria-keyshortcuts="Enter" title="${t("timing.next_scenario")} · ↵" ${s.busy ? "disabled" : ""}>${pictogram("clock")}<span>${t("timing.next_scenario")}</span><kbd aria-hidden="true">↵</kbd></button>` : ""}${canPlay(s) ? transport("playback", playing ? "pause" : "right", playing ? t("basics.pause") : t("tutorial.play_program")) : ""}${!LESSONS[index].basics && chapter !== "first-shot" && s.step === 1 && s.state.phase === 1 ? transport("phase", "lock", t("tutorial.lock_phase", { phase: 1 }), s.busy) : ""}${!LESSONS[index].basics && s.step === 1 && (chapter !== "energy" || s.state.phase === 2) ? `<button data-guide="run" class="primary icon-button" aria-keyshortcuts="Enter" title="${t("basics.run_program")} · ↵" aria-label="${t("basics.run_program")}" ${(chapter === "first-shot" ? !readyToFire : !planned) || s.busy ? "disabled" : ""}>${pictogram("check")}<kbd>↵</kbd></button>` : ""}`;
    if (phaseLesson && s.state.stage === "programming" && s.step > 0) {
      const ready =
        s.state.game.programs[0][(s.state.phase === 1 ? 1 : 4) - 1]?.cards
          ?.length;
      const phaseTime = duration(
        s.state.missionStartAt +
          s.state.mission.phaseEndsMs[s.state.phase - 1] -
          s.state.observedAt,
      );
      programControls.innerHTML = `<div class="phase-lesson-controls">${s.state.phase === 1 ? transport("phase-deadline", "forward", t("phases.skip"), !ready || !s.state.game.threats.length || s.busy) : `<button data-guide="run" class="primary icon-button" aria-keyshortcuts="Enter" title="${t("phases.execute")} · ↵" aria-label="${t("phases.execute")}" ${!ready || s.busy ? "disabled" : ""}>${pictogram("check")}<kbd>↵</kbd></button>`}<div class="practice-clock"><div><strong data-practice-phase>${t("phases.deadline", { phase: s.state.phase, time: phaseTime })}</strong><small>${t("phases.total")} · <span data-practice-time>${practiceClockText(s.state, locale)}</span></small></div>${transport("phase-clock", s.state.tutorial.clockRunning ? "pause" : "clock", t(s.state.tutorial.clockRunning ? "basics.pause" : "basics.start_clock"))}</div></div>`;
    }
    guide.innerHTML = `<div class="native-guide-row"><nav class="basics-stages" aria-label="${t("tutorial.steps")}">${label.map((name, i) => `<button data-guide-step="${deadline ? i + 3 : i}" class="quiet ${stage === i ? "active" : ""}" ${i > stage || s.busy ? "disabled" : ""} ${stage === i ? 'aria-current="step"' : ""}><span class="step-number">${i + 1}</span><span>${name}</span></button>`).join("")}</nav><div class="native-guide-tools">${standalone ? `<a href="/">${t("tutorial.local_game")}</a>` : ""}${transport("sound", soundOn ? "speaker" : "muted", soundOn ? t("tutorial.mute_sounds") : t("tutorial.enable_sounds"))}</div></div>
      <h1>${escape(s.title)}</h1>${s.step === 0 && (chapter === "basics" || phaseLesson) ? missionOverview() : ""}${["basics", "first-shot", "energy"].includes(chapter) ? `<small class="lesson-scope">${t("timing.exercise", { turns: chapter === "energy" ? 4 : 3 })}${chapter === "basics" ? ` · ${deadline ? 2 : 1}/2` : ""}</small>` : ""}<p class="native-guide-text">${escape(missed ? t("tutorial.destination_missed_go_back_and_plan_another_route") : s.text)}</p>${chapter === "first-shot" && s.step < 2 ? `<p class="lesson-shield-note">${pictogram("shield")}<span>${t("lesson.first-shot.shield")}</span></p>` : ""}
      <div class="native-guide-controls">${transport("restart", "rewind", t("tutorial.restart_exercise"), s.busy)}${transport("previous", "left", t("tutorial.previous_step"), s.step === 0 || s.busy)}${transport("replay", "restart", t("tutorial.replay_step"), s.busy || s.step === 0)}${s.canContinue ? `<button data-guide="continue" class="primary icon-button" title="${t("tutorial.start")}" aria-label="${t("tutorial.start")}">${pictogram("right")}</button>` : ""}${s.completed && (nextChapter || (standalone && LESSONS[index + 1])) ? `<button data-guide="next" class="primary icon-label"><span>${t("tutorial.next_exercise")}</span>${pictogram("right")}</button>` : ""}</div>
      ${s.error ? `<p role="alert">${escape(s.error)}</p>` : ""}`;
  }
  const unsubscribe = tutorial.subscribe((s) => {
    if (disposed) return;
    if (s.state.stage === "resolution" && previousStage === "programming") {
      playing = true;
      sound.cue("start");
    }
    if (s.state.stage === "programming") {
      if (previousPhase !== undefined && s.state.phase > previousPhase)
        sound.cue("lock");
      else if (
        previousThreats !== undefined &&
        s.state.game.threats.length > previousThreats
      )
        sound.cue("alert");
    }
    previousPhase = s.state.phase;
    previousThreats = s.state.game.threats.length;
    previousStage = s.state.stage;
    if (!canPlay(s)) playing = false;
    if (s.step !== lastStep) {
      ui.resetTutorial();

      if (s.completed && lastStep >= 0 && s.step > lastStep &&
          !s.state.game.resolution?.outcome?.survived)
        sound.cue("complete");
      lastStep = s.step;
    }
    const turn = completedTurns(s.state);
    if (turn > lastTurn && lastTurn >= 0 && !s.completed) {
      const action = s.state.game.programs[0][turn - 1]?.cards?.[0];
      const actions = action
        ? s.state.game.cards[action.id]?.sides[action.side]
        : [];
      if (!actions?.length) sound.cue("wait");
    }
    lastTurn = turn;
    const view = snapshot(s.state, 0);
    view.tutorial = {
      ...s.state.tutorial,
      nativeStep: s.completed ? 3 : stageFor(s),
      nativeCheckpoint: s.step,
    };
    view.explorers = [];
    view.careerIds = [];
    target.dataset.tutorialStep = String(
      s.completed || (chapter === "basics" && s.step === 3) ? 3 : stageFor(s),
    );
    target.dataset.tutorialStage = s.state.stage;
    ui.render(view);
    renderGuide(s);
  });
  const onClick = async (event) => {
    const button = event.target.closest("button");
    if (!button || tutorial.snapshot.busy) return;
    const action = button.dataset.guide;
    if (action === "sound") {
      soundOn = !soundOn;
      try {
        storage?.setItem("space-alert:tutorial-sound", soundOn ? "on" : "off");
      } catch {}
      sound.enable(soundOn);
      sound.cue("select");
      renderGuide(tutorial.snapshot);
      return;
    }
    if (action === "phase-deadline") {
      await play({ type: "practice-phase-deadline" });
      lastTick = performance.now();
      return;
    }
    if (action === "phase-clock") {
      await tick();
      await play({
        type: "practice-clock",
        running: !tutorial.snapshot.state.tutorial.clockRunning,
      });
      lastTick = performance.now();
      return;
    }
    if (action === "timeout") {
      await play({ type: "practice-timeout" });
      lastTick = performance.now();
      return;
    }
    if (action === "phase") {
      await play({ type: "practice-phase" });
      return;
    }
    if (action === "run") {
      await play({ type: "practice-run" });
      return;
    }
    if (action === "playback") {
      playing = !playing;
      renderGuide(tutorial.snapshot);
      return;
    }
    if (!action && button.dataset.guideStep === undefined) return;
    playing = false;
    ui.resetTutorial();
    lastTurn = -1;
    sound.cue("back");
    if (button.dataset.guideStep !== undefined) {
      const step = Number(button.dataset.guideStep);
      while (tutorial.snapshot.step > step) await tutorial.previousStep();
    } else if (action === "continue") await tutorial.continue();
    else if (action === "previous") await tutorial.previousStep();
    else if (action === "replay") {
      if (tutorial.snapshot.completed) await tutorial.previousStep();
      else await tutorial.restartStep();
      playing = canPlay(tutorial.snapshot);
      renderGuide(tutorial.snapshot);
    } else if (action === "restart") await tutorial.restart();
    else if (action === "next") {
      if (nextChapter) nextChapter.open();
      else goChapter(LESSONS[index + 1].id);
    }

    lastTick = performance.now();
  };
  guide.addEventListener("click", onClick);
  programControls.addEventListener("click", onClick);
  // Playback pacing only: each tick executes the next deterministic engine step.
  const playback = setInterval(async () => {
    if (
      !playing ||
      disposed ||
      playbackBusy ||
      ui.isAnimating() ||
      target.ownerDocument.hidden ||
      tutorial.snapshot.busy ||
      !canPlay(tutorial.snapshot)
    )
      return;
    playbackBusy = true;
    try {
      await play({ type: "resolve" });
    } catch {
      playing = false;
      renderGuide(tutorial.snapshot);
    } finally {
      playbackBusy = false;
    }
  }, 450);
  const ticker = setInterval(() => {
    if (!tutorial.snapshot.busy) void tick().catch(() => {});
  }, 1000);
  return () => {
    disposed = true;
    clearInterval(playback);
    clearInterval(ticker);
    unsubscribe();
    tutorial.destroy();
    ui.destroy();
    sound.destroy();
    guide.removeEventListener("click", onClick);
    programControls.removeEventListener("click", onClick);
    target.ownerDocument.removeEventListener("pointerdown", unlockSound, true);
    target.ownerDocument.removeEventListener("keydown", unlockSound, true);
    target.classList.remove("native-tutorial");
  };
}
