import { loadLocale } from "../preview/i18n.js";
import { mountLesson } from "./tutorial.js";
import { registerViewer } from "@boardgamers/protocol/viewer";
import { mountConsole } from "../preview/app.js";
import html from "../preview/index.html";
import css from "../preview/style.css";
import { snapshot } from "../src/view.js";
const missionSummaries = BGS_MISSIONS;

registerViewer(
  "SpaceAlert",
  (context) => {
    const { target } = context;
    const style = document.createElement("style");
    style.textContent =
      css +
      `
 .bgs-hosted #setup,.bgs-hosted #lessons,.bgs-hosted #create-explorer,.bgs-hosted #seat,.bgs-hosted #ready-all,.bgs-hosted #next-event,.bgs-hosted #open-setup {display:none!important}
 .bgs-hosted #career-manager:has(#explorers:empty) {display:none}
 `;
    const mountMarkup = () => {
      target.innerHTML = html
        .split("<body>")[1]
        .split('<script type="module"')[0]
        .split("</body>")[0];
      target.prepend(style);
    };
    let seat,
      pending,
      lastState,
      ui,
      initializing,
      disposed = false;
    let preferences = { locale: "en" };
    async function ensureUI() {
      if (ui || disposed) return ui;
      if (initializing) return initializing;
      initializing = (async () => {
        const locale = await loadLocale(preferences.locale);
        if (disposed) return;
        mountMarkup();
        ui = mountConsole(target, {
          locale,
          missions: missionSummaries,
          command(command) {
            if (pending)
              return Promise.reject(Error("Waiting for the previous move"));
            return new Promise((resolve, reject) => {
              const timer = setTimeout(() => {
                pending = null;
                context.fetchState();
                reject(
                  Error(
                    "No confirmation yet. Please check your connection and try again.",
                  ),
                );
              }, 8000);
              pending = { resolve, reject, timer, sequence: command.sequence };
              if (!context.move(command)) {
                clearTimeout(timer);
                pending = null;
                reject(Error("The game is not ready to accept moves"));
              }
            });
          },
        });
        ui.setPlayer(seat);
        await ui.setPreferences(preferences);
        return ui;
      })().catch((error) => {
        initializing = null;
        if (!disposed) {
          target.textContent = `Space Alert: ${error.message}`;
          target.setAttribute("role", "alert");
        }
        throw error;
      });
      return initializing;
    }
    function render(state) {
      // Finished games can be opened without reinstalling an archived engine.
      const view = Array.isArray(state.timeline)
        ? snapshot(state, seat)
        : state;
      if (Array.isArray(state.timeline)) {
        view.bgs = {
          missionNumber: state.bgs.missionNumber,
          settings: state.bgs.settings,
        };
        view.careerIds = state.bgs.playerIds;
        view.explorers = state.bgs.playerIds
          .map((id) => state.bgs.explorers[id])
          .filter(Boolean)
          .map((e) => ({
            ...e,
            activeRun: !!e.activeRun,
            eligible: [],
            editable: false,
          }));
      }
      ui.render(view);
      if (pending && view.nextSequence > pending.sequence) {
        clearTimeout(pending.timer);
        const done = pending;
        pending = null;
        done.resolve(view);
      }
    }
    return {
      async onState(state) {
        lastState = state;
        await ensureUI();
        if (!disposed) render(lastState);
      },
      onMoveResult(result) {
        if (result.ok || !pending || result.move?.sequence !== pending.sequence)
          return;
        const done = pending;
        pending = null;
        clearTimeout(done.timer);
        context.fetchState();
        done.reject(Error(result.error || "Move rejected"));
      },
      onPlayer(player) {
        seat = player.index;
        ui?.setPlayer(seat);
        if (ui && lastState && !disposed) render(lastState);
      },
      onPreferences(next) {
        preferences = { ...preferences, ...next };
        void ensureUI()
          .then(() => {
            if (!disposed) return ui.setPreferences(preferences);
          })
          .catch((error) => {
            if (!disposed)
              console.error("Space Alert language loading failed", error);
          });
      },
      onError(error) {
        const el = target.querySelector("#error");
        if (el) el.textContent = String(error);
      },
      destroy() {
        disposed = true;
        ui?.destroy();
        if (pending) {
          clearTimeout(pending.timer);
          pending.reject(Error("Viewer closed"));
          pending = null;
        }
      },
    };
  },
  { tutorial: mountLesson },
);
