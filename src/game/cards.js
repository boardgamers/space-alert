import doubleCounts from "./double-deck.json" with { type: "json" };
export function doubleDeck() {
  return doubleCounts.flatMap(({ sides, count }, index) =>
    Array.from({ length: count }, (_, copy) => ({
      id: `double-${index}-${copy}`,
      kind: "normal",
      sides: structuredClone(sides),
    })),
  );
}
export const PHASE_TURNS = [
  [1, 3],
  [4, 7],
  [8, 12],
];
export const phaseForTurn = (turn) => (turn <= 3 ? 1 : turn <= 7 ? 2 : 3);
export const SPECIALIZATIONS = [
  "rocketeer",
  "data-analyst",
  "energy-technician",
  "pulse-gunner",
  "medic",
  "teleporter",
  "hypernavigator",
  "special-ops",
  "squad-leader",
  "mechanic",
];
// Component counts independently agree in the BGG component inventory and the
// original SpaceAlertWeb inventory. See docs/components.md for provenance.
export function baseDeck() {
  return ["red", "blue", "lift"].flatMap((movement) =>
    Object.entries({ A: 10, B: 8, C: 7, bots: 5 }).flatMap(([action, count]) =>
      Array.from({ length: count }, (_, n) => ({
        id: `${action}-${movement}-${n}`,
        kind: "normal",
        sides: [[action], [movement]],
      })),
    ),
  );
}
export function heroicDeck() {
  return [
    ["A", "blue-lower"],
    ["A", "red-lower"],
    ["B", "blue-upper"],
    ["B", "red-upper"],
    ["bots", "white-lower"],
    ["bots", "white-upper"],
  ].map(([action, station], n) => ({
    id: `hero-${n}`,
    kind: "heroic",
    sides: [[`hero:${action}`], [`teleport:${station}`]],
  }));
}
export function specializationCards(name, level, owner) {
  if (!SPECIALIZATIONS.includes(name) || ![1, 2, 3].includes(level))
    throw Error("Invalid specialization");
  const card = (tier) => ({
    id: `special-${owner}-${tier}`,
    owner,
    kind: "special",
    sides:
      tier === 1
        ? [[`special:${name}:basic`]]
        : [[`special:${name}:advanced`], [`special:${name}:basic`]],
  });
  return level === 1 ? [card(1)] : level === 2 ? [card(2)] : [card(1), card(2)];
}
export function cardBack(card, side) {
  const actions = card.sides[side];
  return {
    kind: card.kind,
    category: /^(red|blue|lift|teleport:)/.test(actions[0])
      ? "movement"
      : "action",
    double: actions.length === 2,
  };
}
