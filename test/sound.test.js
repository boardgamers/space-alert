import test from "node:test";
import assert from "node:assert/strict";
import { createSoundDesign } from "../preview/sound.js";

test("combat cues have distinct layers, mute stops active sounds, and re-enabling resumes audio", () => {
  const nodes = [];
  const parameter = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const node = () => {
    const n = { frequency: parameter(), gain: parameter(), pan: parameter(),
      connect() { return this; }, disconnect() {},
      start() { this.started = true; }, stop() { this.stops = (this.stops ?? 0) + 1; } };
    nodes.push(n); return n;
  };
  let context;
  class AudioContext {
    constructor() { context = this; this.state = "suspended"; this.currentTime = 0; this.sampleRate = 8000; }
    resume() { this.state = "running"; return Promise.resolve(); }
    suspend() { this.state = "suspended"; return Promise.resolve(); }
    close() { this.state = "closed"; return Promise.resolve(); }
    createBuffer(channels, size) { return { getChannelData: () => new Float32Array(size) }; }
    createBufferSource = node;
    createOscillator = node;
    createGain = node;
    createBiquadFilter = node;
    createStereoPanner = node;
  }
  const original = globalThis.window;
  globalThis.window = { AudioContext };
  const sound = createSoundDesign();
  try {
    sound.cue("laser-fire");
    assert.equal(nodes.length, 0, "no audio before opt-in/gesture");
    sound.enable(true);
    const counts = [];
    for (const kind of ["move", "charge", "laser-fire", "shield-hit", "hull-hit", "explosion"]) {
      const before = nodes.filter(n => n.started).length;
      sound.cue(kind, .5);
      counts.push(nodes.filter(n => n.started).length - before);
    }
    assert.ok(counts.every(n => n > 0));
    assert.ok(counts[5] > counts[1], "destruction has a richer tail than charging");
    sound.enable(false);
    assert.equal(context.state, "suspended");
    assert.ok(nodes.filter(n => n.started).every(n => n.stops === 2), "mute cancels even scheduled voices");
    const length = nodes.length;
    sound.cue("explosion");
    assert.equal(nodes.length, length, "muted events do not queue audio");
    sound.enable(true);
    sound.cue("place");
    assert.ok(nodes.length > length);
    sound.destroy();
    assert.equal(context.state, "closed");
  } finally { globalThis.window = original; }
});
