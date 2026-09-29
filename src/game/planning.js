import {
  createCampaign,
  recordMission,
  voteCampaign,
  repairCampaign,
} from "./campaign.js";
import {
  baseDeck,
  doubleDeck,
  heroicDeck,
  specializationCards,
  cardBack,
  PHASE_TURNS,
  phaseForTurn,
  SPECIALIZATIONS,
} from "./cards.js";
import { TRACKS, THREATS, threatById } from "./catalog.js";
import { shuffle, random } from "./random.js";
import {
  beginResolution,
  stepResolution,
  resolveAll,
  createShip,
} from "./resolution.js";
const requireRule = (condition, message) => {
  if (!condition) throw Error(message);
};
export function createGame(
  state,
  {
    seed = "preview",
    specializations = [],
    threatExpansion = false,
    difficulty = 1,
    seriousDifficulty = difficulty,
    actionDeck,
    threatAssignments,
    campaign = null,
    campaignLimit = 0,
    carried = campaign?.carried ?? null,
    excludeThreats = [],
  } = {},
) {
  const commonPool = Array.isArray(difficulty) ? difficulty : [difficulty],
    seriousPool = Array.isArray(seriousDifficulty)
      ? seriousDifficulty
      : [seriousDifficulty];
  requireRule(
    [commonPool, seriousPool].every(
      (pool) =>
        pool.length &&
        pool.every((n) => [1, 2, 3].includes(n) && (threatExpansion || n < 3)),
    ),
    "Invalid threat difficulty",
  );
  requireRule(
    !specializations.length ||
      (specializations.length === state.crewSize &&
        new Set(specializations.filter(Boolean).map((x) => x.name)).size ===
          specializations.filter(Boolean).length),
    "Each crew member needs a different specialization",
  );
  const rng = random(seed),
    deck = shuffle(
      actionDeck ?? (state.mission.doubleActions ? doubleDeck() : baseDeck()),
      rng,
    ),
    heroes = shuffle(heroicDeck(), rng),
    tracks = shuffle(TRACKS, rng);
  const humans = state.players.length,
    solo = humans === 1;
  const g = {
    seed,
    carried,
    campaign:
      campaign ?? (campaignLimit ? createCampaign(seed, campaignLimit) : null),
    solo,
    threatExpansion,
    difficulty,
    seriousDifficulty,
    specializations: structuredClone(specializations),
    cards: Object.fromEntries(deck.map((c) => [c.id, c])),
    deck: deck.map((c) => c.id),
    hands: Array.from({ length: humans }, () => []),
    packets: [],
    programs: Array.from({ length: state.crewSize }, () =>
      Array(12).fill(null),
    ),
    slotVersions: Array.from({ length: state.crewSize }, () =>
      Array(12).fill(0),
    ),
    dealt: Array(humans).fill(0),
    androidCards: [],
    threats: [],
    assignedThreats: [],
    transferUsed: [],
    dataCredits: Array(humans).fill(0),
    androidDataCredits: 0,
    androidDataDraws: Array(humans).fill(0),
    teleportTokens: Array.from({ length: state.crewSize }, (_, id) => [id, id]),
    tracks: Object.fromEntries(
      ["red", "white", "blue", "internal"].map((z, i) => [z, tracks[i]]),
    ),
    initialShip: createShip(state.crewSize, seed, carried),
    resolution: null,
  };
  function add(card) {
    g.cards[card.id] = card;
    return card.id;
  }
  if (solo) {
    g.hands[0] = g.deck.splice(0);
  }
  for (let seat = 0; seat < humans; seat++) {
    const counts = solo
      ? [0, 0, 0]
      : humans === 2
        ? [9, 6, 6]
        : humans === 3
          ? [6, 6, 6]
          : [5, 5, 5];
    if (!solo && humans < 5 && state.crewSize === 5) counts[0]++;
    if (!solo && !specializations.length) counts[0]--;
    if (!solo && specializations.length)
      counts[0] +=
        Math.floor((state.crewSize - humans) / humans) +
        (seat < (state.crewSize - humans) % humans ? 1 : 0);
    g.packets[seat] = counts.map((n) => g.deck.splice(0, n));
    if (!solo) {
      if (specializations.length) {
        if (specializations[seat])
          g.packets[seat][0].push(
            ...specializationCards(
              specializations[seat].name,
              specializations[seat].level,
              seat,
            ).map(add),
          );
      } else g.packets[seat][0].push(add({ ...heroes.pop(), owner: seat }));
    }
  }
  for (let crew = solo ? 0 : humans; crew < state.crewSize; crew++) {
    const cards = specializations.length
      ? specializations[crew]
        ? specializationCards(
            specializations[crew].name,
            specializations[crew].level,
            crew,
          )
        : []
      : [{ ...heroes.pop(), owner: crew }];
    g.androidCards.push(...cards.map(add));
  }
  const pools = {};
  for (const position of ["external", "internal"])
    for (const severity of ["normal", "serious"])
      pools[`${position}/${severity}`] = shuffle(
        THREATS.filter(
          (t) =>
            t.position === position &&
            t.severity === severity &&
            (severity === "serious" ? seriousPool : commonPool).includes(
              t.difficulty,
            ) &&
            !excludeThreats.includes(t.id) &&
            (!t.expansion || threatExpansion),
        ),
        rng,
      );
  const scheduled = state.timeline.filter((e) => e.type === "threat");
  for (const [index, event] of scheduled.entries()) {
    const key = `${event.position}/${event.severity}`;
    const explicit = threatAssignments?.[index];
    let card = explicit ? threatById(explicit) : pools[key].pop();
    requireRule(
      card,
      `Not enough cards in ${key}; choose a larger difficulty pool`,
    );
    requireRule(
      card.position === event.position && card.severity === event.severity,
      "Threat assignment has wrong category",
    );
    g.assignedThreats.push({
      eventId: event.id,
      instance: index,
      cardId: card.id,
      turn: event.turn,
      zone: event.zone,
    });
  }
  function additional(card, depth = 0) {
    requireRule(depth < 12, "Threat call chain too long");
    const e = Object.values(card.effects)
      .flat()
      .find((e) => e.type === "call");
    const draw = (position, severity) => {
      const found = pools[`${position}/${severity}`].pop();
      requireRule(found, `No cards left in ${position}/${severity} deck`);
      return { cardId: found.id, ...additional(found, depth + 1) };
    };
    return {
      ...(e ? { calledCard: draw(e.position, e.severity) } : {}),
      ...(card.vortex ? { vortexCard: draw("internal", "normal") } : {}),
    };
  }
  for (const t of g.assignedThreats)
    Object.assign(t, additional(threatById(t.cardId)));
  return g;
}
export function dealPhase(state, seat, phase) {
  const g = state.game;
  if (!g) return;
  while (g.dealt[seat] < phase) {
    g.hands[seat].push(...g.packets[seat][g.dealt[seat]]);
    g.dealt[seat]++;
  }
}
export function onAnnouncement(state, event) {
  const g = state.game;
  if (!g) return;
  if (event.type === "phase-start")
    for (const p of state.players) dealPhase(state, p.seat, p.planningPhase);
  if (event.type === "threat")
    g.threats.push(
      structuredClone(g.assignedThreats.find((t) => t.eventId === event.id)),
    );
  if (event.type === "incoming-data" && !g.solo) {
    const extra = state.mission.doubleActions
      ? state.crewSize - state.players.length
      : 0;
    for (const p of state.players)
      g.dataCredits[p.seat] += 1 + Math.floor(extra / state.players.length);
    g.androidDataCredits += extra % state.players.length;
  }
  if (event.type === "data-transfer") g.transferUsed = [];
  if (g.solo && event.type === "communications-down")
    state.communicationsAvailable = true;
}
export function finishGamePlanning(state) {
  const g = state.game;
  if (!g) return;
  const programs = g.programs.map((p) =>
    p.map((entry) =>
      entry
        ? {
            actions: entry.cards.flatMap(
              ({ id, side }) => g.cards[id].sides[side],
            ),
            protected: entry.cards.some(({ id, side }) =>
              g.cards[id].sides[side].includes("special:special-ops:advanced"),
            ),
          }
        : null,
    ),
  );
  g.resolution = beginResolution({
    crewSize: state.crewSize,
    seed: g.seed,
    programs,
    threats: g.threats,
    tracks: g.tracks,
    doubleActions: state.mission.doubleActions,
    turns: state.mission.phaseEndsMs.length === 2 ? 7 : 12,
    teleportTokens: g.teleportTokens,
    carried: g.carried,
  });
}
export const GAME_COMMAND_FIELDS = {
  program: ["crew", "turn", "cards", "slotVersion"],
  remove: ["crew", "turn", "slotVersion"],
  transfer: ["card", "to"],
  draw: ["android"],
  teleport: ["crew", "from", "to"],
  resolve: ["all"],
  "campaign-vote": ["continue"],
  "campaign-repair": ["crew", "zone", "tile", "bot", "skip"],
};
function editable(state, seat, crew, turn) {
  const g = state.game,
    p = state.players[seat];
  requireRule(
    state.stage === "programming" && !p.finishedPlanning,
    "Programming is closed",
  );
  requireRule(
    Number.isInteger(crew) && crew >= 0 && crew < state.crewSize,
    "Unknown crew member",
  );
  requireRule(
    g.solo || crew === seat || crew >= state.players.length,
    "You cannot program another player",
  );
  const phase =
    g.solo || crew >= state.players.length ? state.phase : p.planningPhase;
  requireRule(
    Number.isInteger(turn) &&
      turn >= PHASE_TURNS[phase - 1][0] &&
      turn <= PHASE_TURNS[phase - 1][1],
    "This turn is locked or not open yet",
  );
}
export function gameCommand(state, seat, command) {
  const g = state.game;
  requireRule(g, "Game not enabled");
  const { crew, turn } = command;
  if (command.type === "resolve") {
    requireRule(state.stage === "resolution", "Resolution has not started");
    requireRule(seat === 0, "Only the captain advances the shared resolution");
    g.resolution = command.all
      ? resolveAll(g.resolution)
      : stepResolution(g.resolution);
    if (g.resolution.outcome && g.campaign)
      g.campaign = recordMission(g.campaign, g.resolution, {
        mission: state.mission.id,
        usedSpecializations: Array.from(
          { length: state.players.length },
          (_, seat) =>
            g.resolution.log
              .filter((e) => e.type === "specialization" && e.crew === seat)
              .map((e) => `${e.name}:${e.tier}`),
        ),
        doubleActions: state.mission.doubleActions,
        humans: state.players.length,
        difficulty: g.difficulty,
        seriousDifficulty: g.seriousDifficulty,
        crew: state.crewSize,
        penalties: g.resolution.outcome.penalties,
        threatCount: state.timeline
          .filter((e) => e.type === "threat")
          .reduce((n, t) => n + (t.severity === "serious" ? 2 : 1), 0),
      });
    return;
  }
  if (command.type === "campaign-vote") {
    requireRule(g.campaign, "No campaign");
    g.campaign = voteCampaign(
      g.campaign,
      seat,
      command.continue,
      state.players.length,
    );
    return;
  }
  if (command.type === "campaign-repair") {
    requireRule(g.campaign, "No campaign");
    requireRule(
      g.solo || crew === seat || crew >= state.players.length,
      "This repair belongs to another player",
    );
    const { type, sequence, ...choice } = command;
    g.campaign = repairCampaign(g.campaign, choice);
    return;
  }
  requireRule(state.stage === "programming", "Programming is closed");
  if (command.type === "draw") {
    if (command.android) {
      requireRule(g.androidDataCredits > 0, "No shared android card available");
      requireRule(
        g.androidDataDraws[seat] === Math.min(...g.androidDataDraws),
        "Divide extra cards evenly among players",
      );
    } else requireRule(g.dataCredits[seat] > 0, "No incoming data available");
    requireRule(g.deck.length > 0, "Action deck is empty");
    g.hands[seat].push(g.deck.shift());
    if (command.android) {
      g.androidDataCredits--;
      g.androidDataDraws[seat]++;
    } else g.dataCredits[seat]--;
    return;
  }
  if (command.type === "transfer") {
    requireRule(
      !g.solo &&
        state.transferClosesAt !== null &&
        state.observedAt < state.transferClosesAt,
      "Transfer window is closed",
    );
    requireRule(
      !g.transferUsed.includes(seat),
      "You already sent a card in this window",
    );
    requireRule(
      Number.isInteger(command.to) &&
        state.players[command.to] &&
        command.to !== seat,
      "Choose another player",
    );
    requireRule(
      g.hands[seat].includes(command.card) &&
        g.cards[command.card]?.kind === "normal",
      "Only an ordinary card in your hand can be transferred",
    );
    g.hands[seat].splice(g.hands[seat].indexOf(command.card), 1);
    g.hands[command.to].push(command.card);
    g.transferUsed.push(seat);
    return;
  }
  if (command.type === "teleport") {
    requireRule(
      Number.isInteger(crew) &&
        (g.solo || crew === seat || crew >= state.players.length) &&
        g.specializations[crew]?.name === "teleporter",
      "Only the Teleporter moves these tokens",
    );
    requireRule(
      g.solo ||
        (state.transferClosesAt !== null &&
          state.observedAt < state.transferClosesAt),
      "Transfer window is closed",
    );
    requireRule(
      [command.from, command.to].every(
        (i) => Number.isInteger(i) && i >= 0 && i < state.crewSize,
      ),
      "Unknown crew member",
    );
    g.teleportTokens[crew] = [command.from, command.to];
    return;
  }
  editable(state, seat, crew, turn);
  requireRule(
    command.slotVersion === g.slotVersions[crew][turn - 1],
    "This slot changed; refresh before editing it",
  );
  const current = g.programs[crew][turn - 1],
    android = !g.solo && crew >= state.players.length;
  requireRule(!android || !current, "Android programs cannot be taken back");
  if (command.type === "remove") {
    requireRule(current, "This slot is empty");
    for (const { id } of current.cards) {
      if (
        g.cards[id].owner !== undefined &&
        (g.solo || crew >= state.players.length)
      )
        g.androidCards.push(id);
      else g.hands[seat].push(id);
    }
    g.programs[crew][turn - 1] = null;
  } else {
    requireRule(
      Array.isArray(command.cards) &&
        command.cards.length >= 1 &&
        command.cards.length <= 2,
      "Choose one action card",
    );
    requireRule(
      new Set(command.cards.map((c) => c.id)).size === command.cards.length,
      "Cannot play the same card twice",
    );
    for (const c of command.cards) {
      requireRule(
        c && Object.keys(c).every((k) => ["id", "side"].includes(k)),
        "Invalid card choice",
      );
      const card = g.cards[c.id];
      requireRule(
        card && Number.isInteger(c.side) && card.sides[c.side],
        "Invalid card side",
      );
      requireRule(
        g.hands[seat].includes(c.id) ||
          g.androidCards.includes(c.id) ||
          current?.cards.some((x) => x.id === c.id),
        "Card is not available",
      );
      requireRule(
        card.owner === undefined || card.owner === crew,
        "This card belongs to another crew member",
      );
    }
    let cards = command.cards;
    if (cards.length === 2) {
      const special =
        cards.find(
          (c) =>
            g.cards[c.id].sides[c.side][0] === "special:special-ops:advanced",
        ) ??
        cards.find((c) =>
          g.cards[c.id].sides[c.side][0].startsWith("special:"),
        );
      const other = cards.find((c) => c !== special),
        a = special && g.cards[special.id].sides[special.side][0];
      const otherActions = other && g.cards[other.id].sides[other.side];
      requireRule(
        a === "special:special-ops:advanced" ||
          (a?.startsWith("special:medic:") &&
            otherActions.length === 1 &&
            ["red", "blue", "lift"].includes(otherActions[0])),
        "These cards cannot be combined",
      );
      cards = a.startsWith("special:medic:")
        ? [other, special]
        : [special, other];
    }
    requireRule(
      cards.length === 2 ||
        !g.cards[cards[0].id].sides[cards[0].side].includes(
          "special:special-ops:advanced",
        ),
      "Advanced Special Ops needs a second card",
    );
    if (current)
      for (const { id } of current.cards) {
        if (g.cards[id].owner !== undefined && g.solo) g.androidCards.push(id);
        else g.hands[seat].push(id);
      }
    for (const { id } of cards) {
      g.hands[seat] = g.hands[seat].filter((x) => x !== id);
      g.androidCards = g.androidCards.filter((x) => x !== id);
    }
    g.programs[crew][turn - 1] = { cards: structuredClone(cards) };
  }
  g.slotVersions[crew][turn - 1]++;
}
export function gameView(state, seat) {
  const g = state.game;
  if (!g) return undefined;
  const valid = Number.isInteger(seat) && Boolean(state.players[seat]);
  const revealed = state.stage === "resolution";
  const publicShip = (ship) => {
    const s = structuredClone(ship);
    for (const z of Object.values(s.zones)) delete z.damageDeck;
    return s;
  };
  return {
    solo: g.solo,
    campaign: g.campaign
      ? { ...g.campaign, lastShip: undefined, usedThreats: undefined }
      : null,
    catalogue: g.threatExpansion ? "base-and-new-frontier" : "base",
    specializations: g.specializations,
    tracks: g.tracks,
    ship: publicShip(g.resolution?.ship ?? g.initialShip),
    hand:
      valid && state.phase > 0 ? g.hands[seat].map((id) => g.cards[id]) : [],
    androidCards:
      state.phase > 0 ? g.androidCards.map((id) => g.cards[id]) : [],
    dataCredits: valid ? g.dataCredits[seat] : 0,
    androidDataCredits: valid ? g.androidDataCredits : 0,
    canDrawAndroid:
      valid && g.androidDataDraws[seat] === Math.min(...g.androidDataDraws),
    transferUsed: valid ? g.transferUsed.includes(seat) : false,
    programs: g.programs.map((p, crew) =>
      p.map((entry, index) => ({
        turn: index + 1,
        revision: g.slotVersions[crew][index],
        cards:
          entry?.cards.map(({ id, side }) =>
            revealed ||
            (valid && (g.solo || crew === seat)) ||
            crew >= state.players.length
              ? { ...g.cards[id], side }
              : cardBack(g.cards[id], side),
          ) ?? [],
      })),
    ),
    threats: g.threats.map(publicThreat),
    teleportTokens: g.teleportTokens,
    resolution: g.resolution
      ? {
          turn: g.resolution.turn,
          step: g.resolution.step,
          outcome: g.resolution.outcome,
          log: g.resolution.log,
          frames: g.resolution.frames.map((f) => ({
            ...f,
            ship: publicShip(f.ship),
            threats: f.threats.map(publicThreat),
          })),
        }
      : null,
  };
}

function publicThreat({ vortexCard, calledCard, ...threat }) {
  return {
    ...threat,
    ...(threat.cardId ? { card: threatById(threat.cardId) } : {}),
    ...(calledCard ? { calledCard: publicThreat(calledCard) } : {}),
  };
}
