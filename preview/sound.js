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
    const notes = {
      select: [[660, 0, .045]], place: [[440, 0, .065], [660, .06, .09]],
      start: [[330, 0, .09], [440, .1, .09], [660, .2, .14]],
      turn: [[300, 0, .07], [450, .08, .12]], wait: [[260, 0, .13]],
      complete: [[440, 0, .1], [550, .12, .1], [660, .24, .22]],
      back: [[440, 0, .07], [330, .08, .09]], error: [[180, 0, .12]],
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
      gain.gain.linearRampToValueAtTime(.045, at + .008);
      gain.gain.exponentialRampToValueAtTime(.001, at + duration);
      oscillator.connect(gain).connect(stereo).connect(context.destination);
      oscillator.start(at);
      oscillator.stop(at + duration + .02);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); stereo.disconnect(); };
    }
  }
  return { enable, cue, destroy() { if (context) void context.close(); } };
}
