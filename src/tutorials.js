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
    "first-shot",
    ["Votre premier tir", "Your first shot"],
    [
      [
        "La menace arrive au tour 2. Le T+ indique un tour de résolution, pas une minute. Les androïdes sont tous au centre ; le second s’occupe déjà de l’ordinateur.",
        "The threat arrives on turn 2. T+ is a resolution turn, not a minute. Everyone starts on the bridge; android 2 already handles the computer.",
      ],
      [
        "Avec l’androïde 1, programmez A aux tours 2 et 3. Les tirs du laser central coûtent chacun 1 énergie. Le bouclier ennemi s’applique de nouveau à chaque tour.",
        "For android 1, program A on turns 2 and 3. Each central laser shot uses 1 energy. Enemy shields apply again each turn.",
      ],
      [
        "Passez à la phase 2, puis lancez la résolution. Suivez le journal : les tirs combinés du tour précèdent le mouvement de la menace. Vous pouvez recommencer et comparer.",
        "Advance to phase 2, then resolve. Watch the log: a turn’s combined fire happens before threat movement. Restart and compare different programs.",
      ],
    ],
    { threat: "E1-07", turn: 2 },
  ),
  lesson(
    "energy",
    ["Énergie et coordination", "Energy and coordination"],
    [
      [
        "Le réacteur central commence avec 3 énergies. Le laser lourd et l’impulsion utilisent cette même réserve ; B à l’étage recharge le bouclier, pas le réacteur.",
        "The central reactor starts with 3 energy. Heavy laser and pulse share it; B upstairs fills the shield, not the reactor.",
      ],
      [
        "Androïde 1 : A, A, A aux tours 1–3, puis A au tour 4. Sans ravitaillement, ce dernier tir échouera. Essayez ensuite : androïde 3, ascenseur au tour 1 puis B au tour 2.",
        "Android 1: A, A, A on turns 1–3, then A on turn 4. Without refueling, that last shot fails. Then try android 3: lift on turn 1, B on turn 2.",
      ],
      [
        "Dans la résolution, vérifiez la capsule consommée, l’énergie disponible et les tirs sans effet. Chaque arme ne peut tirer qu’une fois par tour, même si deux équipiers utilisent A.",
        "During resolution, check the consumed capsule, available energy and failed shots. Each weapon can fire only once per turn, even if two crew use A.",
      ],
    ],
  ),
  lesson(
    "repairs",
    ["Réparer une panne", "Repairing a malfunction"],
    [
      [
        "La panne apparaît en haut à droite au tour 2. Une panne détourne le bouton indiqué : il répare au lieu d’utiliser le système.",
        "The malfunction appears in upper right on turn 2. It overrides the indicated button: that button repairs instead of using the system.",
      ],
      [
        "Androïde 1 : flèche droite au tour 1, puis B aux tours 2, 3 et 4. Inspectez la carte de menace pour lire ses vies et ses actions X/Y/Z.",
        "Android 1: right arrow on turn 1, then B on turns 2, 3 and 4. Inspect the threat card for hit points and X/Y/Z effects.",
      ],
      [
        "Un B joué avant l’apparition aurait chargé le bouclier au lieu de réparer. Comparez les résultats en modifiant le programme après avoir recommencé.",
        "A B before the threat appears would fill the shield instead of repairing. Restart and change your program to compare.",
      ],
    ],
    { threat: "I1-05", turn: 2 },
  ),
  lesson(
    "battlebots",
    ["Robots et intercepteurs", "Battlebots and interceptors"],
    [
      [
        "Les robots attendent en haut à droite et en bas à gauche. C prend une escouade ; le symbole robot est une action distincte qui combat les intrus.",
        "Battlebots wait in upper right and lower left. C picks up a squad; the battlebot symbol is a separate action for fighting intruders.",
      ],
      [
        "Androïde 1 : flèche droite, C, flèche gauche aux tours 1–3. En phase 2 : flèche gauche puis C pour décoller depuis la salle en haut à gauche avec vos robots.",
        "Android 1: right arrow, C, left arrow on turns 1–3. In phase 2: left arrow, then C to launch from upper left with your battlebots.",
      ],
      [
        "En vol : robot pour rester et tirer ; une case vide vous fait rentrer. Une autre action est retardée au retour. Les robots désactivés ne permettent pas de décoller.",
        "In flight: battlebot action to stay and fire; an empty slot returns you. Other actions are delayed on return. Disabled battlebots cannot launch.",
      ],
    ],
  ),
  lesson(
    "double-actions",
    ["Deux actions, dans l’ordre", "Two actions, in order"],
    [
      [
        "Ce paquet contient des cartes à deux actions. Choisissez une moitié comme d’habitude : ses deux symboles s’exécutent de gauche à droite.",
        "This deck has double-action cards. Choose a half normally: its two symbols execute left to right.",
      ],
      [
        "Comparez flèche droite + A avec A + flèche droite au tour 2 : le laser utilisé change. Vous ne pouvez pas volontairement ignorer une moitié réalisable.",
        "Compare right arrow + A with A + right arrow on turn 2: they fire different lasers. You cannot voluntarily skip a performable half.",
      ],
      [
        "Si la première moitié provoque un retard (ascenseur occupé, Slime), la seconde passe au tour suivant. Les intercepteurs peuvent désormais changer de portée avec les doubles actions.",
        "If the first half causes a delay (busy lift, Slime), the second moves to the next turn. Double actions also let interceptors change range.",
      ],
    ],
    { doubleActions: true },
  ),
  lesson(
    "phasing",
    ["Menaces de l’extension", "Expansion threats"],
    [
      [
        "Le chasseur apparaît au tour 1. Dépliez sa carte : il alterne un tour visible et un tour déphasé. Les attaques entre crochets concernent les tours déphasés.",
        "The fighter appears on turn 1. Open its card: it alternates a visible turn and a phased-out turn. Bracketed attacks apply on phased-out turns.",
      ],
      [
        "Essayez A aux tours 1, 2 et 3. Pendant le tour déphasé, votre arme l’ignore totalement et pourrait toucher une autre cible derrière lui.",
        "Try A on turns 1, 2 and 3. While phased out, it is ignored completely and a weapon could hit another target behind it.",
      ],
      [
        "Le catalogue ajoute aussi plasma, mégaboucliers, renforts et intrus spéciaux. Chaque carte décrit ses exceptions ; les renforts sont révélés avec la menace qui peut les appeler.",
        "Other new threats introduce plasma, megashields, reinforcements and special intruders. Each card explains its exceptions; reinforcements are revealed with their potential caller.",
      ],
    ],
    { threat: "E2-102", turn: 1 },
  ),
  lesson(
    "specializations",
    ["Spécialisations", "Specializations"],
    [
      [
        "Les spécialisations remplacent les cartes héroïques. Niveau 1 : une capacité basique ; niveau 2 : une carte permettant basique ou avancée ; niveau 3 : les deux cartes.",
        "Specializations replace heroic cards. Level 1: one basic ability; level 2: one card with basic or advanced; level 3: both cards.",
      ],
      [
        "L’androïde 1 est Artilleur niveau 3. Essayez sa capacité basique depuis la passerelle : la roquette part à distance et touche au tour suivant. Lisez l’aide affichée quand vous sélectionnez une capacité.",
        "Android 1 is a level-3 Rocketeer. Try the basic ability from the bridge: it launches remotely and hits next turn. Selecting an ability shows its rules.",
      ],
      [
        "Une carte de spécialisation ne s’échange pas. Le Médecin et l’Agent spécial peuvent combiner certaines cartes ; le Téléporteur place ses jetons pendant les transferts. En partie libre, choisissez les spécialités dans la configuration.",
        "Specialization cards cannot be transferred. Medic and Special Ops can combine some cards; Teleporter assigns tokens during transfers. Choose specialties in setup for free play.",
      ],
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
    phaseEndsMs: [600000, 1200000],
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
  s.tutorial = { id, title: l.title, instructions: l.instructions };
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
  return s;
}
