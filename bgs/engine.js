import { createHash } from "node:crypto";
import {
  createSession,
  advanceClock,
  nextWakeup as wakeup,
  submit,
  snapshot,
} from "../src/session.js";
import { getMission } from "../src/missions.js";
import { departCampaign } from "../src/game/campaign.js";
import {
  createExplorer,
  startExplorer,
  settleExplorer,
  cancelExplorer,
  learnSpecialization,
  consentToCloning,
  claimAchievement,
  eligibleAchievements,
} from "../src/game/career.js";

const reject = (message) => {
  throw Object.assign(new Error(message), { name: "InvalidMoveError" });
};
function trusted(context) {
  if (!Number.isSafeInteger(context?.now) || context.now < 0)
    throw Error("Space Alert needs the BGS server clock protocol");
  return context.now;
}
const result = (state) =>
  state.game?.campaign?.outcome ??
  (!state.game?.campaign ? state.game?.resolution?.outcome : null);
function settle(state) {
  const g = state.game,
    runId = g.campaign?.id ?? g.seed;
  for (const [seat, id] of (state.bgs?.playerIds ?? []).entries()) {
    const e = state.bgs.explorers?.[id];
    if (!e?.activeRun) continue;
    if (state.stage === "cancelled") {
      state.bgs.explorers[id] = cancelExplorer(e, runId);
      continue;
    }
    const outcome = result(state);
    if (!outcome) continue;
    const metadata = {
      mission: state.mission.id,
      humans: state.players.length,
      crew: state.crewSize,
      doubleActions: state.mission.doubleActions,
      difficulty: g.difficulty,
      seriousDifficulty: g.seriousDifficulty,
      penalties: outcome.penalties,
      threatCount: state.timeline
        .filter((e) => e.type === "threat")
        .reduce((n, e) => n + (e.severity === "serious" ? 2 : 1), 0),
    };
    state.bgs.explorers[id] = settleExplorer(e, {
      id: runId,
      ...outcome,
      count: g.campaign?.missions.length ?? 1,
      limit: g.campaign?.limit ?? 3,
      training: !/^(realmission|double)/.test(state.mission.id),
      humans: state.players.length,
      at: state.observedAt,
      missions: g.campaign
        ? g.campaign.missions.map((m) => m.metadata)
        : [metadata],
      usedSpecializations: g.campaign
        ? [
            ...new Set(
              g.campaign.missions.flatMap(
                (m) => m.metadata.usedSpecializations?.[seat] ?? [],
              ),
            ),
          ]
        : g.resolution.log
            .filter((e) => e.type === "specialization" && e.crew === seat)
            .map((e) => `${e.name}:${e.tier}`),
    });
  }
  return state;
}
function pool(value = "1,2") {
  const values = String(value).split(",").map(Number);
  if (!values.length || values.some((n) => ![1, 2, 3].includes(n)))
    throw Error("Invalid threat difficulty");
  return [...new Set(values)];
}
export function init(players, expansions, options, seed, creator, context) {
  const now = trusted(context),
    mission = getMission(options.mission ?? "realmission1");
  const campaignLimit = Number(options.campaign ?? 0);
  if (![0, 3, 5].includes(campaignLimit))
    throw Error("Choose a single mission or a three/five mission campaign");
  if (campaignLimit && !/^(realmission|double)/.test(mission.id))
    throw Error("Campaigns require full missions");
  const crewSize =
    players === 1
      ? 5
      : options.crewSize === "3" && players === 3
        ? 3
        : Math.max(4, players);
  const playerIds =
    context.playerIds ?? Array.from({ length: players }, (_, i) => String(i));
  const previous = context.previous?.state?.bgs?.explorers ?? {};
  const explorers = Object.fromEntries(
    playerIds
      .filter((id) => options.careers || previous[id])
      .map((id, i) => [
        id,
        previous[id]
          ? structuredClone(previous[id])
          : createExplorer(id, `Explorer ${i + 1}`),
      ]),
  );
  if (Object.values(explorers).some((e) => e.activeRun))
    throw Error("Previous explorers have not returned from their mission");
  if (
    options.careers &&
    campaignLimit &&
    Object.values(explorers).some((e) => e.level < 2)
  )
    throw Error("Career explorers need level 2 before a campaign");
  const state = createSession(
    {
      players,
      crewSize,
      mission,
      gameOptions: {
        seed,
        campaignLimit,
        threatExpansion: expansions.includes("new-frontier"),
        difficulty: pool(options.difficulty),
        seriousDifficulty: pool(
          options.seriousDifficulty ?? options.difficulty,
        ),
        ...(options.careers
          ? { specializations: Array(crewSize).fill(null) }
          : {}),
      },
    },
    now,
  );
  state.bgs = {
    playerIds,
    explorers,
    gameId: context.gameId,
    missionNumber: 1,
    settings: options,
  };
  return state;
}
export function advanceTime(state, context) {
  return settle(advanceClock(state, trusted(context)));
}
export function nextWakeup(state) {
  return ended(state) ? null : wakeup(state);
}
export function move(input, command, seat, context) {
  const now = trusted(context);
  if (!Number.isInteger(seat) || !input.players[seat]) reject("Unknown player");
  if (!command || typeof command !== "object" || Array.isArray(command))
    reject("Invalid command");
  let state = advanceTime(input, context);
  if (!Number.isSafeInteger(command.sequence) || command.sequence < 1)
    reject("Invalid sequence");
  if (command.sequence <= state.players[seat].lastSequence) return state;
  if (command.sequence !== state.players[seat].lastSequence + 1)
    reject("Refresh before trying again");
  if (ended(state)) reject("This game has finished");
  try {
    if (command.type === "campaign-next") {
      if (
        Object.keys(command).some(
          (k) =>
            ![
              "type",
              "sequence",
              "mission",
              "botStation",
              "difficulty",
              "seriousDifficulty",
            ].includes(k),
        )
      )
        reject("Unsupported command field");
      if (seat !== 0 || !state.game.campaign)
        reject("Only the captain starts the next campaign mission");
      const mission = getMission(command.mission ?? state.mission.id);
      if (!/^(realmission|double)/.test(mission.id))
        reject("Campaigns require full missions");
      const campaign = departCampaign(state.game.campaign, command.botStation);
      const seed = createHash("sha256")
        .update(state.game.seed + "/next-mission")
        .digest("hex");
      const next = createSession(
        {
          players: state.players.length,
          crewSize: state.crewSize,
          mission,
          gameOptions: {
            seed,
            campaign,
            threatExpansion: state.game.threatExpansion,
            difficulty: command.difficulty
              ? pool(command.difficulty)
              : state.game.difficulty,
            seriousDifficulty: command.seriousDifficulty
              ? pool(command.seriousDifficulty)
              : state.game.seriousDifficulty,
            specializations: state.game.specializations,
          },
        },
        now,
      );
      next.bgs = { ...state.bgs, missionNumber: state.bgs.missionNumber + 1 };
      next.players.forEach((p, i) => {
        p.lastSequence = state.players[i].lastSequence;
        p.name = state.players[i].name;
      });
      next.revision = state.revision + 1;
      state = next;
    } else if (command.type === "career") {
      if (
        Object.keys(command).some(
          (k) =>
            ![
              "type",
              "sequence",
              "action",
              "specialization",
              "achievement",
              "runId",
              "agrees",
              "crew",
            ].includes(k),
        )
      )
        reject("Unsupported career field");
      if (state.stage !== "presence" || state.players.some((p) => p.ready))
        reject("Choose careers before anyone confirms readiness");
      const id = state.bgs.playerIds[seat],
        e = state.bgs.explorers[id];
      if (!e || !state.bgs.settings.careers)
        reject("Careers are disabled for this table");
      if (command.action === "new" && e.dead)
        state.bgs.explorers[id] = createExplorer(id, e.name);
      else if (command.action === "learn")
        state.bgs.explorers[id] = learnSpecialization(
          e,
          command.specialization,
        );
      else if (command.action === "consent")
        state.bgs.explorers[id] = consentToCloning(e);
      else if (command.action === "claim")
        state.bgs.explorers[id] = claimAchievement(
          e,
          command.runId,
          command.achievement,
          { crewAgrees: command.agrees === true },
        );
      else if (command.action === "specialization") {
        const crew = command.crew ?? seat;
        if (
          !Number.isInteger(crew) ||
          crew < 0 ||
          crew >= state.crewSize ||
          (state.players.length > 1 &&
            crew !== seat &&
            crew < state.players.length)
        )
          reject("Choose your own specialization");
        const level = e.specializations[command.specialization];
        if (!level) reject("Learn this specialization first");
        if (
          state.game.specializations.some(
            (s, i) => i !== crew && s?.name === command.specialization,
          )
        )
          reject("Specialization is already assigned");
        state.game.specializations[crew] = {
          name: command.specialization,
          level,
        };
      } else reject("Unknown career action");
      state.revision++;
    } else {
      if (
        command.type === "ready" &&
        state.bgs.settings.careers &&
        state.bgs.explorers[state.bgs.playerIds[seat]]
      ) {
        const id = state.bgs.playerIds[seat],
          e = state.bgs.explorers[id];
        if (!e.activeRun)
          state.bgs.explorers[id] = startExplorer(
            e,
            state.game.campaign?.id ?? state.game.seed,
          );
      }
      const response = submit(state, seat, command, now);
      if (!response.accepted) reject(response.error);
      return settle(response.state);
    }
    state.players[seat].lastSequence = command.sequence;
    return settle(state);
  } catch (error) {
    if (error.name === "InvalidMoveError") throw error;
    reject(error.message);
  }
}
export function ended(state) {
  return state.stage === "cancelled" || !!result(state);
}
export function cancelled(state) {
  return state.stage === "cancelled";
}
export function scores(state) {
  return state.players.map(() => result(state)?.score ?? 0);
}
export function currentPlayer(state) {
  return ended(state) ? [] : state.players.map((p) => p.seat);
}
export function isLiveUpdate() {
  return true;
}
export function round(state) {
  return state.bgs.missionNumber;
}
export function logLength(state) {
  return state.revision;
}
export function logSlice() {
  return { log: [] };
}
export function stripSecret(state, seat, context) {
  const view = snapshot(state, seat);
  view.serverNow = Math.max(state.observedAt, context?.now ?? state.observedAt);
  view.bgs = {
    missionNumber: state.bgs.missionNumber,
    settings: state.bgs.settings,
  };
  const id = state.bgs.playerIds[seat];
  view.careerIds = state.bgs.playerIds;
  view.explorers = (
    state.bgs.settings.careers ? Object.values(state.bgs.explorers) : []
  ).map((e) => ({
    ...e,
    activeRun: !!e.activeRun,
    eligible:
      e.id === id && e.runs.length
        ? eligibleAchievements(e, e.runs.at(-1).id)
        : [],
    editable: e.id === id,
  }));
  return view;
}
export function setPlayerMetaData(state, seat, { name }) {
  const next = structuredClone(state);
  next.players[seat].name = name;
  const e = next.bgs.explorers[next.bgs.playerIds[seat]];
  if (e) e.name = name;
  return next;
}
export function dropPlayer(state) {
  const next = structuredClone(state);
  next.stage = "cancelled";
  next.cancellation = { reason: "player-left" };
  next.revision++;
  return settle(next);
}
