import { translate } from "./i18n.js";
import { pictogram } from "./icons.js";
// A focused view over the real lesson state, not a separate game simulation.
export function basicsView(view, locale, { started, picked, shipMarkup }) {
  const t = (key, params) => translate(locale, key, params);
  const slots = view.game.programs[0];
  const placed = slots.slice(0, 2).filter((s) => s.cards.length).length;
  const r = view.game.resolution;
  const turn = r?.step === "damage" ? r.turn : Math.max(0, (r?.turn ?? 0) - 1);
  const playing = view.stage === "resolution";
  if (view.tutorial.nativeStep !== undefined) {
    const control = (id, glyph, description, disabled = false) =>
      `<button id="${id}" class="primary icon-button" ${id === "basics-run" ? 'aria-keyshortcuts="Enter"' : ""} title="${description}${id === "basics-run" ? " · ↵" : ""}" aria-label="${description}" ${disabled ? "disabled" : ""}>${pictogram(glyph)}${id === "lesson-deadline" ? "<small>5 s</small>" : ""}</button>`;
    if (view.tutorial.nativeStep === 0) return "";
    if (playing)
      return view.tutorial.timing
        ? `<div class="practice-clock stopped"><div><strong data-practice-time></strong><small>${t(view.tutorial.remainingMs > 0 ? "timing.stopped" : "timing.expired")}</small></div>${pictogram(view.tutorial.remainingMs > 0 ? "clock" : "lock")}</div>`
        : "";
    const deadline = view.tutorial.scenario === "deadline";
    return `<div class="planning-shortcuts" title="${t(deadline ? "timing.deadline_shortcuts" : "basics.arrows_move_change_deck_backspace_undo_enter_run")}" aria-label="${t(deadline ? "timing.deadline_shortcuts" : "basics.shortcuts_arrow_keys_to_move_backspace_to_undo")}"><kbd>←</kbd><kbd>→</kbd><kbd>↑</kbd><kbd>↓</kbd><kbd>⌫</kbd>${deadline ? "" : "<kbd>↵</kbd>"}</div>${deadline ? "" : `<div class="practice-readiness" role="status" aria-label="${placed}/2 ${t("basics.actions_placed")}"><span>${pictogram("cards")} ${placed}/2</span><span class="ready-dots" aria-hidden="true">${[0, 1].map((i) => `<i class="${i < placed ? "filled" : ""}"></i>`).join("")}</span>${control("basics-run", "check", t("basics.run_program"), placed !== 2)}</div>`}<div class="practice-clock"><div><strong data-practice-time></strong><small>${t(deadline ? "timing.last_seconds" : "basics.time_to_plan")}</small></div>${control("lesson-clock", view.tutorial.clockRunning ? "pause" : "clock", view.tutorial.clockRunning ? t("basics.pause") : t("basics.start_clock"), deadline && placed !== 1)}</div>`;
  }
  const intro = !started && !placed && !playing;
  const ready = placed === 2;
  const direction = (n) => {
    const c = slots[n - 1].cards[0];
    return c?.sides[c.side][0];
  };
  const actionLabel = (a) =>
    a === "blue"
      ? t("basics.move_right")
      : a === "red"
        ? t("basics.move_left")
        : t("basics.wait");
  const heading = intro
    ? t("basics.plan_first_act_afterward")
    : playing
      ? turn >= 3
        ? t("basics.you_just_played_three_turns")
        : turn === 0
          ? t("basics.playing_the_program")
          : t("basics.turn_carried_out", { turn: turn })
      : ready && !picked
        ? t("basics.try_the_clock")
        : placed === 0
          ? t("basics.choose_where_to_go")
          : t("basics.choose_your_second_action");
  const explanation = intro
    ? t("basics.in_space_alert_everyone_plans_their_actions_at")
    : playing
      ? [
          t("basics.planning_is_finished_actions_now_play_in_order"),
          t("basics.the_first_card_has_played_look_at_your"),
          t("basics.the_second_card_has_played_moving_beyond_the"),
          t("basics.slot_3_is_empty_you_stay_put_in"),
        ][Math.min(turn, 3)]
      : ready && !picked
        ? t("basics.the_clock_limits_how_long_you_have_to")
        : picked
          ? t("basics.choose_turn_1_or_2_you_can_also")
          : t("basics.choose_an_arrow_then_a_turn_you_can");
  const btn = (id, text) =>
    `<button id="${id}" class="primary">${text}</button>`;
  return `<div class="basics-top"><span>${t("basics.first_steps_no_threats")}</span><button data-lesson="basics" class="quiet">${t("app.restart")}</button></div>
    <nav class="basics-stages" aria-label="${t("basics.lesson_steps")}"><button id="basics-plan" class="quiet ${!playing ? "active" : ""}" ${!playing ? 'aria-current="step"' : ""} ${playing && !view.tutorial.canReturnToPlanning ? "disabled" : ""}><span class="step-number">1</span><span>${t("basics.plan")}</span></button><button id="basics-execute" class="quiet ${playing ? "active" : ""}" ${playing ? 'aria-current="step"' : ""} ${!playing && !ready ? "disabled" : ""}><span class="step-number">2</span><span>${t("basics.run_the_turns")}</span></button></nav>
    <h1>${heading}</h1><p class="basics-explanation" role="status">${explanation}</p>
    <div class="training-ship ship cutaway" aria-label="${t("basics.the_ship_android_1_s_actual_position")}">${shipMarkup}</div>
    ${
      intro
        ? btn("basics-start", t("basics.try_with_two_cards"))
        : `<div class="basics-program-heading">${pictogram("cards")}<span>${t("basics.program")}</span>${pictogram("right")}</div><div class="basics-program program">${[1, 2, 3].map((n) => `<button title="${t("app.turn")} ${n} · ${actionLabel(direction(n))}" aria-label="${t("app.turn")} ${n} · ${actionLabel(direction(n))}" data-basics-turn="${n}" ${playing || (!picked && !slots[n - 1].cards.length) || n === 3 ? "disabled" : ""} class="slot ${playing && n === turn ? "current" : ""}"><span class="turn">T+${n}</span><strong class="action">${pictogram(direction(n) === "blue" ? "right" : direction(n) === "red" ? "left" : "wait")}</strong></button>`).join("")}</div>
    ${!playing ? `<div class="practice-readiness" role="status"><progress value="${placed}" max="2"></progress><span title="${t("basics.practice_actions_placed")}" aria-label="${placed}/2 ${t("basics.practice_actions_placed_2d48e9")}">${pictogram("cards")} ${placed}/2</span></div><div class="basics-card-area"><div class="basics-card-choices">${["red", "blue"].map((action) => `<button title="${actionLabel(action)}" aria-label="${actionLabel(action)}" data-basics-pick="${action}" aria-pressed="${picked === action}" class="basics-card ${picked === action ? "selected" : ""}"><strong>${pictogram(action === "blue" ? "right" : "left")}</strong></button>`).join("")}</div></div>` : ""}
    ${!playing && ready ? `<div class="practice-clock"><div><strong data-practice-time></strong><small>${t("basics.to_plan_safe_practice")}</small></div><button id="lesson-clock" class="icon-button" title="${view.tutorial.clockRunning ? t("basics.pause_clock") : t("basics.start_clock")}" aria-label="${view.tutorial.clockRunning ? t("basics.pause_clock") : t("basics.start_clock")}">${pictogram(view.tutorial.clockRunning ? "pause" : "clock")}</button></div><button id="basics-run" class="primary icon-button" title="${t("basics.run_program")}" aria-label="${t("basics.run_program")}">${pictogram("check")}</button>` : ""}
    ${playing ? (turn < 3 ? `<button data-command="resolve" class="primary icon-button" title="${t("app.next_resolution_step")}" aria-label="${t("app.next_resolution_step")}">${pictogram("step")}</button>` : `<div class="basics-complete"><p>${t("basics.planning_against_a_clock_and_carrying_out_turns")}</p><button data-lesson="first-shot" class="primary">${t("basics.next_your_first_shot")}</button></div>`) : ""}`
    }`;
}
