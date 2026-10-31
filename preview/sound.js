// Short layered effects. Audio follows resolved events and never controls game timing.
export function createSoundDesign() {
  let context;
  let noise;
  const voices = new Set();
  let enabled = false;
  function enable(value) {
    enabled = value;
    if (enabled) {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      context ??= new Audio();
      void context.resume().catch(() => {});
    } else if (context) {
      for (const voice of voices) { try { voice.stop(); } catch {} }
      voices.clear();
      void context.suspend().catch(() => {});
    }
  }
  function voice({ from = 440, to = from, duration = .2, volume = .035, delay = 0, type = "sine", cutoff = 1400 }, pan) {
    const source = type === "noise" ? context.createBufferSource() : context.createOscillator();
    if (type === "noise") {
      if (!noise) {
        noise = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
        const data = noise.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      }
      source.buffer = noise;
    } else {
      source.type = type;
      source.frequency.setValueAtTime(from, context.currentTime + delay);
      source.frequency.exponentialRampToValueAtTime(Math.max(20, to), context.currentTime + delay + duration);
    }
    const gain = context.createGain(), filter = context.createBiquadFilter(), stereo = context.createStereoPanner();
    const at = context.currentTime + delay;
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(cutoff, at);
    filter.frequency.exponentialRampToValueAtTime(Math.max(80, cutoff * .2), at + duration);
    stereo.pan.value = Math.max(-1, Math.min(1, pan));
    gain.gain.setValueAtTime(.0001, at);
    gain.gain.exponentialRampToValueAtTime(volume, at + .008);
    gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
    source.connect(filter).connect(gain).connect(stereo).connect(context.destination);
    voices.add(source);
    source.onended = () => {
      voices.delete(source);
      source.disconnect(); filter.disconnect(); gain.disconnect(); stereo.disconnect();
    };
    source.start(at); source.stop(at + duration + .02);
  }
  function cue(kind, pan = 0) {
    if (!enabled || !context || context.state !== "running") return;
    const layers = {
      move: [
        { from: 180, to: 370, type: "triangle", duration: .22, volume: .018 },
        { type: "noise", cutoff: 700, duration: .15, delay: .2, volume: .025 },
      ],
      charge: [{ from: 150, to: 680, duration: .22, volume: .016 }],
      "laser-fire": [
        { from: 1500, to: 160, type: "sawtooth", cutoff: 4200, duration: .22, volume: .045 },
        { from: 2100, to: 440, duration: .15, volume: .022 },
      ],
      "shield-hit": [
        { type: "noise", cutoff: 4800, duration: .18, volume: .055 },
        { from: 920, to: 540, duration: .3, volume: .035 },
      ],
      "hull-hit": [
        { type: "noise", cutoff: 2000, duration: .3, volume: .075 },
        { from: 150, to: 45, type: "triangle", duration: .3, volume: .08 },
      ],
      explosion: [
        { type: "noise", cutoff: 2800, duration: .75, volume: .12 },
        { from: 110, to: 25, duration: .65, volume: .12 },
        { type: "noise", cutoff: 600, delay: .12, duration: .55, volume: .06 },
      ],
    }[kind];
    if (layers) { for (const layer of layers) voice(layer, pan); return; }
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
      voices.add(oscillator);
      oscillator.onended = () => {
        voices.delete(oscillator);
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
