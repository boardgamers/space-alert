import { LESSONS, createLesson } from "../src/tutorials.js";
import { departCampaign } from "../src/game/campaign.js";
import {
  createExplorer,
  startExplorer,
  settleExplorer,
  cancelExplorer,
  consentToCloning,
  learnSpecialization,
  claimAchievement,
  eligibleAchievements,
} from "../src/game/career.js";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  renameSync,
  existsSync,
} from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SPECIALIZATIONS } from "../src/game/cards.js";
import { missionSummaries, getMission } from "../src/missions.js";
import {
  createSession,
  advanceClock,
  nextWakeup,
  submit,
  snapshot,
} from "../src/session.js";

export function createPreviewServer({ clock = Date.now, storagePath } = {}) {
  let offset = 0,
    explorers = {},
    careerIds = [];
  const trustedClock = () =>
    state?.tutorial && state.stage === "programming"
      ? state.observedAt
      : clock() + offset;
  let state = createSession(
    {
      players: 4,
      mission: getMission("realmission1"),
      gameOptions: { seed: randomUUID() },
    },
    clock(),
  );
  if (storagePath && existsSync(storagePath)) {
    const saved = JSON.parse(readFileSync(storagePath, "utf8"));
    if (saved.schema === 2) {
      state = saved.state;
      offset = saved.offset ?? 0;
      explorers = saved.explorers ?? {};
      careerIds = saved.careerIds ?? [];
      state = advanceClock(state, trustedClock());
    } else
      writeFileSync(storagePath + ".legacy-backup", JSON.stringify(saved), {
        mode: 0o600,
      });
  }
  let persisted = -1;
  function persist() {
    if (!storagePath || persisted === state.revision) return;
    mkdirSync(dirname(storagePath), { recursive: true });
    writeFileSync(
      storagePath + ".tmp",
      JSON.stringify({ schema: 2, state, offset, explorers, careerIds }),
      {
        mode: 0o600,
      },
    );
    renameSync(storagePath + ".tmp", storagePath);
    persisted = state.revision;
  }
  function settleCareers() {
    if (!careerIds.length) return;
    const g = state.game,
      result =
        g.campaign?.outcome ?? (!g.campaign ? g.resolution?.outcome : null),
      runId = g.campaign?.id ?? g.seed;
    if (state.stage === "cancelled") {
      for (const id of careerIds)
        if (explorers[id].activeRun === runId)
          explorers[id] = cancelExplorer(explorers[id], runId);
      return;
    }
    if (!result) return;
    const metadata = {
      mission: state.mission.id,
      humans: state.players.length,
      crew: state.crewSize,
      doubleActions: state.mission.doubleActions,
      difficulty: g.difficulty,
      seriousDifficulty: g.seriousDifficulty,
      penalties: result.penalties,
      threatCount: state.timeline
        .filter((e) => e.type === "threat")
        .reduce((n, e) => n + (e.severity === "serious" ? 2 : 1), 0),
    };
    for (const [seat, id] of careerIds.entries())
      explorers[id] = settleExplorer(explorers[id], {
        id: runId,
        ...result,
        count: g.campaign?.missions.length ?? 1,
        limit: g.campaign?.limit ?? 3,
        training: !/^(realmission|double)/.test(state.mission.id),
        humans: state.players.length,
        at: trustedClock(),
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
  function viewFor(seat) {
    const view = snapshot(state, seat);
    view.tutorial = state.tutorial;
    view.careerIds = careerIds;
    view.explorers = Object.values(explorers).map((e) => ({
      ...e,
      activeRun: !!e.activeRun,
      eligible: e.runs.length ? eligibleAchievements(e, e.runs.at(-1).id) : [],
    }));
    return view;
  }
  let timer;
  function schedule() {
    clearTimeout(timer);
    settleCareers();
    persist();
    if (state.tutorial && state.stage === "programming") return;
    const at = nextWakeup(state);
    if (at === null) return;
    timer = setTimeout(
      () => {
        state = advanceClock(state, trustedClock());
        schedule();
      },
      Math.max(1, at - trustedClock()),
    );
    timer.unref();
  }
  const server = createServer(async (req, res) => {
    const json = (code, value) => {
      res.writeHead(code, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify(value));
    };
    try {
      const url = new URL(req.url, "http://localhost");
      const seatValue = url.searchParams.get("seat");
      const seat =
        seatValue !== null && /^\d$/.test(seatValue)
          ? Number(seatValue)
          : undefined;
      if (req.method === "GET" && url.pathname === "/api/lessons")
        return json(
          200,
          LESSONS.map(({ id, title }) => ({ id, title })),
        );
      if (req.method === "GET" && url.pathname === "/api/missions")
        return json(200, missionSummaries);
      if (req.method === "GET" && url.pathname === "/api/state") {
        state = advanceClock(state, trustedClock());
        schedule();
        return json(200, viewFor(seat));
      }
      if (
        req.method === "POST" &&
        [
          "/api/command",
          "/api/new",
          "/api/advance",
          "/api/career",
          "/api/lesson",
          "/api/lesson-next",
          "/api/campaign-next",
        ].includes(url.pathname)
      ) {
        const origin = req.headers.origin;
        const localOrigin = `http://${req.headers.host}`;
        if (
          (origin && origin !== localOrigin) ||
          req.headers["sec-fetch-site"] === "cross-site"
        )
          return json(403, { error: "Local preview only" });
        if (!req.headers["content-type"]?.startsWith("application/json"))
          return json(415, { error: "Expected JSON" });
        let body = "";
        for await (const chunk of req) {
          body += chunk;
          if (body.length > 4096)
            return json(413, { error: "Request too large" });
        }
        const command = JSON.parse(body);
        if (url.pathname === "/api/lesson") {
          if (careerIds.some((id) => explorers[id].activeRun))
            throw Error("Finish the current career mission first");
          state = createLesson(command.lesson, clock() + offset);
          careerIds = [];
          persisted = -1;
          schedule();
          return json(200, viewFor(0));
        }
        if (url.pathname === "/api/lesson-next") {
          if (!state.tutorial || state.stage !== "programming")
            throw Error("No active lesson");
          state = advanceClock(
            state,
            state.missionStartAt + state.mission.phaseEndsMs[state.phase - 1],
          );
          schedule();
          return json(200, viewFor(0));
        }
        if (url.pathname === "/api/career") {
          const next = { ...explorers };
          if (command.type === "create") {
            const id = randomUUID();
            next[id] = createExplorer(id, command.name, command.cloning);
          } else {
            if (!next[command.id]) throw Error("Unknown explorer");
            if (command.type === "consent")
              next[command.id] = consentToCloning(next[command.id]);
            else if (command.type === "learn")
              next[command.id] = learnSpecialization(
                next[command.id],
                command.specialization,
              );
            else if (command.type === "claim")
              next[command.id] = claimAchievement(
                next[command.id],
                command.runId,
                command.achievement,
                { crewAgrees: command.crewAgrees === true },
              );
            else throw Error("Unknown career command");
          }
          explorers = next;
          persisted = -1;
          schedule();
          return json(200, viewFor(seat));
        }
        if (url.pathname === "/api/campaign-next") {
          if (seat !== 0 || !state.game.campaign)
            throw Error("Only the captain starts the next campaign mission");
          const mission = getMission(command.mission ?? state.mission.id);
          if (!/^(realmission|double)/.test(mission.id))
            throw Error("Campaigns require full missions");
          const campaign = departCampaign(
            state.game.campaign,
            command.botStation,
          );
          const g = state.game;
          const next = createSession(
            {
              players: state.players.length,
              crewSize: state.crewSize,
              mission,
              gameOptions: {
                seed: randomUUID(),
                campaign,
                threatExpansion: g.threatExpansion,
                difficulty: command.difficulty ?? g.difficulty,
                seriousDifficulty:
                  command.seriousDifficulty ?? g.seriousDifficulty,
                specializations: g.specializations,
              },
            },
            trustedClock(),
          );
          state = next;
          persisted = -1;
          schedule();
          return json(200, viewFor(seat));
        }
        if (url.pathname === "/api/advance") {
          const wake = nextWakeup(state);
          if (
            ["programming", "countdown"].includes(state.stage) &&
            wake !== null
          ) {
            offset = Math.max(offset, wake - clock());
            state = advanceClock(state, trustedClock());
            schedule();
          }
          return json(200, viewFor(seat));
        }
        if (url.pathname === "/api/new") {
          const options = command.gameOptions ?? {};
          if (
            Object.keys(options).some(
              (k) =>
                ![
                  "specializations",
                  "threatExpansion",
                  "difficulty",
                  "seriousDifficulty",
                  "campaignLimit",
                ].includes(k),
            )
          )
            throw Error("Unsupported setup option");
          if (
            options.specializations?.some(
              (s) =>
                s &&
                (!SPECIALIZATIONS.includes(s.name) ||
                  ![1, 2, 3].includes(s.level)),
            )
          )
            throw Error("Invalid specialization");
          if (
            options.campaignLimit &&
            !/^(realmission|double)/.test(command.mission)
          )
            throw Error("Campaigns require full missions");
          const nextState = createSession(
            {
              players: command.players,
              crewSize: command.crewSize,
              mission: getMission(command.mission),
              gameOptions: { ...options, seed: randomUUID() },
            },
            trustedClock(),
          );
          const ids = command.careerIds ?? [];
          if (careerIds.some((id) => explorers[id].activeRun))
            throw Error(
              "Finish the current career mission before replacing it",
            );
          const nextExplorers = structuredClone(explorers);
          if (ids.length) {
            if (
              ids.length !== command.players ||
              new Set(ids).size !== ids.length ||
              ids.some((id) => !nextExplorers[id])
            )
              throw Error("Choose a different explorer for every player");
            const specs = options.specializations ?? [];
            if (specs.length !== nextState.crewSize)
              throw Error(
                "Career games use specialization rules, including level-zero crew",
              );
            for (let i = 0; i < specs.length; i++) {
              const s = specs[i];
              if (!s) continue;
              const owners =
                command.players === 1 || i >= command.players ? ids : [ids[i]];
              if (
                !owners.some(
                  (id) =>
                    (nextExplorers[id].specializations[s.name] ?? 0) >= s.level,
                )
              )
                throw Error("This crew has not learned that specialization");
            }
            if (
              options.campaignLimit &&
              ids.some((id) => nextExplorers[id].level < 2)
            )
              throw Error("Explorers need level 2 for campaigns");
            for (const id of ids)
              nextExplorers[id] = startExplorer(
                nextExplorers[id],
                nextState.game.campaign?.id ?? nextState.game.seed,
              );
          }
          state = nextState;
          explorers = nextExplorers;
          careerIds = ids;
          persisted = -1;
          schedule();
          return json(200, viewFor(seat));
        }
        const result = submit(state, seat, command, trustedClock());
        state = result.state;
        schedule();
        return json(result.accepted ? 200 : 409, {
          accepted: result.accepted,
          duplicate: result.duplicate,
          error: result.error,
          view: viewFor(seat),
        });
      }
      const file = {
        "/": "index.html",
        "/app.js": "app.js",
        "/text.js": "text.js",
        "/style.css": "style.css",
      }[url.pathname];
      if (req.method === "GET" && file) {
        res.writeHead(200, {
          "Content-Type": file.endsWith(".html")
            ? "text/html"
            : file.endsWith(".css")
              ? "text/css"
              : "text/javascript",
          "Cache-Control": "no-store",
        });
        res.end(await readFile(new URL(file, import.meta.url)));
      } else json(404, { error: "Not found" });
    } catch (error) {
      json(400, { error: error.message });
    }
  });
  server.on("close", () => clearTimeout(timer));
  schedule();
  return server;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 5250);
  createPreviewServer({
    storagePath: new URL("../.local/session.json", import.meta.url).pathname,
  }).listen(port, "127.0.0.1", () =>
    console.log(`Space Alert local playtest: http://127.0.0.1:${port}`),
  );
}
