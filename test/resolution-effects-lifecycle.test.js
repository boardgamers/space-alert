import test from "node:test";
import assert from "node:assert/strict";
import { createResolutionEffects } from "../preview/resolution-effects.js";

// A controlled rendering clock exposes paints between the two layout frames and
// the microtask at animation completion, independently of removal timers.
function fixture({ reduced = false, animate = true } = {}) {
  const raf = new Map(), timers = new Map(), listeners = new Map(), animations = [];
  let serial = 0;
  const win = {
    innerWidth: 1000,
    matchMedia: () => ({ matches: reduced }),
    requestAnimationFrame: fn => { raf.set(++serial, fn); return serial; },
    cancelAnimationFrame: id => raf.delete(id),
    setTimeout: fn => { timers.set(++serial, fn); return serial; },
    clearTimeout: id => timers.delete(id),
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: name => listeners.delete(name),
  };
  function element(x = 0) {
    const el = {
      style: { visibility: "", cssText: "" }, dataset: {}, children: [], x,
      classList: { add() {} }, setAttribute() {}, removeAttribute() {},
      getClientRects: () => [1],
      getBoundingClientRect() { return { left: this.x, top: 0, width: 20, height: 20 }; },
      append(child) { child.parent = this; child.parentElement = this; this.children.push(child); },
      remove() { if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); this.removed = true; },
      replaceChildren() { for (const child of [...this.children]) child.remove(); },
      querySelector: () => null,
      querySelectorAll: () => [],
      cloneNode() { const clone = element(this.x); clone.style = { ...this.style }; return clone; },
    };
    if (animate) el.animate = (frames, options) => {
      let resolve;
      const animation = { element: el, frames, options, finished: new Promise(r => { resolve = r; }),
        finish: () => resolve(), cancel() { this.cancelled = true; this.removedAtCancel = el.removed; } };
      animations.push(animation);
      return animation;
    };
    return el;
  }
  const layout = element(), ship = element(), pawn = element(100), room = element(200);
  layout.append(ship);
  pawn.dataset.crew = "0";
  const doc = { defaultView: win, hidden: false, createElement: () => element(),
    addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) };
  const root = { ownerDocument: doc,
    querySelector: selector => selector === ".flight-layout" ? layout : selector === ".ship-vessel" ? ship : selector.startsWith("[data-crew") ? pawn : selector.startsWith("[data-station") ? room : null,
    querySelectorAll: selector => selector === "[data-crew]" ? [pawn] : [] };
  const effects = createResolutionEffects(root, () => {});
  const before = { logEnd: 0, turn: 1, ship: { crew: [{ id: 0, station: "white-upper" }] }, threats: [] };
  const after = { ...before, logEnd: 1, ship: { crew: [{ id: 0, station: "blue-upper" }] } };
  const resolution = { frames: [before, after], log: [{ type: "move", crew: 0, from: "white-upper", to: "blue-upper" }] };
  effects.afterRender(resolution, 0);
  function render() { effects.beforeRender(); pawn.x = 300; effects.afterRender(resolution, 1); }
  function frame() { const callbacks = [...raf.values()]; raf.clear(); callbacks.forEach(fn => fn()); }
  return { effects, resolution, render, frame, pawn, ship, layer: layout.children[1], animations, raf, timers, listeners, win, doc };
}

test("moving pawn is replaced before the first paint, then atomically handed off at finish", async () => {
  const f = fixture();
  f.pawn.style.visibility = "visible";
  f.render();
  assert.equal(f.pawn.style.visibility, "hidden");
  assert.equal(f.layer.children.length, 1, "source stand-in exists during layout settling");
  assert.match(f.layer.children[0].style.cssText, /transform:translate\(-50%,-50%\)/);
  assert.equal(f.layer.children[0].style.visibility, "visible");
  assert.equal(f.animations.length, 0);
  f.frame();
  assert.equal(f.pawn.style.visibility, "hidden");
  assert.equal(f.animations.length, 0, "retain double RAF for scroll anchoring");
  f.ship.x += 40;
  f.frame();
  const animation = f.animations[0];
  assert.equal(animation.element.style.left, "150px", "source rebased to settled ship");
  assert.equal(animation.options.duration, 460);
  animation.finish();
  await Promise.resolve();
  assert.equal(f.pawn.style.visibility, "visible", "restore exact inline visibility");
  assert.equal(f.layer.children.length, 0);
  assert.equal(animation.removedAtCancel, true, "no source-pose paint when fill is released");
  assert.equal(f.timers.size, 0, "handoff is not a racing timeout");
});

