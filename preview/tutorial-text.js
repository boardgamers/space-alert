import { translate } from "./i18n.js";
import { pictogram } from "./icons.js";

// Catalogs contain text and a closed set of action tokens, never executable HTML.
const actions = {
  weapons: ["A", "app.weapons"],
  energy: ["B", "app.energy"],
  systems: ["C", "app.systems"],
};
const escape = (text) => String(text).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function tutorialTextParts(text, locale) {
  return String(text).split(/(\[\[action:(?:weapons|energy|systems)\]\])/g)
    .filter(Boolean).map((text) => {
      const action = actions[text.slice(9, -2)];
      return text.startsWith("[[action:") && action
        ? { type: "action", icon: action[0], label: translate(locale, action[1]) }
        : { type: "text", text };
    });
}

export function tutorialTextPlain(text, locale) {
  return tutorialTextParts(text, locale).map((part) => part.label ?? part.text).join("");
}

export function tutorialTextHtml(text, locale) {
  return tutorialTextParts(text, locale).map((part) => part.type === "text"
    ? escape(part.text)
    : `<span class="tutorial-action" role="img" aria-label="${escape(part.label)}" title="${escape(part.label)}">${pictogram(part.icon)}</span>`).join("");
}
