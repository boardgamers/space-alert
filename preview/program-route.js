const zones = ["red", "white", "blue"];
const isRoom = (room) => /^(red|white|blue)-(upper|lower)$/.test(room ?? "");

// Intended movement from visible cards only. This is not a second resolver:
// threats, delays, lift contention and other crew's actions may change the result.
export function plannedRoute(program, start = "white-upper") {
  let room = isRoom(start) ? start : null;
  return program.map((slot) => {
    for (const card of slot?.cards ?? []) {
      const actions = card.sides?.[card.side];
      if (!actions) {
        room = null;
        break;
      }
      for (let action of actions) {
        if (!room) break;
        if (action.startsWith("hero:")) action = action.slice(5);
        const [zone, deck] = room.split("-");
        if (action === "red" || action === "blue")
          room = `${zones[Math.max(0, Math.min(2, zones.indexOf(zone) + (action === "red" ? -1 : 1)))]}-${deck}`;
        else if (action === "lift")
          room = `${zone}-${deck === "upper" ? "lower" : "upper"}`;
        else if (action.startsWith("teleport:"))
          room = isRoom(action.slice(9)) ? action.slice(9) : null;
        // Interceptor launch and specialist movement depend on more than this
        // crew member's cards. Stop instead of inventing a ship position.
        else if (
          (action === "C" && room === "red-upper") ||
          action.startsWith("special:teleporter:")
        )
          room = null;
      }
    }
    return room;
  });
}
