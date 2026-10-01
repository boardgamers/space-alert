// Shared silhouettes keep the ship, cards and controls visually consistent.
const paths = {
  journal: "M5 3h14v18H5zM9 7h6M9 11h6M9 15h4",
  training: "m3 9 9-6 9 6-9 6-9-6Zm4 3v6l5 3 5-3v-6",
  ship: "m4 20 4-11L20 4l-5 12-11 4Zm4-11 7 7M3 15l6 6",
  crew: "M8 8a4 4 0 1 0 8 0 4 4 0 1 0-8 0ZM4 21v-3a8 8 0 0 1 16 0v3",
  guide: "M4 4h6l2 2 2-2h6v16h-6l-2 2-2-2H4V4Zm8 2v16",
  android: "M5 7h14v13H5zM12 3v4M10 3h4M8 11h1m6 0h1M8 16h8M2 10v6m20-6v6",
  bots: "m5 4 7-2 7 2v9l-7 4-7-4V4ZM8 8h2m4 0h2M9 12h6M4 21l2-6m14 6-2-6M9 17v4m6-4v4",
  laser: "M3 14h8v6H3zM6 14V9h4v5M9 9l8-6M14 10l7-5M17 13l5-4",
  pulse:
    "M9 12a3 3 0 1 0 6 0 3 3 0 1 0-6 0ZM6 6a8.5 8.5 0 0 0 0 12m12-12a8.5 8.5 0 0 1 0 12M3 3a13 13 0 0 0 0 18m18-18a13 13 0 0 1 0 18",
  shield: "m12 2 8 3v6c0 5-4 8-8 11-4-3-8-6-8-11V5l8-3Z",
  reactor: "m13 2-8 11h6l-1 9 9-12h-6l1-8Z",
  fuel: "M7 3h8v3H7zM5 6h14v15H5zM5 10h4m6 0h4M13 11l-4 5h3l-1 4 5-6h-3v-3Z",
  computer: "M3 3h18v13H3zM8 21h8m-4-5v5M6 7l3 2-3 2m6 1h5",
  observation:
    "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm7 0a3 3 0 1 0 6 0 3 3 0 1 0-6 0Z",
  rocket:
    "M9 15C7 7 13 2 21 3c1 8-4 14-12 12ZM9 9H5l-3 6h6m7 0v4l-6 3v-6M5 18l-3 4m13-14h2v2h-2z",
  interceptor: "m12 2 3 9 7 5v3l-8-3v5h-4v-5l-8 3v-3 7-5 3-9Z",
  left: "M21 12H3m7-7-7 7 7 7",
  right: "M3 12h18m-7-7 7 7-7 7",
  up: "M12 21V3m-7 7 7-7 7 7",
  down: "M12 3v18m-7-7 7 7 7-7",
  lift: "M8 21V3L3 8m14-5v18l5-5",
  move: "M3 12h18M8 7l-5 5 5 5m8-10 5 5-5 5",
  lock: "M6 10h12v11H6zM8 10V6a4 4 0 0 1 8 0v4m-4 5v2",
  step: "m5 4 11 8L5 20V4Zm14 0v16",
  forward: "m2 5 9 7-9 7V5Zm10 0 9 7-9 7V5Z",
  restart: "M4 10a8 8 0 1 1 1 8M4 3v7h7",
  check: "m4 12 5 5L20 6",
  close: "m5 5 14 14M5 19 19 5",
  cards: "M7 7h13v15H7zM4 18H2V2h13v2",
  combine: "M2 6h7v12H2zM15 6h7v12h-7zM9 12h6m-3-3v6",
  speaker: "M3 9h4l5-5v16l-5-5H3V9Zm13-2a7 7 0 0 1 0 10m3-13a11 11 0 0 1 0 16",
  muted: "M3 9h4l5-5v16l-5-5H3V9Zm13 0 6 6m-6 0 6-6",
  comms:
    "M12 12v9m-4 0h8M8 7a6 6 0 0 0 0 8m8-8a6 6 0 0 1 0 8M5 3a11 11 0 0 0 0 16M19 3a11 11 0 0 1 0 16M11 10h2v2h-2z",
  warning: "m12 2 10 19H2L12 2Zm0 6v6m0 3v1",
  hull: "m12 2 9 5v10l-9 5-9-5V7l9-5Zm-5 6h10v8H7z",
  speed: "M3 18a9 9 0 1 1 18 0M12 14l5-7M10 16a2 2 0 1 0 4 0 2 2 0 1 0-4 0Z",
  star: "m12 2 3 7 7 1-5 5 1 7-6-4-6 4 1-7-5-5 7-1 3-7Z",
  medic: "M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3Z",
  teleport: "M7 2C1 5 1 19 7 22m10-20c6 3 6 17 0 20M5 12h14m-5-5 5 5-5 5",
  compass: "M2 12a10 10 0 1 0 20 0 10 10 0 1 0-20 0Zm14-5-3 7-6 3 3-7 6-3Z",
  spy: "M3 8h18M5 8l3-6 4 2 4-2 3 6M4 13h6v4H4zM14 13h6v4h-6zM10 14h4",
  leader: "M6 3h12v18H6zM9 8l3-3 3 3m-6 5 3-3 3 3m-6 5 3-3 3 3",
  wrench: "m15 3-3 3 1 5 5 1 3-3a7 7 0 0 1-9 9l-6 5-4-4 6-6a7 7 0 0 1 7-10Z",
};

