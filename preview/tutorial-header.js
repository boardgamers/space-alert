import { translate } from "./i18n.js";
import { pictogram } from "./icons.js";

// Shared by the embedded BGS tutorial and the standalone /learn guide.
// Keep both introductory overviews in place throughout planning and playback.
export function tutorialMissionHeader(chapter, step, locale) {
  const t = (key, params) => translate(locale, key, params);
  const overview = ["basics", "planning-phases"].includes(chapter)
    ? missionOverview(t)
    : "";
  const scope = ["basics", "first-shot", "energy"].includes(chapter)
    ? `<small class="lesson-scope">${t("timing.exercise", { turns: chapter === "energy" ? 4 : 3 })}</small>`
    : "";
  return overview + scope;
}

function missionOverview(t) {
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
        `<div class="mission-group ${i ? "later" : ""}" title="${t("timing.phase_group", { phase: i + 1, first, last })}">${Array.from({ length: last - first + 1 }, (_, n) => `<span data-mission-turn="${first + n}">${first + n}</span>`).join("")}</div>`,
    )
    .join("")}</div>${pictogram("step")}</div></div>`;
}

// Frames describe the *next* resolution operation. Only a captured `appear`
// frame closes a whole turn (crew actions alone do not finish threat movement).
// Use the displayed prefix, never the live cursor, clock, or planned cards.
export function missionTurnProgress(frames = []) {
  const completed = new Set(frames.filter((frame) => frame.step === "appear" && frame.turn > 0).map((frame) => frame.turn));
  const displayed = frames.at(-1);
  return { completed, current: displayed && !completed.has(displayed.turn) ? displayed.turn : 0 };
}

export function updateTutorialMissionProgress(root, frames, locale) {
  const { completed, current } = missionTurnProgress(frames);
  for (const cell of root.querySelectorAll("[data-mission-turn]")) {
    const turn = Number(cell.dataset.missionTurn);
    const done = completed.has(turn);
    const active = turn === current;
    cell.classList.toggle("completed", done);
    cell.classList.toggle("current", active);
    if (active) cell.setAttribute("aria-current", "step");
    else cell.removeAttribute("aria-current");
    const label = translate(locale, done ? "overview.turn_completed" : active ? "overview.turn_current" : "program.selected_turn", { turn });
    cell.setAttribute("aria-label", label);
    cell.setAttribute("title", label);
    cell.parentElement.classList.toggle("progressed", [...cell.parentElement.children].some((sibling) => sibling.classList.contains("completed") || sibling.classList.contains("current")));
  }
}
