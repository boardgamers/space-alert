const $ = (selector) => document.querySelector(selector);
const escape = (text) =>
  String(text).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
let seat = Number(new URL(location.href).searchParams.get("seat") ?? 0),
  view,
  received = 0,
  pending = false,
  revision = "";
const duration = (ms) => {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
};
function text(event) {
  if (event.type === "threat")
    return `T+${event.turn} · ${event.confirmed ? "" : "Unconfirmed · "}${event.severity === "serious" ? "Serious " : ""}${event.position} threat${event.zone ? " · " + event.zone + " zone" : ""}`;
  return (
    {
      "phase-start": `Phase ${event.phase} begins`,
      "phase-warning": `Phase ${event.phase} ends in ${event.seconds} seconds`,
      "incoming-data": "Incoming data",
      "data-transfer": "Data transfer window opens",
      "data-transfer-end": "Data transfer complete",
      "communications-down": "Communication system down",
      "communications-restored": "Communications restored",
    }[event.type] ?? event.type
  );
}
function render(next) {
  view = next;
  if (!view.players[seat]) {
    seat = 0;
    history.replaceState(null, "", "?seat=0");
  }
  received = performance.now();
  const key = `${view.createdAt ?? view.presenceDeadline}/${view.revision}/${seat}`;
  if (key === revision) return;
  revision = key;
  const own = view.players[seat];
  $("#seat").innerHTML = view.players
    .map(
      (p) =>
        `<option value="${p.seat}" ${p.seat === seat ? "selected" : ""}>Player ${p.seat + 1}</option>`,
    )
    .join("");
  $("#status").textContent = {
    presence: "Presence check",
    countdown: "Launch countdown",
    programming: view.mission.title,
    resolution: "Ready for resolution",
    cancelled: "Session cancelled",
  }[view.stage];
  $("#crew").innerHTML = view.players
    .map(
      (p) =>
        `<div class="crew-member"><span class="indicator ${p.ready ? "ready" : ""}"></span><strong>Player ${p.seat + 1}${p.seat === seat ? " · you" : ""}</strong><small>${p.finishedPlanning ? "Plan locked" : p.planningPhase ? "Planning phase " + p.planningPhase : p.ready ? "Ready" : "Not confirmed"}</small></div>`,
    )
    .join("");
  $("#controls").innerHTML =
    view.stage === "presence"
      ? `<button data-command="ready" ${own?.ready ? "disabled" : ""}>${own?.ready ? "Presence confirmed" : "I’m here · ready"}</button>`
      : view.stage === "programming"
        ? `<button data-command="advance-phase" ${own?.finishedPlanning || own?.planningPhase >= view.mission.phaseEndsMs.length ? "disabled" : ""}>Next planning phase</button><button class="secondary" data-command="finish-planning" ${own?.finishedPlanning || view.phase < view.mission.phaseEndsMs.length ? "disabled" : ""}>Finish my plan</button>`
        : "";
  $("#player-help").textContent =
    view.stage === "presence"
      ? "Everyone must confirm within two minutes. The clock starts together."
      : view.stage === "programming"
        ? "Advancing locks your earlier turns; other players can keep planning theirs."
        : view.stage === "resolution"
          ? "Programming is locked. Ship resolution is the next implementation step."
          : view.stage === "cancelled"
            ? `Missing: ${view.cancellation.missingSeats.map((s) => "Player " + (s + 1)).join(", ")}. No defeat recorded.`
            : "All crew confirmed. Stand by.";
  for (const el of document.querySelectorAll("[data-phase]")) {
    el.classList.toggle("active", Number(el.dataset.phase) === view.phase);
    el.hidden = Number(el.dataset.phase) > view.mission.phaseEndsMs.length;
  }
  $("#comms").textContent = view.communicationsAvailable
    ? "ONLINE"
    : "BLACKOUT";
  $("#comms").classList.toggle("offline", !view.communicationsAvailable);
  const announcements = view.log
    .filter((e) => e.type === "announcement")
    .slice(-7)
    .reverse();
  $("#latest").textContent =
    view.stage === "resolution"
      ? "Mission programming complete."
      : view.stage === "cancelled"
        ? "Launch cancelled."
        : announcements[0]
          ? text(announcements[0].event)
          : "Awaiting crew confirmation.";
  $("#announcements").innerHTML = announcements
    .slice(1)
    .map(
      (item) =>
        `<li><time>${duration(item.at - view.missionStartAt)}</time><span>${escape(text(item.event))}</span></li>`,
    )
    .join("");
  $("#ready-all").disabled = view.stage !== "presence";
}
function tick() {
  if (view) {
    const now = view.serverNow + performance.now() - received;
    const end =
      view.stage === "presence"
        ? view.presenceDeadline
        : view.stage === "countdown"
          ? view.missionStartAt
          : view.stage === "programming"
            ? view.missionStartAt + view.mission.phaseEndsMs.at(-1)
            : now;
    $("#clock").textContent = duration(end - now);
    $("#clock-caption").textContent =
      view.stage === "presence"
        ? "Time left to confirm presence"
        : view.stage === "countdown"
          ? "Until the mission starts"
          : view.stage === "programming"
            ? "Mission time remaining"
            : view.stage === "resolution"
              ? "Programs locked · clock stopped"
              : "Presence deadline reached";
  }
  requestAnimationFrame(tick);
}
async function refresh() {
  if (pending) return;
  try {
    const response = await fetch(`/api/state?seat=${seat}`);
    if (!response.ok) throw Error("Connection lost");
    render(await response.json());
    $("#connection").textContent = "LOCAL HOST";
  } catch {
    $("#connection").textContent = "RECONNECTING";
  }
}
async function command(type, target = seat) {
  const state = await fetch(`/api/state?seat=${target}`).then((r) => r.json());
  const response = await fetch(`/api/command?seat=${target}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, sequence: state.nextSequence }),
  });
  const result = await response.json();
  if (!result.accepted) throw Error(result.error);
  if (target === seat) render(result.view);
}
async function perform(fn) {
  pending = true;
  $("#error").textContent = "";
  try {
    await fn();
  } catch (error) {
    $("#error").textContent = error.message;
  } finally {
    pending = false;
    await refresh();
  }
}
$("#controls").onclick = (event) => {
  const button = event.target.closest("[data-command]");
  if (button && !pending) perform(() => command(button.dataset.command));
};
$("#seat").onchange = () => {
  seat = Number($("#seat").value);
  history.replaceState(null, "", `?seat=${seat}`);
  revision = "";
  refresh();
};
$("#ready-all").onclick = () =>
  perform(async () => {
    for (const player of view.players)
      if (!player.ready) await command("ready", player.seat);
  });
$("#new").onclick = () =>
  perform(async () => {
    const players = Number($("#players").value);
    seat = Math.min(seat, players - 1);
    const response = await fetch(`/api/new?seat=${seat}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mission: $("#mission").value, players }),
    });
    const result = await response.json();
    if (!response.ok) throw Error(result.error);
    render(result);
  });
const missions = await fetch("/api/missions").then((r) => r.json());
$("#mission").innerHTML = missions
  .map(
    (m) =>
      `<option value="${escape(m.id)}" ${m.id === "realmission1" ? "selected" : ""}>${escape(m.title)} · ${duration(m.phaseEndsMs.at(-1))}</option>`,
  )
  .join("");
await refresh();
setInterval(refresh, 750);
tick();