for (const phase of [0, 1, 2]) {
  for (const cleanup of ["reset", "render", "resize", "hidden", "destroy"]) {
    test(`${cleanup} restores moving pawn after ${phase} layout frames`, async () => {
      const f = fixture();
      f.render();
      for (let i = 0; i < phase; i++) f.frame();
      // Also exercise a resolved-but-not-yet-delivered finished callback.
      f.animations[0]?.finish();
      if (cleanup === "render") f.effects.beforeRender();
      else if (cleanup === "resize") { f.win.innerWidth--; f.listeners.get("resize")(); }
      else if (cleanup === "hidden") { f.doc.hidden = true; f.listeners.get("visibilitychange")(); }
      else f.effects[cleanup]();
      await Promise.resolve();
      assert.equal(f.pawn.style.visibility, "");
      assert.equal(f.layer.children.length, 0);
      assert.equal(f.raf.size, 0);
      assert.equal(f.timers.size, 0);
      assert.equal(f.effects.busy(), false);
    });
  }
}

test("height-only resize preserves movement and reduced motion never hides the pawn", () => {
  const f = fixture();
  f.render();
  f.listeners.get("resize")();
  assert.equal(f.pawn.style.visibility, "hidden");
  assert.equal(f.raf.size, 1);
  f.effects.destroy();
  const r = fixture({ reduced: true });
  r.render(); r.frame(); r.frame();
  assert.equal(r.pawn.style.visibility, "");
  assert.equal(r.layer.children.length, 0);
  r.effects.destroy();
});

test("without Web Animations support the destination is restored after settling", () => {
  const f = fixture({ animate: false });
  f.render(); f.frame(); f.frame();
  assert.equal(f.pawn.style.visibility, "");
  assert.equal(f.layer.children.length, 0);
  f.effects.destroy();
});


test("shared transient bursts and damage labels are removed before animation cancellation", async () => {
  const f = fixture();
  f.resolution.log = [{ type: "ship-damage", zone: "blue", source: 42 }];
  f.resolution.frames[1].ship = f.resolution.frames[0].ship;
  f.render(); f.frame(); f.frame();
  // Deliver the impact delay, but deliberately not the later removal timers.
  for (const callback of [...f.timers.values()]) callback();
  const transient = f.animations.filter(a => /^fx-/.test(a.element.className));
  assert.ok(transient.some(a => a.element.className === "fx-ring"));
  assert.ok(transient.some(a => a.element.className === "fx-spark"));
  assert.ok(transient.some(a => a.element.className === "fx-delta"));
  for (const animation of f.animations) animation.finish();
  await Promise.resolve();
  for (const animation of transient) assert.equal(animation.removedAtCancel, true);
  const flash = f.animations.find(a => !/^fx-/.test(a.element.className));
  assert.equal(flash.cancelled, true);
  assert.notEqual(flash.removedAtCancel, true, "persistent board elements are not removed");
  f.effects.destroy();
});


for (const reduced of [false, true]) {
  test(`successful final transition survives guide-only updates and plays once (reduced=${reduced})`, () => {
    const f = fixture({ reduced });
    f.resolution.frames[0].step = "computer";
    f.resolution.frames[1] = { ...f.resolution.frames[0], step: "appear" };
    f.resolution.log = [];
    f.resolution.outcome = { survived: true };
    f.render();
    // A completion notification must not reset or redraw this same board.
    f.effects.afterRender(f.resolution, 1);
    f.frame(); f.frame();
    assert.equal(f.ship.parentElement.children.filter(el => el.className === "ship-jump-effects").length, 1);
    assert.equal(f.animations.filter(a => a.element === f.ship).length, reduced ? 0 : 1);
    f.effects.afterRender(f.resolution, 1);
    assert.equal(f.raf.size, 0, "duplicate final snapshot cannot schedule another jump");
    f.effects.reset();
    f.effects.afterRender(f.resolution, 1);
    assert.equal(f.raf.size, 0, "opening the result cannot start a jump");
    assert.equal(f.ship.parentElement.children.filter(el => el.className === "ship-jump-effects").length, 0);
    f.effects.destroy();
  });
}
