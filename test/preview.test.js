import assert from "node:assert/strict";
import test from "node:test";
import { once } from "node:events";
import { createPreviewServer } from "../preview/server.js";

test("local host shares state across seats and commits deadline changes on rejected requests", async () => {
  let now = 1_000_000;
  const server = createPreviewServer({ clock: () => now });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body, extra = {}) =>
    fetch(base + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...extra },
      body: JSON.stringify(body),
    });
  try {
    assert.equal((await fetch(base)).status, 200);
    const catalog = await fetch(base + "/api/missions").then((r) => r.json());
    assert.equal(catalog.length, 34);
    assert.equal(
      catalog.some((m) => m.events),
      false,
    );
    const first = await post("/api/command?seat=0", {
      type: "ready",
      sequence: 1,
    }).then((r) => r.json());
    assert.equal(first.accepted, true);
    const second = await fetch(base + "/api/state?seat=1").then((r) =>
      r.json(),
    );
    assert.equal(second.players[0].ready, true);
    assert.equal(second.players[1].ready, false);
    assert.equal(second.timeline, undefined);
    const crossSite = await post(
      "/api/command?seat=1",
      { type: "ready", sequence: 1 },
      { Origin: "https://example.invalid" },
    );
    assert.equal(crossSite.status, 403);
    now += 120_000;
    const late = await post("/api/command?seat=1", {
      type: "ready",
      sequence: 1,
    });
    assert.equal(late.status, 409);
    const stored = await fetch(base + "/api/state?seat=0").then((r) =>
      r.json(),
    );
    assert.equal(stored.stage, "cancelled");
    assert.deepEqual(stored.cancellation.missingSeats, [1, 2, 3]);
  } finally {
    server.close();
    await once(server, "close");
  }
});

test("private programs and career completion survive a host restart without duplicate rewards", async () => {
  const { mkdtemp, readFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = await mkdtemp(join(tmpdir(), "space-alert-host-"));
  let now = 2000000,
    server,
    base;
  const start = async () => {
    server = createPreviewServer({
      clock: () => now,
      storagePath: join(dir, "state.json"),
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    base = `http://127.0.0.1:${server.address().port}`;
  };
  const stop = async () => {
    const closed = once(server, "close");
    server.close();
    server.closeAllConnections();
    await closed;
  };
  const post = async (path, data) => {
    const r = await fetch(base + path + "?seat=0", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    });
    const v = await r.json();
    assert.ok(r.ok, JSON.stringify(v));
    return v;
  };
  const get = () => fetch(base + "/api/state?seat=0").then((r) => r.json());
  try {
    await start();
    let view = await post("/api/career", {
      type: "create",
      name: "Test explorer",
      cloning: true,
    });
    const id = view.explorers[0].id;
    view = await post("/api/new", {
      players: 1,
      mission: "realmission1",
      careerIds: [id],
      gameOptions: { specializations: [null, null, null, null] },
    });
    let response = await post("/api/command", {
      type: "ready",
      sequence: view.nextSequence,
    });
    view = response.view;
    now += 3000;
    view = await get();
    const card = view.game.hand.find((c) => c.sides.some((s) => s[0] === "C"));
    response = await post("/api/command", {
      type: "program",
      sequence: view.nextSequence,
      crew: 0,
      turn: 1,
      slotVersion: 0,
      cards: [{ id: card.id, side: card.sides.findIndex((s) => s[0] === "C") }],
    });
    await stop();
    await start();
    view = await get();
    assert.equal(view.game.programs[0][0].cards[0].id, card.id);
    assert.equal(view.explorers[0].activeRun, true);
    const spectator = await fetch(base + "/api/state").then((r) => r.json());
    assert.equal(spectator.game.hand.length, 0);
    assert.equal(spectator.game.programs[0][0].cards[0].id, undefined);
    now += 3600000;
    view = await get();
    response = await post("/api/command", {
      type: "resolve",
      all: true,
      sequence: view.nextSequence,
    });
    const explorer = response.view.explorers[0];
    assert.equal(explorer.runs.length, 1);
    assert.equal(explorer.activeRun, false);
    await stop();
    await start();
    assert.deepEqual((await get()).explorers[0], explorer);
    assert.deepEqual((await get()).explorers[0], explorer);
    const saved = JSON.parse(await readFile(join(dir, "state.json"), "utf8"));
    assert.equal(saved.explorers[id].runs.length, 1);
  } finally {
    if (server?.listening) await stop();
    await rm(dir, { recursive: true, force: true });
  }
});

test("untimed lessons advance only explicitly and remain paused after restart", async () => {
  const { mkdtemp, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = await mkdtemp(join(tmpdir(), "space-alert-lesson-"));
  let now = 1000,
    server,
    base;
  const start = async () => {
    server = createPreviewServer({
      clock: () => now,
      storagePath: join(dir, "session.json"),
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    base = `http://127.0.0.1:${server.address().port}`;
  };
  const stop = async () => {
    const done = once(server, "close");
    server.close();
    server.closeAllConnections();
    await done;
  };
  const post = async (path, body = {}) => {
    const r = await fetch(base + path + "?seat=0", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    assert.ok(r.ok);
    return r.json();
  };
  try {
    await start();
    let view = await post("/api/lesson", { lesson: "first-shot" });
    assert.equal(view.phase, 1);
    now += 86400000;
    view = await fetch(base + "/api/state?seat=0").then((r) => r.json());
    assert.equal(view.phase, 1);
    assert.equal(view.stage, "programming");
    await stop();
    await start();
    view = await fetch(base + "/api/state?seat=0").then((r) => r.json());
    assert.equal(view.phase, 1);
    view = await post("/api/lesson-next");
    assert.equal(view.phase, 2);
    view = await post("/api/lesson-next");
    assert.equal(view.stage, "resolution");
  } finally {
    if (server?.listening) await stop();
    await rm(dir, { recursive: true, force: true });
  }
});
