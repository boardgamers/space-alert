import { pictogram } from "./icons.js";

// Presentation only: consume resolved events, never predict damage or change game state.
export function resolutionEffects(resolution, before, after) {
  if (!before || !after || before === after || after.logEnd < before.logEnd) return [];
  const events = resolution.log.slice(before.logEnd, after.logEnd);
  const fires = resolution.log.filter(e => e.turn === after.turn && e.type === "fire");
  const effects = [];
  for (const e of events) {
    if (e.type === "move" && e.from !== e.to) effects.push({ ...e, kind: "move" });
    if (e.type === "fire") effects.push({ ...e, kind: "charge" });
    if (e.type === "threat-hit" || e.type === "cryoshield-broken") {
      const target = after.threats.find(t => t.instance === e.threat);
      // A zone has one heavy and one light laser; the log supplies the weapons
      // that actually hit. No guessed target or beam through an immune enemy.
      const sources = fires.filter(f => {
        const weapon = f.station === "white-lower" ? "pulse" : f.station.endsWith("upper") ? "heavy" : "light";
        return (!e.weapons || e.weapons.includes(weapon)) &&
          (weapon === "pulse" || f.station.split("-")[0] === target?.zone);
      }).map(f => ({ station: f.station, weapon: f.station === "white-lower" ? "pulse" : "laser" }));
      if (e.weapons?.includes("rocket")) sources.push({ station: "blue-lower", weapon: "rocket" });
      if (e.weapons?.includes("interceptors")) sources.push({ station: "red-upper", weapon: "laser" });
      effects.push({ kind: "hit", threat: e.threat, damage: e.damage ?? 0, shield: e.shield ?? 1, sources });
    }
    if (e.type === "attack") effects.push({ ...e, kind: "attack" });
    if (e.type === "ship-damage" && !events.some(a => a.type === "attack" && a.zone === e.zone && a.threat === e.source)) {
      if (!effects.some(a => a.kind === "direct-damage" && a.zone === e.zone && a.threat === e.source))
        effects.push({ kind: "direct-damage", zone: e.zone, threat: e.source,
          damage: events.filter(a => a.type === "ship-damage" && a.zone === e.zone && a.source === e.source).length });
    }
    if (e.type === "threat-destroyed" && !e.prevented) effects.push({ kind: "destroy", threat: e.threat });
    if (e.type === "ship-destroyed") effects.push({ kind: "ship-destroy", zone: e.zone });
  }
  // Teleports, forced movement, repairs and non-weapon damage also change the
  // displayed board, without necessarily producing move/threat-hit log entries.
  for (const crew of after.ship.crew) {
    const old = before.ship.crew.find(p => p.id === crew.id);
    if (old && old.station !== crew.station && !effects.some(e => e.kind === "move" && e.crew === crew.id))
      effects.push({ kind: "move", crew: crew.id, from: old.station, to: crew.station });
  }
  for (const target of after.threats) {
    const old = before.threats.find(t => t.instance === target.instance);
    const damage = (target.damage ?? 0) - (old?.damage ?? 0);
    if (old && damage > 0 && !effects.some(e => e.kind === "hit" && e.threat === target.instance))
      effects.push({ kind: "hit", threat: target.instance, damage, shield: 0, sources: [] });
  }
  // Firing into empty space still fires, but must never look like a hit.
  if (before.step === "damage" && after.step === "threats") {
    for (const f of fires)
      if (!effects.some(e => e.kind === "hit" && e.sources.some(s => s.station === f.station)))
        effects.push({ kind: "miss", station: f.station });
  }
  // Survival is only confirmed after the final threat movement. A completed
  // three-turn exercise, an old replay frame or a destroyed ship is not a jump.
  if (resolution.outcome?.survived && after === resolution.frames.at(-1) &&
      before.step === "computer" && after.step === "appear")
    effects.push({ kind: "jump" });
  return effects;
}

