import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { missionSummaries, getMission } from "../src/missions.js";
import {
  createSession,
  advanceClock,
  nextWakeup,
  submit,
  snapshot,
} from "../src/session.js";

export function createPreviewServer({ clock = Date.now } = {}) {
  let state = createSession(
    { players: 4, mission: getMission("realmission1") },
    clock(),
  );
  let timer;
  function schedule() {
    clearTimeout(timer);
    const at = nextWakeup(state);
    if (at === null) return;
    timer = setTimeout(
      () => {
        state = advanceClock(state, clock());
        schedule();
      },
      Math.max(1, at - clock()),
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
      if (req.method === "GET" && url.pathname === "/api/missions")
        return json(200, missionSummaries);
      if (req.method === "GET" && url.pathname === "/api/state") {
        state = advanceClock(state, clock());
        schedule();
        return json(200, snapshot(state, seat));
      }
      if (
        req.method === "POST" &&
        ["/api/command", "/api/new"].includes(url.pathname)
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
        if (url.pathname === "/api/new") {
          state = createSession(
            { players: command.players, mission: getMission(command.mission) },
            clock(),
          );
          schedule();
          return json(200, snapshot(state, seat));
        }
        const result = submit(state, seat, command, clock());
        state = result.state;
        schedule();
        return json(result.accepted ? 200 : 409, {
          accepted: result.accepted,
          duplicate: result.duplicate,
          error: result.error,
          view: snapshot(state, seat),
        });
      }
      const file = {
        "/": "index.html",
        "/app.js": "app.js",
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
  createPreviewServer().listen(port, "127.0.0.1", () =>
    console.log(`Space Alert timing prototype: http://127.0.0.1:${port}`),
  );
}
