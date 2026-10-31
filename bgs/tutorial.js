import { createLessonTutorial, completedTurns } from "../src/tutorial-controller.js";
import { LESSONS } from "../src/tutorials.js";
import { snapshot } from "../src/view.js";
import { mountConsole } from "../preview/app.js";
import { pictogram } from "../preview/icons.js";
import { createSoundDesign } from "../preview/sound.js";
import html from "../preview/index.html";
import css from "../preview/style.css";

export async function mountLesson(target, { chapter = "basics", locale = "en", onProgress, nextChapter, standalone = false } = {}) {
  const t = (fr, en) => locale === "fr" ? fr : en;
  const index = LESSONS.findIndex(l => l.id === chapter);
  if (index < 0) throw Error("Unknown tutorial chapter");
  const sound = createSoundDesign();
  let soundOn = false, disposed = false, lastStep = -1, lastTurn = 0, lastTick = performance.now();
  let playing = false, previousStage, playbackBusy = false;
  const canPlay = s => s.state.stage === "resolution" && !s.completed && !s.state.game.resolution?.outcome && !(chapter === "basics" && completedTurns(s.state) >= 3);
  let storage;
  try { storage = window.localStorage; } catch {}
  const tutorial = await createLessonTutorial(chapter, { locale, storage, onProgress });
  target.innerHTML = html.split("<body>")[1].split('<script type="module"')[0].split("</body>")[0];
  const style = document.createElement("style");
  style.textContent = css;
  target.prepend(style);
  target.classList.add("native-tutorial");
  const guide = document.createElement("section");
  guide.className = "native-guide";
  target.querySelector("#basics-guide").before(guide);
  if (chapter === "basics") {
    target.querySelector("#planning").append(target.querySelector("#basics-guide"));
    target.querySelector("#ship").classList.add("training-ship");
  }
  const goChapter = id => {
    if (standalone) location.assign(`/learn?chapter=${encodeURIComponent(id)}&locale=${encodeURIComponent(locale)}`);
  };
  const play = async move => {
    if (!await tutorial.play(move)) throw Error(tutorial.snapshot.error || t("Action indisponible", "Action unavailable"));
  };
  async function tick() {
    const now = performance.now();
    const ms = Math.floor(now - lastTick);
    lastTick = now;
    if (tutorial.snapshot.state.tutorial.clockRunning && tutorial.snapshot.state.stage === "programming")
      await play({ type: "practice-tick", ms });
  }
  const ui = mountConsole(target, {
    tutorial: true, missions: [],
    command: play,
    openLesson: goChapter,
    async tutorialPost(path, body) {
      if (path === "/api/lesson-clock") {
        await tick();
        await play({ type: "practice-clock", running: body.running });
        lastTick = performance.now();
      } else if (path === "/api/lesson-next") await play({ type: "practice-phase" });
      else throw Error("Unsupported tutorial action");
    },
    cue: (kind, pan) => sound.cue(kind, pan),
  });
  ui.setPreferences({ locale });
  ui.setPlayer(0);
  const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
  const label = [t("Découvrir", "Discover"), t("Préparer", "Plan"), t("Exécuter", "Execute")];
  const transport = (action, icon, title, disabled = false) => `<button data-guide="${action}" class="quiet icon-button" title="${title}" aria-label="${title}" ${disabled ? 'disabled' : ''}>${pictogram(icon)}</button>`;
  function renderGuide(s) {
    const missed = LESSONS[index].basics && s.step === 2 && completedTurns(s.state) >= 3 && !s.completed;
    guide.innerHTML = `<div class="native-guide-top"><span>${escape(LESSONS[index].title[locale === "fr" ? 0 : 1])}</span><div class="native-guide-tools">${standalone ? `<a href="/">${t("Partie locale", "Local game")}</a>` : ''}${transport("sound", soundOn ? "speaker" : "muted", soundOn ? t("Couper les sons", "Mute sounds") : t("Activer les sons", "Enable sounds"))}</div></div>
      <nav class="basics-stages" aria-label="${t("Étapes", "Steps")}">${label.map((name, i) => `<button data-guide-step="${i}" class="quiet ${Math.min(s.step, 2) === i ? 'active' : ''}" ${i > s.step || s.busy ? 'disabled' : ''} ${s.step === i ? 'aria-current="step"' : ''}><span class="step-number">${i + 1}</span><span>${name}</span></button>`).join('')}</nav>
      <h1>${escape(s.title)}</h1><p class="native-guide-text">${escape(missed ? t("Destination manquée. Revenez préparer un autre trajet.", "Destination missed. Go back and plan another route.") : s.text)}</p>
      <div class="native-guide-controls">${canPlay(s) ? transport("playback", playing ? "pause" : "right", playing ? t("Pause", "Pause") : t("Lire le programme", "Play program")) : ""}${transport("restart", "rewind", t("Recommencer l’exercice", "Restart exercise"), s.busy)}${transport("previous", "left", t("Étape précédente", "Previous step"), s.step === 0 || s.busy)}${transport("replay", "restart", t("Rejouer cette étape", "Replay step"), s.busy || s.step === 0)}${s.canContinue ? `<button data-guide="continue" class="primary icon-button" title="${t("Commencer", "Start")}" aria-label="${t("Commencer", "Start")}">${pictogram("right")}</button>` : ''}${s.completed && (nextChapter || standalone && LESSONS[index + 1]) ? `<button data-guide="next" class="primary icon-label"><span>${t("Exercice suivant", "Next exercise")}</span>${pictogram("right")}</button>` : ''}</div>
      ${s.error ? `<p role="alert">${escape(s.error)}</p>` : ''}`;
  }
  const unsubscribe = tutorial.subscribe(s => {
    if (disposed) return;
    if (s.state.stage === "resolution" && previousStage === "programming") playing = true;
    previousStage = s.state.stage;
    if (!canPlay(s)) playing = false;
    if (s.step !== lastStep) {
      ui.resetTutorial();

      if (s.completed && lastStep >= 0 && s.step > lastStep) sound.cue("complete");
      lastStep = s.step;
    }
    const turn = completedTurns(s.state);
    if (turn > lastTurn && lastTurn >= 0 && !s.completed) {
      const action = s.state.game.programs[0][turn - 1]?.cards?.[0];
      const actions = action ? s.state.game.cards[action.id]?.sides[action.side] : [];
      sound.cue(actions?.length ? "turn" : "wait", actions?.includes("red") ? -.5 : actions?.includes("blue") ? .5 : 0);
    }
    lastTurn = turn;
    const view = snapshot(s.state, 0);
    view.tutorial = { ...s.state.tutorial, nativeStep: s.step };
    view.explorers = [];
    view.careerIds = [];
    target.dataset.tutorialStep = String(s.step);
    target.dataset.tutorialStage = s.state.stage;
    ui.render(view);
    renderGuide(s);
  });
  const onClick = async event => {
    const button = event.target.closest("button");
    if (!button || tutorial.snapshot.busy) return;
    const action = button.dataset.guide;
    if (action === "sound") {
      soundOn = !soundOn; sound.enable(soundOn); sound.cue("select"); renderGuide(tutorial.snapshot); return;
    }
    if (action === "playback") {
      playing = !playing; renderGuide(tutorial.snapshot); return;
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
    else if (action === "replay") { await tutorial.restartStep(); playing = canPlay(tutorial.snapshot); renderGuide(tutorial.snapshot); }
    else if (action === "restart") await tutorial.restart();
    else if (action === "next") {
      if (nextChapter) nextChapter.open();
      else goChapter(LESSONS[index + 1].id);
    }

    lastTick = performance.now();
  };
  guide.addEventListener("click", onClick);
  // Playback pacing only: each tick executes the next deterministic engine step.
  const playback = setInterval(async () => {
    if (!playing || disposed || playbackBusy || tutorial.snapshot.busy || !canPlay(tutorial.snapshot)) return;
    playbackBusy = true;
    try { await play({ type: "resolve" }); }
    catch { playing = false; renderGuide(tutorial.snapshot); }
    finally { playbackBusy = false; }
  }, 450);
  const ticker = setInterval(() => {
    if (!tutorial.snapshot.busy) void tick().catch(() => {});
  }, 5000);
  return () => {
    disposed = true; clearInterval(playback); clearInterval(ticker); unsubscribe(); tutorial.destroy(); ui.destroy(); sound.destroy();
    guide.removeEventListener("click", onClick);
    target.classList.remove("native-tutorial");
  };
}
