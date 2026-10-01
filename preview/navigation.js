import { pictogram, specializationIcons } from "./icons.js";

const navIcons = {
  journal: "journal",
  lessons: "training",
  setup: "ship",
  "career-manager": "crew",
  guide: "guide",
};
const labels = {
  journal: ["Journal", "Log"],
  lessons: ["Entraînement", "Training"],
  setup: ["Missions", "Missions"],
  "career-manager": ["Équipage", "Crew"],
  guide: ["Guide", "Guide"],
};
export function mountNavigation(root, { locale, hosted }) {
  const $ = (s) => root.querySelector(s);
  const t = (fr, en) => (locale() === "fr" ? fr : en);
  const menu = $("#console-menu");
  const picker = $("#choice-menu");
  const error = $("#error");
  const errorAnchor = document.createComment("mission errors");
  error.before(errorAnchor);
  const controls = new WeakMap();
  let activePanel = null,
    choiceId = null,
    inspected = null,
    navLocale = null;
  function openPanel(id, title) {
    if (hosted && ["setup", "lessons"].includes(id)) return;
    activePanel = id;
    for (const panel of root.querySelectorAll("[data-panel-content]"))
      panel.hidden = panel.id !== id;
    $("#menu-title").textContent = title ?? t(...labels[id]);
    for (const button of root.querySelectorAll("[data-panel]"))
      button.setAttribute("aria-expanded", String(button.dataset.panel === id));
    menu.querySelector(".dialog-header").after(error);
    if (!menu.open) menu.showModal();
    $(".dialog-body").scrollTop = 0;
  }
  function closePanel() {
    if (picker.open) picker.close();
    if (menu.open) menu.close();
  }
  function labelFor(select) {
    return (
      select.getAttribute("aria-label") ??
      select.parentElement.firstChild?.textContent.trim() ??
      ""
    );
  }
  function optionButton(option, select, pickerOption = false) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = option.textContent;
    if (select.id === "program-crew") {
      button.innerHTML = pictogram(option.dataset.kind);
      const name = document.createElement("span");
      name.textContent = option.dataset.shortLabel;
      button.append(name);
      if (option.dataset.specialization) {
        const badge = document.createElement("span");
        badge.className = "crew-specialization";
        badge.innerHTML = pictogram(
          specializationIcons[option.dataset.specialization],
        );
        button.append(badge);
      }
      button.title = option.textContent;
      button.setAttribute("aria-label", option.textContent);
    }
    button.disabled = option.disabled || select.disabled;
    button.dataset.choiceValue = option.value;
    button.dataset.choiceFor = select.id;
    button.setAttribute("aria-pressed", String(option.selected));
    if (pickerOption) button.dataset.pickerOption = "";
    return button;
  }
  function syncChoices() {
    for (const select of root.querySelectorAll("select")) {
      if (!select.id) continue;
      let control = controls.get(select);
      if (!control) {
        // The native select remains the form's state, while visible controls use buttons.
        const parent = select.parentElement;
        if (parent.tagName === "LABEL") {
          const field = document.createElement("div");
          for (const attr of parent.attributes)
            field.setAttribute(attr.name, attr.value);
          field.classList.add("field");
          field.append(...parent.childNodes);
          parent.replaceWith(field);
        }
        select.hidden = true;
        select.tabIndex = -1;
        control = document.createElement("div");
        control.className = "choice-control";
        control.setAttribute("role", "group");
        select.after(control);
        controls.set(select, control);
      }
      const text = labelFor(select);
      control.hidden =
        (hosted && select.id === "seat") ||
        (select.id === "seat" && select.options.length < 2);
      control.setAttribute("aria-label", text);
      control.classList.toggle("crew-tabs", select.id === "program-crew");
      const signature = JSON.stringify([
        text,
        select.value,
        select.disabled,
        [...select.options].map((o) => [
          o.value,
          o.textContent,
          o.disabled,
          { ...o.dataset },
        ]),
      ]);
      if (control.dataset.signature === signature) continue;
      control.dataset.signature = signature;
      const focused = control.contains(root.ownerDocument.activeElement)
        ? root.ownerDocument.activeElement.dataset.choiceValue
        : null;
      const inline = select.options.length <= 5 && select.id !== "seat";
      control.classList.toggle("segmented", inline);
      control.replaceChildren();
      if (inline) {
        for (const option of select.options)
          control.append(optionButton(option, select));
      } else {
        const trigger = document.createElement("button");
        trigger.type = "button";
        trigger.className = "choice-trigger";
        trigger.dataset.choose = select.id;
        trigger.disabled = select.disabled || !select.options.length;
        trigger.setAttribute("aria-haspopup", "dialog");
        trigger.setAttribute(
          "aria-label",
          `${text} : ${select.selectedOptions[0]?.textContent ?? ""}`,
        );
        const value = document.createElement("span");
        value.textContent = select.selectedOptions[0]?.textContent ?? "—";
        trigger.append(value);
        const symbol = document.createElement("span");
        symbol.className = "choice-symbol";
        symbol.textContent = "↗";
        symbol.setAttribute("aria-hidden", "true");
        trigger.append(symbol);
        control.append(trigger);
      }
      if (focused !== null)
        [...control.querySelectorAll("button")]
          .find((b) => b.dataset.choiceValue === focused)
          ?.focus({ preventScroll: true });
    }
  }
  function inspect(key) {
    const card = [...root.querySelectorAll("[data-inspect]")].find(
      (el) => el.dataset.inspect === key,
    );
    if (!card) return;
    inspected = key;
    $("#inspection").replaceChildren(
      card.parentElement.querySelector("template").content.cloneNode(true),
    );
    openPanel(
      "inspection",
      card.dataset.inspectTitle ?? card.querySelector("strong").textContent,
    );
  }
  function sync() {
    if (navLocale !== locale()) {
      navLocale = locale();
      $("#console-nav").innerHTML = Object.entries(labels)
        .filter(([id]) => !hosted || !["setup", "lessons"].includes(id))
        .map(
          ([id, words]) =>
            `<button type="button" data-panel="${id}" aria-haspopup="dialog" aria-expanded="${menu.open && activePanel === id}">${pictogram(navIcons[id])}<span>${t(...words)}</span></button>`,
        )
        .join("");
      for (const close of root.querySelectorAll("[data-close-dialog]"))
        close.setAttribute("aria-label", t("Fermer", "Close"));
      if (activePanel && activePanel !== "inspection")
        $("#menu-title").textContent = t(...labels[activePanel]);
    }
    syncChoices();
    if (hosted)
      $('[data-panel="career-manager"]').hidden =
        !$("#explorers").childElementCount;
    if (menu.open && activePanel === "inspection" && inspected) {
      const card = [...root.querySelectorAll("[data-inspect]")].find(
        (el) => el.dataset.inspect === inspected,
      );
      if (card) {
        const template = card.parentElement.querySelector("template");
        if ($("#inspection").innerHTML !== template.innerHTML)
          $("#inspection").innerHTML = template.innerHTML;
      }
    }
    if (picker.open && !root.querySelector(`#${CSS.escape(choiceId)}`))
      picker.close();
  }
  function click(event) {
    const button = event.target.closest("button");
    if (!button || !root.contains(button)) return;
    if (button.hasAttribute("data-close-dialog"))
      button.closest("dialog").close();
    else if (button.dataset.panel) openPanel(button.dataset.panel);
    else if (button.dataset.inspect) inspect(button.dataset.inspect);
    else if (button.dataset.choose) {
      choiceId = button.dataset.choose;
      const select = root.querySelector(`#${CSS.escape(choiceId)}`);
      $("#choice-title").textContent = labelFor(select);
      $("#choice-list").replaceChildren(
        ...[...select.options].map((o) => optionButton(o, select, true)),
      );
      picker.showModal();
    } else if (button.dataset.choiceFor) {
      const select = root.querySelector(
        `#${CSS.escape(button.dataset.choiceFor)}`,
      );
      if (!select || select.disabled) return;
      if (button.hasAttribute("data-picker-option")) picker.close();
      select.value = button.dataset.choiceValue;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      sync();
    }
  }
  function closed() {
    errorAnchor.after(error);
    activePanel = null;
    inspected = null;
    for (const button of root.querySelectorAll("[data-panel]"))
      button.setAttribute("aria-expanded", "false");
  }
  root.addEventListener("click", click);
  menu.addEventListener("close", closed);
  sync();
  return {
    sync,
    syncChoices,
    openPanel,
    closePanel,
    destroy() {
      closePanel();
      root.removeEventListener("click", click);
      menu.removeEventListener("close", closed);
    },
  };
}