export const specializationIcons = {
  rocketeer: "rocket",
  "data-analyst": "cards",
  "energy-technician": "reactor",
  "pulse-gunner": "pulse",
  medic: "medic",
  teleporter: "teleport",
  hypernavigator: "compass",
  "special-ops": "spy",
  "squad-leader": "leader",
  mechanic: "wrench",
};

export function pictogram(name) {
  return `<svg class="pictogram" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${paths[name] ?? paths.star}"/></svg>`;
}

// A miniature of the actual six-room plan, readable without colour.
export function shipLocator(stations, incomingZone = null) {
  const zones = ["red", "white", "blue"];
  const incoming = zones.includes(incomingZone);
  const offset = incoming ? 22 : 0;
  const x = zones.indexOf(incomingZone) * 20 + 13;
  return `<svg class="ship-locator" viewBox="0 0 66 ${36 + offset}" aria-hidden="true" focusable="false">${incoming ? `<path class="incoming-arrow" d="M33 2v5L${x} 15v5m-4-5 4 5 4-5"/>` : ""}<path class="locator-hull" d="m7 ${2 + offset} 52 0 6 6v20l-6 6H7l-6-6v-20Z"/>${["upper", "lower"].flatMap((deck, row) => zones.map((zone, col) => `<rect x="${5 + col * 20}" y="${6 + row * 13 + offset}" width="16" height="10" rx="1" class="${stations.includes(`${zone}-${deck}`) ? "located" : ""}"/>`)).join("")}</svg>`;
}

