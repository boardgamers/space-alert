import { translate } from "./i18n.js";
import { pictogram, equipmentPicture } from "./icons.js";

// Catalogs contain text and closed action/crew tokens, never executable HTML.
const actions = {
  weapons: ["A", "app.weapons"],
  energy: ["B", "app.energy"],
  systems: ["C", "app.systems"],
};
const escape = (text) => String(text).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function tutorialTextParts(text, locale) {
  return String(text).split(/(\[\[(?:action:(?:weapons|energy|systems)|crew:android:[1-5])\]\])/g)
    .filter(Boolean).map((text) => {
      const crew = /^\[\[crew:android:([1-5])\]\]$/.exec(text);
      if (crew) return { type: "crew", number: crew[1], label: `${translate(locale, "app.android")} ${crew[1]}` };
      const match = /^\[\[action:(weapons|energy|systems)\]\]$/.exec(text);
      const action = match && actions[match[1]];
      return action
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
    : `<span class="tutorial-${part.type}" role="img" aria-label="${escape(part.label)}" title="${escape(part.label)}">${part.type === "crew" ? `${equipmentPicture("android")}<b aria-hidden="true">${part.number}</b>` : pictogram(part.icon)}</span>`).join("");
}
