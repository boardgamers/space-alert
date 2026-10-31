import { translate } from "./i18n.js";

export function duration(ms) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function practiceClockText(view, locale, elapsed = 0) {
  const paused = !view.tutorial.clockRunning;
  const remaining =
    view.stage === "resolution" && view.tutorial.timing
      ? (view.tutorial.remainingMs ?? 0)
      : view.stage === "programming"
        ? view.missionStartAt +
          view.mission.phaseEndsMs.at(-1) -
          (view.serverNow ?? view.observedAt) -
          (paused ? 0 : elapsed)
        : 0;
  return (
    duration(remaining) +
    (paused && view.stage === "programming" ? translate(locale, "app.paused") : "")
  );
}
