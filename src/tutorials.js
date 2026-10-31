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
  lesson(
    "basics",
    ["Commencer ici : programmer les tours", "Start here: planning turns"],
    [],
    { basics: true },
  ),
  lesson(
    "first-shot",
    ["Votre premier tir", "Your first shot"],
    [["Détruisez la cible avec le laser surligné.",
      "Destroy the target with the highlighted laser."]],
    { threat: "E1-07", turn: 2 },
  ),
  lesson(
    "energy",
    ["Énergie et coordination", "Energy and coordination"],
    [
      [
        "Alimentez le laser central pour tirer quatre fois.",
        "Power the central laser for four shots."
      ],
      [
        "Androïde 1 : armes aux tours 1–4. Androïde 3 : ascenseur, puis énergie pour ravitailler le réacteur.",
        "Android 1: weapons on turns 1–4. Android 3: lift, then energy to refill the reactor."
      ]
    ],
  ),
  lesson(
    "repairs",
    ["Réparer une panne", "Repairing a malfunction"],
    [
      [
        "Réparez la panne surlignée.",
        "Repair the highlighted malfunction."
      ],
      [
        "→ au tour 1, puis énergie aux tours 2–4.",
        "→ on turn 1, then energy on turns 2–4."
      ]
    ],
    { threat: "I1-05", turn: 2 },
  ),
  lesson(
    "battlebots",
    ["Robots et intercepteurs", "Battlebots and interceptors"],
    [
      [
        "Prenez les robots, puis rejoignez les intercepteurs.",
        "Collect the battlebots, then reach the interceptors."
      ],
      [
        "→ · systèmes · ← · ← · systèmes. En vol, jouez robots pour tirer ; laissez vide pour rentrer.",
        "→ · systems · ← · ← · systems. In flight, play battlebots to fire; leave a slot empty to return."
      ]
    ],
  ),
  lesson(
    "double-actions",
    ["Deux actions, dans l’ordre", "Two actions, in order"],
    [
      [
        "Déplacez-vous et tirez avec une seule carte.",
        "Move and fire with one card."
      ],
      [
        "Comparez → + armes et armes + → : l’ordre choisit le laser utilisé.",
        "Compare → + weapons with weapons + →: the order determines which laser fires."
      ]
    ],
    { doubleActions: true },
  ),
  lesson(
    "phasing",
    ["Menaces de l’extension", "Expansion threats"],
    [
      [
        "Touchez le chasseur lorsqu’il est visible.",
        "Hit the fighter while it is visible."
      ],
      [
        "Armes aux tours 1–3. Observez le tir ignoré pendant son déphasage.",
        "Weapons on turns 1–3. Watch the missed shot while it is phased out."
      ]
    ],
    { threat: "E2-102", turn: 1 },
  ),
  lesson(
    "specializations",
    ["Spécialisations", "Specializations"],
    [
      [
        "Lancez une roquette à distance avec l’Artilleur.",
        "Launch a rocket remotely with the Rocketeer."
      ],
      [
        "Programmez sa capacité basique au tour 1. La roquette frappe au tour suivant.",
        "Program the basic ability on turn 1. The rocket hits next turn."
      ]
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
export function createLesson(id, now) {
  const l = LESSONS.find((l) => l.id === id);
  if (!l) throw Error("Unknown lesson");
  const mission = {
    id: `lesson-${id}`,
    title: l.title[1],
    doubleActions: !!l.doubleActions,
    phaseEndsMs: [300000, 600000],
    events: l.threat
      ? [
          {
            atMs: 0,
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
  s = submit(s, 0, { type: "ready", sequence: 1 }, now).state;
  s = advanceClock(s, now + 3000);
  s.tutorial = {
    id,
    title: l.title,
    instructions: l.instructions,
    basics: !!l.basics,
    targetStation: l.basics ? "blue-lower" : undefined,
    clockRunning: false,
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
  if (l.basics) {
    // A small physical hand makes spending and reusing actions visible.
    const remaining = { red: 2, blue: 2, lift: 2 };
    s.game.hands[0] = s.game.hands[0].filter(id => {
      const action = s.game.cards[id].sides.find(side => side.length === 1 && remaining[side[0]] > 0)?.[0];
      if (!action) return false;
      remaining[action]--;
      return true;
    });
  }
  return s;
}
