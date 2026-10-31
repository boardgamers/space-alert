// Short, quiet synthesized cues; no downloads, looping soundtrack or timing authority.
export function createSoundDesign() {
  let context;
  let enabled = false;
  function enable(value) {
    enabled = value;
    if (enabled) {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      context ??= new Audio();
      void context.resume().catch(() => {});
    } else if (context) void context.suspend().catch(() => {});
  }
  function cue(kind, pan = 0) {
    if (!enabled || !context || context.state !== "running") return;
    const notes =
      {
        select: [[660, 0, 0.045]],
        place: [
          [440, 0, 0.065],
          [660, 0.06, 0.09],
        ],
        remove: [
          [520, 0, 0.06],
          [310, 0.055, 0.09],
        ],
        start: [
          [330, 0, 0.09],
          [440, 0.1, 0.09],
          [660, 0.2, 0.14],
        ],
        turn: [
          [300, 0, 0.07],
          [450, 0.08, 0.12],
        ],
        wait: [[260, 0, 0.13]],
        alert: [
          [660, 0, 0.12],
          [660, 0.2, 0.12],
        ],
        lock: [
          [440, 0, 0.08],
          [220, 0.1, 0.16],
        ],
        complete: [
          [440, 0, 0.1],
          [550, 0.12, 0.1],
          [660, 0.24, 0.22],
        ],
        back: [
          [440, 0, 0.07],
          [330, 0.08, 0.09],
        ],
        error: [[180, 0, 0.12]],
      }[kind] ?? [];
    for (const [frequency, delay, duration] of notes) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const stereo = context.createStereoPanner();
      const at = context.currentTime + delay;
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      stereo.pan.value = pan;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(0.045, at + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, at + duration);
      oscillator.connect(gain).connect(stereo).connect(context.destination);
      oscillator.start(at);
      oscillator.stop(at + duration + 0.02);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
        stereo.disconnect();
      };
    }
  }
  return {
    enable,
    cue,
    destroy() {
      if (context) void context.close();
    },
  };
}
