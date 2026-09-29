import catalog from "../mission-data/catalog.json" with { type: "json" };

export const missionSource = Object.freeze(catalog.source);
export const missionSummaries = Object.freeze(
  catalog.missions.map(({ events, ...mission }) =>
    Object.freeze({
      ...mission,
      phaseEndsMs: Object.freeze([...mission.phaseEndsMs]),
    }),
  ),
);
export function getMission(id) {
  const mission = catalog.missions.find((m) => m.id === id);
  if (!mission) throw new Error("Unknown mission");
  return structuredClone(mission);
}

export function compileTimeline(mission, crewSize) {
  const ends = mission.phaseEndsMs;
  if (![3, 4, 5].includes(crewSize))
    throw new Error("Crew size must be three, four or five");
  if (
    !Array.isArray(ends) ||
    ![2, 3].includes(ends.length) ||
    ends.some(
      (end, i) => !Number.isSafeInteger(end) || end <= (ends[i - 1] ?? 0),
    )
  )
    throw new Error("Invalid mission phases");
  const timeline = [{ atMs: 0, type: "phase-start", phase: 1 }];
  for (let i = 0; i < ends.length; i++) {
    for (const seconds of [60, 20, 5]) {
      const atMs = ends[i] - seconds * 1000;
      if (atMs >= (ends[i - 1] ?? 0))
        timeline.push({ atMs, type: "phase-warning", phase: i + 1, seconds });
    }
    timeline.push({
      atMs: ends[i],
      type: i === ends.length - 1 ? "mission-complete" : "phase-start",
      phase: i + 2,
    });
  }
  for (const event of mission.events) {
    if (
      !Number.isSafeInteger(event.atMs) ||
      event.atMs < 0 ||
      event.atMs >= ends.at(-1)
    )
      throw new Error("Event outside mission");
    if (
      ![
        "threat",
        "incoming-data",
        "data-transfer",
        "communications-down",
        "communications-restored",
      ].includes(event.type)
    )
      throw new Error("Invalid mission event");
    if (event.type === "threat" && !event.confirmed && crewSize < 5) continue;
    timeline.push(structuredClone(event));
    if (event.type === "data-transfer") {
      if (
        !Number.isSafeInteger(event.durationMs) ||
        event.durationMs <= 0 ||
        event.atMs + event.durationMs > ends.at(-1)
      )
        throw new Error("Invalid transfer window");
      timeline.push({
        atMs: event.atMs + event.durationMs,
        type: "data-transfer-end",
      });
    }
  }
  // A deadline is processed before a player request or an announcement at the
  // same instant. Stable sorting keeps simultaneous threat announcements intact.
  timeline.sort(
    (a, b) =>
      a.atMs - b.atMs ||
      Number(b.type === "phase-start" || b.type === "mission-complete") -
        Number(a.type === "phase-start" || a.type === "mission-complete"),
  );
  return timeline.map((event, index) => ({ ...event, id: `event-${index}` }));
}
