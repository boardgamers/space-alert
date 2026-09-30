import { registerViewer } from "@boardgamers/protocol/viewer";
import { mountConsole } from "../preview/app.js";
import html from "../preview/index.html";
import css from "../preview/style.css";
import { snapshot } from "../src/view.js";
const missionSummaries = BGS_MISSIONS;

registerViewer("SpaceAlert", (context) => {
  const { target } = context;
  const style = document.createElement("style");
  style.textContent =
    css +
    `
 .bgs-hosted #setup,.bgs-hosted #lessons,.bgs-hosted #create-explorer,.bgs-hosted #seat,.bgs-hosted #ready-all,.bgs-hosted #next-event,.bgs-hosted #footer,.bgs-hosted #open-setup {display:none!important}
 .bgs-hosted #career-manager:has(#explorers:empty) {display:none}
 `;
  target.innerHTML = html
    .split("<body>")[1]
    .split('<script type="module"')[0]
    .split("</body>")[0];
  target.prepend(style);
  let seat, pending, lastState;
  const ui = mountConsole(target, {
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
  ui.setPlayer(undefined);
  const presence = setInterval(() => {
    if (
      document.visibilityState !== "visible" ||
      pending ||
      !lastState?.players[seat]?.ready
    )
      return;
    if (["presence", "countdown"].includes(lastState.stage))
      context.move({ type: "presence" });
  }, 2000);
  function render(state) {
    lastState = state;
    // Finished games can be opened without reinstalling an archived engine.
    const view = Array.isArray(state.timeline) ? snapshot(state, seat) : state;
    if (Array.isArray(state.timeline)) {
      view.bgs = {
        missionNumber: state.bgs.missionNumber,
        settings: state.bgs.settings,
      };
      view.careerIds = state.bgs.playerIds;
      view.explorers = Object.values(state.bgs.explorers).map((e) => ({
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
    onState: render,
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
      ui.setPlayer(seat);
      if (lastState) render(lastState);
    },
    onPreferences: (preferences) => ui.setPreferences(preferences),
    onError(error) {
      const el = target.querySelector("#error");
      if (el) el.textContent = String(error);
    },
    destroy() {
      clearInterval(presence);
      ui.destroy();
      if (pending) {
        clearTimeout(pending.timer);
        pending.reject(Error("Viewer closed"));
        pending = null;
      }
    },
  };
});
