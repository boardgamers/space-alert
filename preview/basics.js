import { pictogram } from "./icons.js";
// A focused view over the real lesson state, not a separate game simulation.
export function basicsView(view, locale, { started, picked, shipMarkup }) {
  const t = (fr, en) => (locale === "fr" ? fr : en);
  const slots = view.game.programs[0];
  const placed = slots.slice(0, 2).filter((s) => s.cards.length).length;
  const r = view.game.resolution;
  const turn = r?.step === "damage" ? r.turn : Math.max(0, (r?.turn ?? 0) - 1);
  const playing = view.stage === "resolution";
  if (view.tutorial.nativeStep !== undefined) {
    const control = (id, glyph, description, disabled = false) => `<button id="${id}" class="primary icon-button" ${id === "basics-run" ? 'aria-keyshortcuts="Enter"' : ""} title="${description}${id === "basics-run" ? " · ↵" : ""}" aria-label="${description}" ${disabled ? "disabled" : ""}>${pictogram(glyph)}</button>`;
    if (view.tutorial.nativeStep === 0) return "";
    if (playing) return "";
    return `<div class="planning-shortcuts" title="${t("Flèches : déplacement · ↑/↓ : changer de pont · Retour arrière : annuler · Entrée : exécuter", "Arrows: move · ↑/↓: change deck · Backspace: undo · Enter: run")}" aria-label="${t("Raccourcis : flèches pour se déplacer ; retour arrière pour annuler ; entrée pour exécuter", "Shortcuts: arrow keys to move; Backspace to undo; Enter to run")}"><kbd>←</kbd><kbd>→</kbd><kbd>↑</kbd><kbd>↓</kbd><kbd>⌫</kbd><kbd>↵</kbd></div><div class="practice-readiness" role="status" aria-label="${placed}/2 ${t("actions placées", "actions placed")}"><span>${pictogram("cards")} ${placed}/2</span><span class="ready-dots" aria-hidden="true">${[0,1].map(i => `<i class="${i < placed ? "filled" : ""}"></i>`).join("")}</span>${control("basics-run", "step", t("Exécuter le programme", "Run program"), placed !== 2)}</div><div class="practice-clock"><div><strong data-practice-time></strong><small>${t("Préparation", "Planning")}</small></div>${control("lesson-clock", view.tutorial.clockRunning ? "pause" : "clock", view.tutorial.clockRunning ? t("Pause", "Pause") : t("Lancer le chrono", "Start clock"))}</div>`;
  }
  const intro = !started && !placed && !playing;
  const ready = placed === 2;
  const direction = (n) => {
    const c = slots[n - 1].cards[0];
    return c?.sides[c.side][0];
  };
  const actionLabel = (a) =>
    a === "blue"
      ? t("À droite", "Move right")
      : a === "red"
        ? t("À gauche", "Move left")
        : t("Attendre", "Wait");
  const heading = intro
    ? t(
        "Vous décidez d’abord. Vous agissez ensuite.",
        "Plan first. Act afterward.",
      )
    : playing
      ? turn >= 3
        ? t("Vous venez de jouer trois tours.", "You just played three turns.")
        : turn === 0 ? t("Lecture du programme", "Playing the program") : t(`Tour ${turn} exécuté`, `Turn ${turn} carried out`)
      : ready && !picked
        ? t("Essayez le chrono.", "Try the clock.")
        : placed === 0
          ? t("Choisissez où aller.", "Choose where to go.")
          : t(
              "Choisissez votre deuxième action.",
              "Choose your second action.",
            );
  const explanation = intro
    ? t(
        "Dans Space Alert, tout le monde prépare ses actions en même temps. Puis le vaisseau exécute les programmes, tour après tour. Ici, commençons avec un seul équipier, sans menace.",
        "In Space Alert, everyone plans their actions at the same time. Then the ship carries out those plans, turn by turn. Start here with one crew member and no threats.",
      )
    : playing
      ? [
          t("La préparation est terminée. Les actions vont maintenant se jouer dans l’ordre.", "Planning is finished. Actions now play in order."),
          t(
            "La première carte est exécutée. Regardez votre nouvelle position ; la deuxième carte attend son tour.",
            "The first card has played. Look at your position; the second card is still waiting.",
          ),
          t(
            "La deuxième carte est exécutée. Une flèche vers le bord du vaisseau vous laisse sur place. Chaque case est un tour, pas une seconde.",
            "The second card has played. Moving beyond the edge of the ship leaves you in place. Each slot is a turn, not a second.",
          ),
          t(
            "La case 3 est vide : vous restez sur place. En mission, tous les équipiers exécutent leur case 1, puis leur case 2, etc.",
            "Slot 3 is empty: you stay put. In a mission, every crew member carries out slot 1, then slot 2, and so on.",
          ),
        ][Math.min(turn, 3)]
      : ready && !picked
        ? t(
            "Le chrono limite le temps pour préparer les cartes. Il ne déplace pas l’équipier. Vous pouvez le lancer et le mettre en pause ici ; en mission, il continue pour tout le monde.",
            "The clock limits how long you have to arrange cards. It does not move your crew member. Here you can start and pause it; in a mission it keeps running for everyone.",
          )
        : picked
          ? t(
              "Choisissez le tour 1 ou 2. Vous pouvez aussi remplacer une carte déjà posée.",
              "Choose turn 1 or 2. You can also replace a card already there.",
            )
          : t(
              "Choisissez une flèche, puis un tour. Vous pouvez remplacer ou retirer vos cartes.",
              "Choose an arrow, then a turn. You can replace or remove your cards.",
            );
  const btn = (id, text) =>
    `<button id="${id}" class="primary">${text}</button>`;
  return `<div class="basics-top"><span>${t("PREMIERS PAS · SANS MENACE", "FIRST STEPS · NO THREATS")}</span><button data-lesson="basics" class="quiet">${t("Recommencer", "Restart")}</button></div>
    <nav class="basics-stages" aria-label="${t("Étapes de l’exercice", "Lesson steps")}"><button id="basics-plan" class="quiet ${!playing ? "active" : ""}" ${!playing ? 'aria-current="step"' : ''} ${playing && !view.tutorial.canReturnToPlanning ? 'disabled' : ''}><span class="step-number">1</span><span>${t("Préparer", "Plan")}</span></button><button id="basics-execute" class="quiet ${playing ? "active" : ""}" ${playing ? 'aria-current="step"' : ''} ${!playing && !ready ? 'disabled' : ''}><span class="step-number">2</span><span>${t("Exécuter les tours", "Run the turns")}</span></button></nav>
    <h1>${heading}</h1><p class="basics-explanation" role="status">${explanation}</p>
    <div class="training-ship ship cutaway" aria-label="${t("Le vaisseau · position réelle de l’androïde 1", "The ship · android 1’s actual position")}">${shipMarkup}</div>
    ${
      intro
        ? btn(
            "basics-start",
            t("Essayer avec deux cartes", "Try with two cards"),
          )
        : `<div class="basics-program-heading">${pictogram("cards")}<span>${t("Programme", "Program")}</span>${pictogram("right")}</div><div class="basics-program program">${[1, 2, 3].map((n) => `<button title="${t("Tour", "Turn")} ${n} · ${actionLabel(direction(n))}" aria-label="${t("Tour", "Turn")} ${n} · ${actionLabel(direction(n))}" data-basics-turn="${n}" ${playing || (!picked && !slots[n - 1].cards.length) || n === 3 ? "disabled" : ""} class="slot ${playing && n === turn ? "current" : ""}"><span class="turn">T+${n}</span><strong class="action">${pictogram(direction(n) === "blue" ? "right" : direction(n) === "red" ? "left" : "wait")}</strong></button>`).join("")}</div>
    ${!playing ? `<div class="practice-readiness" role="status"><progress value="${placed}" max="2"></progress><span title="${t("Actions de l’exercice placées", "Practice actions placed")}" aria-label="${placed}/2 ${t("actions de l’exercice placées", "practice actions placed")}">${pictogram("cards")} ${placed}/2</span></div><div class="basics-card-area"><div class="basics-card-choices">${["red", "blue"].map((action) => `<button title="${actionLabel(action)}" aria-label="${actionLabel(action)}" data-basics-pick="${action}" aria-pressed="${picked === action}" class="basics-card ${picked === action ? "selected" : ""}"><strong>${pictogram(action === "blue" ? "right" : "left")}</strong></button>`).join("")}</div></div>` : ""}
    ${!playing && ready ? `<div class="practice-clock"><div><strong data-practice-time></strong><small>${t("pour préparer · exercice sans danger", "to plan · safe practice")}</small></div><button id="lesson-clock" class="icon-button" title="${view.tutorial.clockRunning ? t("Mettre en pause", "Pause clock") : t("Lancer le chrono", "Start clock")}" aria-label="${view.tutorial.clockRunning ? t("Mettre en pause", "Pause clock") : t("Lancer le chrono", "Start clock")}">${pictogram(view.tutorial.clockRunning ? "pause" : "clock")}</button></div><button id="basics-run" class="primary icon-button" title="${t("Exécuter le programme", "Run program")}" aria-label="${t("Exécuter le programme", "Run program")}">${pictogram("step")}</button>` : ""}
    ${playing ? (turn < 3 ? `<button data-command="resolve" class="primary icon-button" title="${t("Étape de résolution suivante", "Next resolution step")}" aria-label="${t("Étape de résolution suivante", "Next resolution step")}">${pictogram("step")}</button>` : `<div class="basics-complete"><p>${t("Préparer sous un chrono et exécuter les tours sont deux moments différents. Ensuite, vous apprendrez à utiliser une arme.", "Planning against a clock and carrying out turns are two different parts of the game. Next, learn to use a weapon.")}</p><button data-lesson="first-shot" class="primary">${t("Suite : votre premier tir", "Next: your first shot")}</button></div>`) : ""}`
    }`;
}
