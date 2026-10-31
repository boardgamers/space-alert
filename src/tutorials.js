// Small, original teaching scenarios. They use the same planning and resolution
// code as missions; only their clock is advanced explicitly by the local host.
import { createSession, submit, advanceClock } from "./session.js";
import { TRACKS } from "./game/catalog.js";
const lesson = (id, title, instructions, options = {}) => ({
  id,
  title,
  instructions,
  ...options,
});
export const LESSONS = [
  lesson("basics", "lesson.basics.title", [], { basics: true }),
  lesson(
    "planning-phases",
    "lesson.planning-phases.title",
    ["lesson.planning-phases.instruction.0"],
    { phaseLesson: true, threat: "E1-10", turn: 6 },
  ),
  lesson(
    "first-shot",
    "lesson.first-shot.title",
    ["lesson.first-shot.instruction.0"],
    { threat: "E1-07", turn: 2 },
  ),
  lesson("energy", "lesson.energy.title", [
    "lesson.energy.instruction.0",
    "lesson.energy.instruction.1",
  ]),
  lesson(
    "repairs",
    "lesson.repairs.title",
    ["lesson.repairs.instruction.0", "lesson.repairs.instruction.1"],
    { threat: "I1-05", turn: 2 },
  ),
  lesson("battlebots", "lesson.battlebots.title", [
    "lesson.battlebots.instruction.0",
    "lesson.battlebots.instruction.1",
  ]),
  lesson(
    "double-actions",
    "lesson.double-actions.title",
    [
      "lesson.double-actions.instruction.0",
      "lesson.double-actions.instruction.1",
    ],
    { doubleActions: true },
  ),
  lesson(
    "phasing",
    "lesson.phasing.title",
    ["lesson.phasing.instruction.0", "lesson.phasing.instruction.1"],
    { threat: "E2-102", turn: 1 },
  ),
  lesson(
    "specializations",
    "lesson.specializations.title",
    [
      "lesson.specializations.instruction.0",
      "lesson.specializations.instruction.1",
    ],
    {
      specializations: [
        { name: "rocketeer", level: 3 },
        { name: "data-analyst", level: 1 },
        { name: "medic", level: 1 },
        { name: "teleporter", level: 1 },
      ],
    },
  ),
];
export function createLesson(id, now, { timing = false } = {}) {
  const l = LESSONS.find((l) => l.id === id);
  if (!l) throw Error("Unknown lesson");
  const mission = {
    id: `lesson-${id}`,
    title: l.title,
    doubleActions: !!l.doubleActions,
    phaseEndsMs: [300000, 600000],
    events: l.threat
      ? [
          {
            atMs: l.phaseLesson ? 2000 : 0,
            type: "threat",
            confirmed: true,
            turn: l.turn,
            position: l.threat.startsWith("I") ? "internal" : "external",
            severity: "normal",
            zone: l.threat.startsWith("I") ? undefined : "white",
          },
        ]
      : [],
  };
  let s = createSession(
    {
      players: 1,
      mission,
      gameOptions: {
        seed: `lesson/${id}`,
        threatExpansion: true,
        difficulty: [1, 2, 3],
        threatAssignments: l.threat ? [l.threat] : [],
        specializations: l.specializations ?? [],
      },
    },
    now,
  );
  if (timing && l.basics) {
    // A deliberately shortened tutorial fixture: one planning phase, three
    // executed turns. Normal mission validation still requires two or three phases.
    s.mission.phaseEndsMs = [600000];
    s.timeline = [
      { atMs: 0, type: "phase-start", phase: 1 },
      { atMs: 595000, type: "phase-warning", phase: 1, seconds: 5 },
      { atMs: 600000, type: "mission-complete", phase: 2 },
    ];
  }
  s = submit(s, 0, { type: "ready", sequence: 1 }, now).state;
  s = advanceClock(s, now + 3000);
  s.tutorial = {
    id,
    title: l.title,
    instructions: l.instructions,
    basics: !!l.basics,
    phaseLesson: !!l.phaseLesson,
    targetStation: l.basics ? "blue-lower" : undefined,
    clockRunning: false,
    ...(timing && l.basics
      ? { timing: true, scenario: "early", clockStarted: false }
      : {}),
    ...(l.phaseLesson
      ? { timing: true, clockStarted: false, targetStation: "blue-lower" }
      : {}),
  };
  s.game.tracks = Object.fromEntries(
    ["red", "white", "blue", "internal"].map((z) => [
      z,
      structuredClone(TRACKS[6]),
    ]),
  );
  // Public, editable teammate example, using physical cards from the shared solo deck.
  for (const turn of [1, 4]) {
    const id = s.game.hands[0].find((id) =>
      s.game.cards[id].sides.some(
        (side) => side.length === 1 && side[0] === "C",
      ),
    );
    const side = s.game.cards[id].sides.findIndex(
      (side) => side.length === 1 && side[0] === "C",
    );
    s.game.hands[0] = s.game.hands[0].filter((c) => c !== id);
    s.game.programs[1][turn - 1] = { cards: [{ id, side }] };
    s.game.slotVersions[1][turn - 1]++;
  }
  if (l.basics || l.phaseLesson) {
    // A small physical hand makes spending and reusing actions visible.
    const remaining = { red: 2, blue: 2, lift: 2 };
    s.game.hands[0] = s.game.hands[0].filter((id) => {
      const action = s.game.cards[id].sides.find(
        (side) => side.length === 1 && remaining[side[0]] > 0,
      )?.[0];
      if (!action) return false;
      remaining[action]--;
      return true;
    });
  }
  return s;
}