export function createResolutionEffects(root, cue) {
  const doc = root.ownerDocument;
  const win = doc.defaultView;
  const reduced = win.matchMedia("(prefers-reduced-motion: reduce)");
  const layer = doc.createElement("div");
  layer.className = "resolution-effects";
  layer.setAttribute("aria-hidden", "true");
  root.querySelector(".flight-layout").append(layer);
  let previous = null, previousIndex = -1, busyUntil = 0, pendingFrame = null;
  let oldPawns = new Map();
  let oldShip = null;
  const animations = new Set(), timers = new Set(), restores = [];
  const q = selector => root.querySelector(selector);
  const threat = id => q(`[data-threat="${id}"] .threat-portrait`);
  const room = station => q(`[data-station="${station}"]`);
  const weapon = station => q(`[data-inspect="system-${station}-A"] > .equipment-art`) ?? room(station);
  const art = element => element?.querySelector(":scope > .equipment-art") ?? element;
  function point(element) {
    if (!element?.getClientRects().length) return null;
    const r = element.getBoundingClientRect(), base = layer.getBoundingClientRect();
    return { x: r.left + r.width / 2 - base.left, y: r.top + r.height / 2 - base.top, width: r.width, height: r.height };
  }
  function later(callback, ms) {
    const id = win.setTimeout(() => { timers.delete(id); callback(); }, ms);
    timers.add(id);
  }
  function animate(element, frames, duration, delay = 0, easing = "ease-out") {
    if (!element?.animate) return;
    const animation = element.animate(frames, { duration, delay, easing, fill: "both" });
    animations.add(animation);
    animation.finished.then(() => { animations.delete(animation); animation.cancel(); }, () => {});
    busyUntil = Math.max(busyUntil, performance.now() + duration + delay);
  }
  function clear() {
    if (pendingFrame !== null) win.cancelAnimationFrame(pendingFrame);
    pendingFrame = null;
    for (const id of timers) win.clearTimeout(id);
    timers.clear();
    for (const animation of animations) animation.cancel();
    animations.clear();
    for (const restore of restores.splice(0)) restore();
    layer.replaceChildren();
    busyUntil = 0;
  }
  function node(name, p, color, parent = layer) {
    const element = doc.createElement("span");
    element.className = name;
    element.style.cssText = `left:${p.x}px;top:${p.y}px;--fx-color:${color}`;
    parent.append(element);
    return element;
  }
  function burst(p, color, large = false) {
    if (!p) return;
    const ring = node("fx-ring", p, color);
    animate(ring, [{ transform: `translate(-50%,-50%) scale(${reduced.matches ? 1 : .2})`, opacity: .9 },
      { transform: `translate(-50%,-50%) scale(${reduced.matches ? 1 : large ? 3 : 1.5})`, opacity: 0 }], large ? 650 : 380);
    later(() => ring.remove(), 700);
    if (reduced.matches) return;
    for (let i = 0; i < (large ? 18 : 7); i++) {
      const spark = node("fx-spark", p, color);
      const angle = i * 2.39996, distance = (large ? 65 : 26) + (i % 4) * 9;
      animate(spark, [{ transform: "translate(-50%,-50%) scale(1)", opacity: 1 },
        { transform: `translate(${Math.cos(angle) * distance}px,${Math.sin(angle) * distance}px) scale(.1)`, opacity: 0 }], large ? 700 : 400);
      later(() => spark.remove(), 750);
    }
  }
  function flash(element, color) {
    animate(element, [{ boxShadow: `inset 0 0 24px ${color}`, filter: "brightness(1.35)" },
      { boxShadow: "inset 0 0 0 transparent", filter: "brightness(1)" }], 380);
  }
  function fly(from, to, color, kind = "laser") {
    if (!from || !to || reduced.matches) return;
    const dx = to.x - from.x, dy = to.y - from.y;
    const beam = node(`fx-beam fx-${kind}`, from, color);
    beam.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
    const bolt = doc.createElement("i");
    beam.append(bolt);
    animate(bolt, [{ transform: "translateX(0)", opacity: 1 },
      { transform: `translateX(${Math.hypot(dx, dy)}px)`, opacity: 1 }], 300);
    later(() => beam.remove(), 310);
  }
  function delta(p, value, color, icon = "") {
    if (!p || !value) return;
    const n = node("fx-delta", p, color);
    // Cancelling the finished animation restores the underlying style before
    // the removal timer runs. Keep that style hidden to avoid a one-frame flash.
    n.style.opacity = "0";
    n.textContent = `${icon}−${value}`;
    animate(n, [{ transform: "translate(-50%,-20%)", opacity: 1 },
      { transform: `translate(-50%,${reduced.matches ? "-20%" : "-140%"})`, opacity: 0 }], 750);
    later(() => n.remove(), 760);
  }
  function deferMarkup(element, oldMarkup, delay) {
    if (!element || oldMarkup === undefined) return;
    const final = element.innerHTML;
    element.innerHTML = oldMarkup;
    const restore = () => { element.innerHTML = final; };
    restores.push(restore);
    later(restore, delay);
  }
  function jump(sound) {
    const vessel = q(".ship-vessel"), position = point(vessel);
    if (!position) return;
    // Keep the jump attached to the ship even if completion text changes the
    // page's scroll position.
    const stage = doc.createElement("div");
    stage.className = "ship-jump-effects";
    stage.setAttribute("aria-hidden", "true");
    vessel.parentElement.append(stage);
    restores.push(() => stage.remove());
    const bounds = vessel.getBoundingClientRect(), base = stage.getBoundingClientRect();
    const p = { x: bounds.left - base.left + bounds.width / 2,
      y: bounds.top - base.top + bounds.height / 2, width: bounds.width, height: bounds.height };
    const jumpSound = kind => sound(kind, position);
    const duration = reduced.matches ? 900 : 2800;
    const departure = reduced.matches ? 0 : 1100;
    const arrival = reduced.matches ? 0 : 1500;
    if (!reduced.matches) {
      jumpSound("thruster");
      for (const nozzle of vessel.querySelectorAll(".ship-stern i")) {
        animate(nozzle, [
          { transform: "translateY(12px) scaleY(1)", filter: "brightness(1)" },
          { transform: "translateY(12px) scaleY(2.5)", filter: "brightness(1.6)", offset: .5 },
          { transform: "translateY(12px) scaleY(5)", filter: "brightness(2.3)", offset: .76 },
          { transform: "translateY(12px) scaleY(5)", filter: "brightness(2.3)" },
        ], 1450, 0, "linear");
      }
      animate(vessel, [
        { transform: "translateY(0) scale(1)", opacity: 1 },
        { transform: "translateY(-5px) scale(1)", opacity: 1, offset: departure / duration },
        { transform: `translateY(${-p.height * .3}px) scale(.08,.6)`, opacity: 0, offset: .52 },
        { transform: "translateY(0) scale(1)", opacity: 0, offset: .78 },
        { transform: "translateY(0) scale(1)", opacity: 1 },
      ], duration, 0, "linear");
      later(() => {
        jumpSound("jump");
        // Streaks stay around the ship instead of flashing the whole screen.
        for (let i = 0; i < 22; i++) {
          const star = node("fx-jump-star", {
            x: p.x + ((i * .618034) % 1 - .5) * p.width,
            y: p.y + ((i * .381966) % 1 - .5) * p.height,
          }, "#a1f4ef", stage);
          animate(star, [
            { transform: "scaleY(.2)", opacity: 0 },
            { transform: "translateY(20px) scaleY(1)", opacity: .8, offset: .3 },
            { transform: "translateY(90px) scaleY(2)", opacity: 0 },
          ], 550);
          later(() => star.remove(), 560);
        }
      }, departure);
    } else {
      animate(vessel, [{ filter: "brightness(1.15)" }, { filter: "brightness(1)" }], 500);
    }
    later(() => {
      jumpSound("victory");
      const seal = node("fx-jump-success", p, "#76e5c6", stage);
      seal.innerHTML = pictogram("check");
      animate(seal, [
        { transform: `translate(-50%,-50%) scale(${reduced.matches ? 1 : .85})`, opacity: 0 },
        { transform: "translate(-50%,-50%) scale(1)", opacity: 1, offset: .2 },
        { transform: "translate(-50%,-50%) scale(1)", opacity: 1, offset: .7 },
        { transform: "translate(-50%,-50%) scale(1)", opacity: 0 },
      ], duration - arrival);
      later(() => stage.remove(), duration - arrival);
    }, arrival);
    busyUntil = Math.max(busyUntil, performance.now() + duration);
  }
  function play(events, before, after, oldMeters) {
    const delay = reduced.matches ? 0 : 310;
    const spoken = new Set();
    const sound = (kind, p) => {
      if (spoken.has(kind)) return;
      spoken.add(kind);
      cue(kind, p ? Math.max(-.7, Math.min(.7,
        (p.x + layer.getBoundingClientRect().left) / Math.max(1, win.innerWidth) * 2 - 1)) : 0);
    };
    const moved = new Set();
    for (const e of events) {
      if (e.kind === "jump") jump(sound);
      if (e.kind === "move" && !moved.has(e.crew)) {
        moved.add(e.crew);
        const pawn = q(`[data-crew="${e.crew}"]`), from = oldPawns.get(String(e.crew)), to = point(pawn);
        if (!pawn || !from || !to) continue;
        sound("move", to);
        if (reduced.matches) { flash(room(e.to), "#76e5c660"); continue; }
        const clone = pawn.cloneNode(true);
        clone.removeAttribute("data-crew");
        clone.classList.add("fx-pawn");
        clone.style.cssText += `;left:${from.x}px;top:${from.y}px;width:${from.width}px;height:${from.height}px`;
        layer.append(clone);
        pawn.style.visibility = "hidden";
        const restore = () => { pawn.style.visibility = ""; };
        restores.push(restore);
        const path = events.filter(x => x.kind === "move" && x.crew === e.crew);
        const points = [from, ...path.slice(0, -1).map(x => point(room(x.to))).filter(Boolean), to];
        animate(clone, points.map(p => ({ transform: `translate(calc(-50% + ${p.x - from.x}px),calc(-50% + ${p.y - from.y}px))` })), 460);
        later(() => { restore(); clone.remove(); }, 465);
      }
      if (e.kind === "charge") {
        flash(weapon(e.station), "#8eeaff80");
        sound("charge", point(weapon(e.station)));
      }
      if (e.kind === "miss") {
        const from = point(weapon(e.station));
        if (from) fly(from, { x: from.x, y: from.y - 100 }, "#8eeaff");
        sound("laser-fire", from);
      }
      if (e.kind === "hit") {
        const portrait = threat(e.threat), targetArt = art(portrait), to = point(targetArt);
        for (const source of e.sources) fly(point(weapon(source.station)), to, "#8eeaff", source.weapon);
        if (e.sources.length) sound("laser-fire", to);
        deferMarkup(portrait?.querySelector(".threat-hud"), oldMeters.get(`threat-${e.threat}`), delay);
        later(() => {
          if (e.shield) { burst(to, "#8eeaff"); flash(portrait?.querySelector(".shield-badge"), "#8eeaff80"); sound("shield-hit", to); }
          if (e.damage) {
            flash(portrait?.querySelector(".hull-gauge"), "#ffb78090");
            burst(to, "#ffca86"); delta(point(portrait?.querySelector(".hull-gauge")), e.damage, "#ffca86");
            sound("hull-hit", to);
          }
        }, delay);
      }
      if (e.kind === "attack" || e.kind === "direct-damage") {
        const portrait = threat(e.threat), from = point(art(portrait));
        const station = room(`${e.zone}-upper`), to = point(station);
        const impact = after.threats.find(t => t.instance === e.threat)?.positionOnTrack === 1;
        fly(from, to, "#ffab7d", impact ? "impact" : "laser");
        const meter = station?.querySelector(".energy-system .system-caption");
        deferMarkup(meter, oldMeters.get(`shield-${e.zone}`), delay);
        deferMarkup(station?.querySelector(".station-title"), oldMeters.get(`damage-${e.zone}`), delay);
        later(() => {
          if (e.absorbed) { burst(to, "#8eeaff"); flash(station, "#8eeaff60"); delta(point(meter), e.absorbed, "#8eeaff", "⛨"); sound("shield-hit", to); }
          if (e.damage) { burst(to, "#ffb780", impact); flash(station, "#ffb78080"); delta(to, e.damage, "#ffb780"); sound(impact ? "explosion" : "hull-hit", to); }
        }, delay);
      }
      if (e.kind === "destroy" || e.kind === "ship-destroy") {
        const element = e.kind === "destroy" ? art(threat(e.threat)) : q(".ship-hull");
        const p = point(element);
        const portrait = e.kind === "destroy" ? threat(e.threat) : null;
        const outcome = portrait?.querySelector(".threat-outcome");
        if (outcome) { outcome.style.visibility = "hidden"; restores.push(() => { outcome.style.visibility = ""; }); }
        // Keep the intact silhouette until the shot lands, then break it apart.
        animate(element, [{ opacity: 1, filter: "brightness(1)" }, { opacity: 1, filter: "brightness(1)" }], delay);
        later(() => {
          if (outcome) outcome.style.visibility = "";
          burst(p, "#ffd193", true); sound("explosion", p);
          animate(element, [{ opacity: 1, filter: "brightness(2)", transform: "scale(1)" },
            { opacity: .18, filter: "brightness(.6)", transform: reduced.matches ? "scale(1)" : "scale(.82)" }], 650);
        }, delay);
      }
    }
    if (events.length) busyUntil = Math.max(busyUntil, performance.now() +
      (events.some(e => ["hit", "attack", "direct-damage", "destroy", "ship-destroy"].includes(e.kind)) ? delay + 780 : 480));
  }
  let oldMeters = new Map();
  function beforeRender() {
    clear();
    oldShip = point(q(".ship-vessel"));
    oldPawns = new Map([...root.querySelectorAll("[data-crew]")].map(p => [p.dataset.crew, point(p)]));
    oldMeters = new Map([...root.querySelectorAll("[data-threat]")].map(p => [`threat-${p.dataset.threat}`, p.querySelector(".threat-hud")?.innerHTML]));
    for (const zone of ["red", "white", "blue"]) {
      oldMeters.set(`shield-${zone}`, room(`${zone}-upper`)?.querySelector(".energy-system .system-caption")?.innerHTML);
      oldMeters.set(`damage-${zone}`, room(`${zone}-upper`)?.querySelector(".station-title")?.innerHTML);
    }
  }
  function afterRender(resolution, index) {
    const current = resolution?.frames[index];
    if (current && previous && index === previousIndex + 1 && !doc.hidden) {
      const events = resolutionEffects(resolution, previous, current), before = previous;
      if (events.length) {
        // Tutorial completion also updates the guide and removes controls. Let
        // layout and scroll anchoring settle before locating beams and targets.
        busyUntil = performance.now() + 1000;
        pendingFrame = win.requestAnimationFrame(() => {
          pendingFrame = win.requestAnimationFrame(() => {
            pendingFrame = null;
            const ship = point(q(".ship-vessel"));
            if (oldShip && ship)
              oldPawns = new Map([...oldPawns].map(([id, p]) => [id, p && {
                ...p, x: p.x + ship.x - oldShip.x, y: p.y + ship.y - oldShip.y,
              }]));
            busyUntil = 0;
            play(events, before, current, oldMeters);
          });
        });
      }
    }
    previous = current;
    previousIndex = index;
  }
  // Effects are attached to the board, so scrolling and BGS changing the
  // iframe's height on completion cannot cancel a killing shot. A width
  // change can reflow the ship/target columns and invalidate their positions.
  let viewportWidth = win.innerWidth;
  const resize = () => {
    if (win.innerWidth !== viewportWidth) clear();
    viewportWidth = win.innerWidth;
  };
  win.addEventListener("resize", resize);
  const visibility = () => { if (doc.hidden) clear(); };
  doc.addEventListener("visibilitychange", visibility);
  return {
    beforeRender, afterRender,
    busy: () => performance.now() < busyUntil,
    reset() { clear(); previous = null; previousIndex = -1; },
    destroy() {
      clear(); layer.remove();
      win.removeEventListener("resize", resize);
      doc.removeEventListener("visibilitychange", visibility);
    },
  };
}
