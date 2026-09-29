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