// Large, flat equipment drawings stay readable on the cutaway's smallest rooms.
// Colours, silhouettes and action letters provide independent visual cues.
const equipment = {
  laser: `<path fill="#79949f" d="M12 48h40l6 10H6z"/><circle cx="32" cy="42" r="14" fill="#dbe7dd"/><path fill="#e6b66b" d="M20 29h24v18H20z"/><path fill="#dbe7dd" d="M23 8h7v28h-7zm13 0h7v28h-7z"/><path stroke="#ff806c" stroke-width="4" d="M26 3v11m14-11v11"/><path stroke="#243947" d="M26 41h13"/>`,
  "light-laser": `<path fill="#79949f" d="M15 47h34l5 11H10z"/><circle cx="32" cy="40" r="14" fill="#dbe7dd"/><path fill="#e6b66b" d="M23 28h18v17H23z"/><path fill="#dbe7dd" d="M28 7h8v29h-8z"/><path stroke="#ff806c" stroke-width="4" d="M32 2v11"/>`,
  pulse: `<path fill="#79949f" d="M14 46h36l6 11H8z"/><path fill="#dbe7dd" d="M23 36h18v16H23z"/><circle cx="32" cy="28" r="12" fill="#c7a1ff"/><path stroke="#c7a1ff" fill="none" stroke-width="3" d="M16 12a23 23 0 0 0 0 32m32-32a23 23 0 0 1 0 32"/><path stroke="#f2e6ff" d="M25 28h14m-7-7v14"/>`,
  shield: `<path fill="#447286" d="M10 44h44v12H10z"/><path fill="#b7edf0" d="M23 44h18v11H23z"/><path fill="#3b8f9e" stroke="#b4f7f5" d="M32 5 53 13v14c0 13-12 20-21 24-9-4-21-11-21-24V13z"/><path fill="#a4f2f1" stroke="none" d="m33 14-12 17h9l-1 11 13-19h-9z"/>`,
  reactor: `<path fill="#7f97a0" d="M14 11h36v45H14z"/><path fill="#e6b66b" d="M22 6h20v52H22z"/><path fill="#ffe9a3" stroke="none" d="M26 12h12v9H26zm0 13h12v9H26zm0 13h12v9H26z"/><path stroke="#dbe7dd" stroke-width="5" d="M14 20H7m7 20H7m43-20h7m-7 20h7"/><path fill="#dbe7dd" d="M18 3h28v7H18zm0 49h28v8H18z"/>`,
  computer: `<path fill="#dbe7dd" d="M7 8h50v33H7z"/><path fill="#285469" d="M12 13h40v23H12z"/><path stroke="#91eff1" stroke-width="3" d="m17 20 5 4-5 4m12 0h15"/><path fill="#7f97a0" d="M13 41h38l8 14H5z"/><path stroke="#dbe7dd" d="M19 47h26m-19 5h12"/>`,
  battlebots: `<path fill="#7f97a0" d="M19 43h10v16H17zm16 0h10l2 16H35zM7 25h10v23H7zm40 0h10v23H47z"/><path fill="#dbe7dd" d="M17 23h30v23H17zM21 6h22v18H21z"/><path fill="#59cedc" d="M24 11h16v6H24z"/><path fill="#e6b66b" d="M25 28h14v10H25z"/><path stroke="#dbe7dd" d="M24 3h16"/>`,
  interceptor: `<path fill="#dbe7dd" d="m32 4 8 24 17 15v9l-21-7v14h-8V45L7 52v-9l17-15z"/><path fill="#59cedc" d="m32 16 4 14h-8z"/><path stroke="#e6b66b" stroke-width="4" d="m18 41 7-5m21 5-7-5"/>`,
  observation: `<path fill="#dbe7dd" d="M4 32s10-19 28-19 28 19 28 19-10 19-28 19S4 32 4 32Z"/><circle cx="32" cy="32" r="13" fill="#59cedc"/><circle cx="32" cy="32" r="6" fill="#183447"/><circle cx="36" cy="27" r="3" fill="#f0fcff" stroke="none"/>`,
  rocket: `<path fill="#e6b66b" d="m24 34-13 12v12l17-9m12-15 13 12v12l-17-9"/><path fill="#dbe7dd" d="M24 49V22Q24 9 32 3q8 6 8 19v27z"/><path fill="#e6b66b" d="M24 23h16v9H24z"/><path fill="#59cedc" d="m27 52 5 9 5-9z"/>`,
  fuel: `<path fill="#dbe7dd" d="M22 5h20v8H22zM15 13h34v44H15z"/><path fill="#e6b66b" d="M21 22h22v26H21z"/><path fill="#fff0b8" stroke="none" d="m34 24-11 14h8l-2 9 13-17h-9z"/>`,
  fighter: `<path fill="#81959f" d="M23 13h18v20H23z"/><path fill="#dbe7dd" d="m27 12-4 16L6 39v10l20-7 6 17 6-17 20 7V39L41 28l-4-16z"/><path fill="#cc917b" d="m8 40 15-10-2 8-13 6zm48 0L41 30l2 8 13 6z"/><path fill="#6fced6" d="m32 27 4 11-4 7-4-7z"/><path stroke="#a9d8dc" stroke-width="4" d="M27 8v7m10-7v7"/>`,
  cruiser: `<path fill="#81959f" d="M5 18h12v32H5zm42 0h12v32H47z"/><path fill="#dbe7dd" d="m23 7 18 0 8 17-4 25-13 10-13-10-4-25z"/><path fill="#cc917b" d="M20 20h7v24h-7zm17 0h7v24h-7z"/><path fill="#6fced6" d="M28 14h8v15h-8z"/><path stroke="#dbe7dd" stroke-width="3" d="M9 38h4m38 0h4M9 44h4m38 0h4"/>`,
  asteroid: `<path fill="#b7ae92" d="m21 6 23 3 13 16-3 22-18 12-22-7L6 32l4-17z"/><path fill="#8c8776" d="m22 14 10 3 2 9-9 6-9-7zm17 24 10 2-2 10-12-2z"/><path stroke="#ded3b5" d="m13 35 5 10m23-28 7 7"/>`,
  "energy-cloud": `<path fill="#7b739a" stroke="#c0b4de" d="M16 18c-2-13 21-17 27-5 15-1 21 18 11 27 0 15-20 21-29 13C7 59-3 35 10 27c-2-4 0-8 6-9Z"/><path fill="#e3d3f6" stroke="none" d="m36 13-17 24h12l-4 17 18-27H33z"/>`,
  organism: `<path fill="#8eae91" stroke="#cae2bd" d="M11 23c-8-14 11-26 20-13 10-14 30-5 22 11 16 8 4 28-9 22-1 21-26 20-27 3C0 46-4 29 11 23Z"/><path fill="#314f50" stroke="#c4dfb8" d="M21 28a12 12 0 1 0 24 0 12 12 0 1 0-24 0Z"/><circle fill="#d6b477" stroke="none" cx="33" cy="28" r="5"/>`,
  swarm: `<g fill="#dbe7dd"><path d="m19 5 4 11 10 9v7l-12-4-2 9-2-9-12 4v-7l10-9zM45 9l4 11 10 9v7l-12-4-2 9-2-9-12 4v-7l10-9zM32 31l4 11 10 9v7l-12-4-2 9-2-9-12 4v-7l10-9z"/></g><path stroke="#cc917b" stroke-width="3" d="M19 18v7m26-3v7M32 44v7"/>`,
  satellite: `<path fill="#708d9e" d="M4 13h15v38H4zm41 0h15v38H45z"/><path stroke="#b9d6de" d="M5 26h13M5 38h13m28-12h13M46 38h13M19 32h26"/><path fill="#dbe7dd" d="M25 22h14v24H25z"/><path fill="#cc917b" d="M20 10h24c0 16-24 16-24 0Z"/><path stroke="#dbe7dd" d="M32 8V3m0 43v11"/>`,
  capsule: `<path fill="#dbe7dd" d="m22 5 20 0 8 12v30l-8 12H22l-8-12V17z"/><path fill="#81959f" d="M21 16h22v32H21z"/><path fill="#cc917b" d="M15 26h34v12H15z"/><path stroke="#dbe7dd" d="M27 19h10m-10 26h10"/>`,
};

export function equipmentPicture(name) {
  const drawing = equipment[name === "bots" ? "battlebots" : name];
  return drawing
    ? `<svg class="equipment-art equipment-drawing" viewBox="0 0 64 64" fill="none" stroke="#162e3d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${drawing}</svg>`
    : null;
}
