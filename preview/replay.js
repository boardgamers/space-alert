// Viewer transport only. The caller supplies already-visible frame counts;
// this controller has no engine, clock or network access.
export function createReplay({ index, count, show, busy, now = () => performance.now() }) {
  let playing = false, end = -1, due = 0;
  return {
    get playing() { return playing; },
    pause() { playing = false; },
    play() {
      end = count() - 1; // Freeze the horizon: incoming live frames are not replayed.
      if (end < 1) return;
      playing = true;
      const start = index();
      show(start === null || start >= end ? 0 : start);
      due = now() + 450;
    },
    tick() {
      if (!playing || busy() || now() < due) return;
      const current = index();
      if (current === null || count() <= end || current >= end) {
        playing = false;
        return;
      }
      show(current + 1);
      due = now() + 450;
    },
  };
}
