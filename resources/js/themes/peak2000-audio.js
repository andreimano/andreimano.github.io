// Sounds for the "peak 2000s" theme.
//
// Everything is synthesized with the Web Audio API: there are no audio files,
// and the tune is an original 16-bar loop written for this site in the spirit
// of a General MIDI homepage song. Nothing makes a sound until the visitor
// presses play (or un-mutes), so the page is silent by default.

const BPM = 126;
const EIGHTH = 60 / BPM / 2;
const SIXTEENTH = EIGHTH / 2;
const BAR = EIGHTH * 8;
const MASTER = 0.8;

const SEMITONES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function hz(note) {
  const [, letter, accidental, octave] = /^([A-G])([#b]?)(\d)$/.exec(note);
  const shift = accidental === "#" ? 1 : accidental === "b" ? -1 : 0;
  const midi = (Number(octave) + 1) * 12 + SEMITONES[letter] + shift;
  return 440 * 2 ** ((midi - 69) / 12);
}

// One string per bar, "NOTE:length" in eighth notes ("R" is a rest).
const MELODY = [
  "G4:1 C5:1 E5:2 D5:1 C5:1 E5:2",
  "A4:1 C5:1 E5:2 G5:2 E5:2",
  "F5:2 E5:1 D5:1 C5:2 A4:2",
  "B4:2 D5:2 G5:3 R:1",
  "G4:1 C5:1 E5:2 D5:1 C5:1 G5:2",
  "A5:2 G5:1 E5:1 C5:2 E5:2",
  "F5:2 A5:2 G5:2 B4:2",
  "C5:6 R:2",
  "A5:1 A5:1 G5:1 F5:1 E5:2 F5:2",
  "G5:3 D5:1 B4:2 D5:2",
  "E5:1 G5:1 B5:2 A5:1 G5:1 E5:2",
  "C6:3 B5:1 A5:4",
  "A5:1 G5:1 F5:1 A5:1 C6:2 A5:2",
  "B5:2 G5:2 D5:2 B4:2",
  "C5:1 E5:1 G5:1 C6:1 E6:2 D6:2",
  "C6:6 R:2",
].map((bar) =>
  bar.split(" ").map((token) => {
    const [note, length] = token.split(":");
    return { note, length: Number(length) };
  }),
);

// Chords per bar; "F/G" means F for the first half of the bar, G for the second.
const CHORDS = ["C", "Am", "F", "G", "C", "Am", "F/G", "C", "F", "G", "Em", "Am", "F", "G", "C", "C"];
const VOICINGS = {
  C: ["C4", "E4", "G4"],
  Am: ["A3", "C4", "E4"],
  F: ["A3", "C4", "F4"],
  G: ["B3", "D4", "G4"],
  Em: ["B3", "E4", "G4"],
};
const ROOTS = { C: "C2", Am: "A2", F: "F2", G: "G2", Em: "E2" };

export function createAudio({ onChange } = {}) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const state = { muted: true, playing: false, volume: 0.6, startedAt: 0 };

  let ctx = null;
  let input = null;
  let master = null;
  let analyser = null;
  let sfxBus = null;
  let reverb = null;
  let echo = null;
  let noise = null;
  let session = null;

  const notify = () => onChange && onChange({ ...state });

  function ensure() {
    if (!AudioContextClass) return null;
    if (!ctx) {
      ctx = new AudioContextClass();

      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -14;
      compressor.ratio.value = 4;

      master = ctx.createGain();
      master.gain.value = state.volume * MASTER;

      analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.72;

      input = compressor;
      compressor.connect(analyser);
      analyser.connect(master);
      master.connect(ctx.destination);

      sfxBus = ctx.createGain();
      sfxBus.connect(compressor);

      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const samples = noise.getChannelData(0);
      for (let i = 0; i < samples.length; i += 1) samples[i] = Math.random() * 2 - 1;

      reverb = ctx.createConvolver();
      reverb.buffer = impulse(ctx, 1.6);
      const reverbReturn = ctx.createGain();
      reverbReturn.gain.value = 0.22;
      reverb.connect(reverbReturn);
      reverbReturn.connect(compressor);

      echo = ctx.createDelay(1);
      echo.delayTime.value = EIGHTH * 1.5;
      const feedback = ctx.createGain();
      feedback.gain.value = 0.28;
      const echoReturn = ctx.createGain();
      echoReturn.gain.value = 0.2;
      echo.connect(feedback);
      feedback.connect(echo);
      echo.connect(echoReturn);
      echoReturn.connect(compressor);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  // Instruments ------------------------------------------------------------

  function envelope(gain, t, peak, attack, sustain, decay, end, release) {
    gain.setValueAtTime(0, t);
    gain.linearRampToValueAtTime(peak, t + attack);
    gain.setTargetAtTime(sustain, t + attack, decay);
    gain.setTargetAtTime(0, Math.max(t + attack, end), release);
  }

  function lead(out, t, freq, duration) {
    const end = t + duration - 0.02;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 2600;
    const amp = ctx.createGain();
    envelope(amp.gain, t, 0.07, 0.008, 0.045, 0.08, end, 0.035);
    filter.connect(amp);
    amp.connect(out.dry);
    amp.connect(out.echo);
    amp.connect(out.reverb);

    const vibrato = ctx.createOscillator();
    vibrato.frequency.value = 5.6;
    const depth = ctx.createGain();
    depth.gain.setValueAtTime(0, t);
    depth.gain.linearRampToValueAtTime(duration > 0.3 ? freq * 0.007 : 0, t + 0.28);
    vibrato.connect(depth);

    [0, 8].forEach((detune) => {
      const osc = ctx.createOscillator();
      osc.type = "square";
      osc.frequency.value = freq;
      osc.detune.value = detune;
      depth.connect(osc.frequency);
      osc.connect(filter);
      osc.start(t);
      osc.stop(end + 0.3);
    });
    vibrato.start(t);
    vibrato.stop(end + 0.3);
  }

  function stab(out, t, notes) {
    notes.forEach((note) => {
      const freq = hz(note);
      const amp = ctx.createGain();
      envelope(amp.gain, t, 0.045, 0.004, 0.012, 0.05, t + 0.14, 0.05);
      amp.connect(out.dry);
      amp.connect(out.reverb);
      [["triangle", 1, 1], ["sine", 2, 0.35]].forEach(([type, ratio, level]) => {
        const osc = ctx.createOscillator();
        const mix = ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq * ratio;
        mix.gain.value = level;
        osc.connect(mix);
        mix.connect(amp);
        osc.start(t);
        osc.stop(t + 0.5);
      });
    });
  }

  function pad(out, t, notes, duration) {
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 950;
    const amp = ctx.createGain();
    envelope(amp.gain, t, 0.02, 0.18, 0.016, 0.3, t + duration - 0.1, 0.18);
    filter.connect(amp);
    amp.connect(out.dry);
    amp.connect(out.reverb);
    notes.forEach((note, index) => {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = hz(note);
      osc.detune.value = (index - 1) * 6;
      osc.connect(filter);
      osc.start(t);
      osc.stop(t + duration + 0.8);
    });
  }

  function bass(out, t, freq) {
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = freq;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.Q.value = 5;
    filter.frequency.setValueAtTime(1300, t);
    filter.frequency.exponentialRampToValueAtTime(260, t + 0.14);
    const amp = ctx.createGain();
    envelope(amp.gain, t, 0.2, 0.004, 0.08, 0.06, t + EIGHTH * 0.8, 0.03);
    osc.connect(filter);
    filter.connect(amp);
    amp.connect(out.dry);
    osc.start(t);
    osc.stop(t + EIGHTH + 0.2);
  }

  function kick(out, t) {
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(44, t + 0.11);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.55, t);
    amp.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    osc.connect(amp);
    amp.connect(out.dry);
    osc.start(t);
    osc.stop(t + 0.3);
  }

  function hiss(out, t, { type, frequency, q = 0.7, peak, decay, send = false }) {
    const source = ctx.createBufferSource();
    source.buffer = noise;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = q;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(peak, t);
    amp.gain.exponentialRampToValueAtTime(0.0008, t + decay);
    source.connect(filter);
    filter.connect(amp);
    amp.connect(out.dry);
    if (send) amp.connect(out.reverb);
    source.start(t, Math.random() * 0.5);
    source.stop(t + decay + 0.02);
  }

  function snare(out, t) {
    hiss(out, t, { type: "bandpass", frequency: 1900, q: 0.8, peak: 0.3, decay: 0.15, send: true });
    const body = ctx.createOscillator();
    body.type = "triangle";
    body.frequency.setValueAtTime(200, t);
    body.frequency.exponentialRampToValueAtTime(120, t + 0.08);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.22, t);
    amp.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    body.connect(amp);
    amp.connect(out.dry);
    body.start(t);
    body.stop(t + 0.1);
  }

  // Song -------------------------------------------------------------------

  function scheduleBar(out, index, t) {
    const chord = CHORDS[index];
    const [first, second = first] = chord.split("/");

    let step = 0;
    MELODY[index].forEach(({ note, length }) => {
      if (note !== "R") lead(out, t + step * EIGHTH, hz(note), length * EIGHTH);
      step += length;
    });

    for (let eighth = 0; eighth < 8; eighth += 1) {
      const name = eighth < 4 ? first : second;
      const root = hz(ROOTS[name]);
      bass(out, t + eighth * EIGHTH, eighth % 2 ? root * 2 : root);
      if (eighth % 2) stab(out, t + eighth * EIGHTH, VOICINGS[name]);
    }
    pad(out, t, VOICINGS[first], second === first ? BAR : BAR / 2);
    if (second !== first) pad(out, t + BAR / 2, VOICINGS[second], BAR / 2);

    for (let sixteenth = 0; sixteenth < 16; sixteenth += 1) {
      const at = t + sixteenth * SIXTEENTH;
      if (sixteenth === 0 || sixteenth === 8 || (index >= 8 && sixteenth === 10)) kick(out, at);
      if (sixteenth === 4 || sixteenth === 12) snare(out, at);
      if (sixteenth % 2 === 0) {
        const open = sixteenth === 14 && index % 2 === 1;
        hiss(out, at, {
          type: "highpass",
          frequency: open ? 6500 : 7500,
          peak: sixteenth % 4 === 2 ? 0.09 : 0.05,
          decay: open ? 0.22 : 0.035,
        });
      }
    }
    if (index === 0 || index === 8) {
      hiss(out, t, { type: "highpass", frequency: 3600, peak: 0.1, decay: 1.4, send: true });
    }
  }

  function startSong() {
    const context = ensure();
    if (!context || session) return;
    const out = { dry: context.createGain(), echo: context.createGain(), reverb: context.createGain() };
    out.dry.connect(input);
    out.echo.connect(echo);
    out.reverb.connect(reverb);
    out.reverb.gain.value = 0.35;

    const current = { out, bar: 0, next: context.currentTime + 0.08, timer: 0 };
    const tick = () => {
      if (current.next < context.currentTime) current.next = context.currentTime + 0.05;
      while (current.next < context.currentTime + 1.5) {
        scheduleBar(out, current.bar, current.next);
        current.next += BAR;
        current.bar = (current.bar + 1) % MELODY.length;
      }
    };
    current.timer = window.setInterval(tick, 120);
    tick();
    session = current;
    state.playing = true;
    state.startedAt = context.currentTime;
    notify();
  }

  function stopSong() {
    if (!session) return;
    const { out, timer } = session;
    window.clearInterval(timer);
    const nodes = Object.values(out);
    nodes.forEach((node) => node.gain.setTargetAtTime(0, ctx.currentTime, 0.04));
    window.setTimeout(() => nodes.forEach((node) => node.disconnect()), 600);
    session = null;
    state.playing = false;
    notify();
  }

  // Sound effects ------------------------------------------------------------

  function tone(freq, t, duration, peak, type = "sine") {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(peak, t + 0.005);
    amp.gain.setValueAtTime(peak, t + duration - 0.01);
    amp.gain.linearRampToValueAtTime(0, t + duration);
    osc.connect(amp);
    amp.connect(sfxBus);
    osc.start(t);
    osc.stop(t + duration + 0.02);
    return osc;
  }

  const sfx = {
    click() {
      if (state.muted || !ensure()) return;
      hiss({ dry: sfxBus, reverb: sfxBus }, ctx.currentTime, { type: "bandpass", frequency: 2800, q: 1.2, peak: 1, decay: 0.018 });
    },
    blip() {
      if (state.muted || !ensure()) return;
      const t = ctx.currentTime;
      const osc = tone(1320, t, 0.045, 0.2, "square");
      osc.frequency.setValueAtTime(1320, t);
      osc.frequency.exponentialRampToValueAtTime(1980, t + 0.04);
    },
    chime() {
      if (state.muted || !ensure()) return;
      const t = ctx.currentTime + 0.02;
      ["C5", "E5", "G5", "C6", "E6"].forEach((note, index) => {
        const at = t + index * 0.075;
        const osc = ctx.createOscillator();
        osc.type = "triangle";
        osc.frequency.value = hz(note);
        const amp = ctx.createGain();
        amp.gain.setValueAtTime(0, at);
        amp.gain.linearRampToValueAtTime(0.09, at + 0.006);
        amp.gain.exponentialRampToValueAtTime(0.001, at + 0.6);
        osc.connect(amp);
        amp.connect(sfxBus);
        amp.connect(reverb);
        osc.start(at);
        osc.stop(at + 0.62);
      });
    },
    // A (much shortened) dial-up handshake. Returns its length in seconds.
    modem() {
      if (!ensure()) return 0;
      const t0 = ctx.currentTime + 0.05;
      let t = t0;
      tone(350, t, 0.55, 0.04);
      tone(440, t, 0.55, 0.04);
      t += 0.7;
      const keypad = { 1: [697, 1209], 3: [697, 1477], 5: [770, 1336], 7: [852, 1209] };
      for (const digit of "5551337") {
        const [low, high] = keypad[digit];
        tone(low, t, 0.085, 0.045);
        tone(high, t, 0.085, 0.045);
        t += 0.13;
      }
      t += 0.35;
      tone(2100, t, 0.8, 0.035);
      t += 0.9;
      for (let i = 0; i < 8; i += 1) {
        tone(i % 2 ? 1850 : 1650, t, 0.07, 0.022, "square");
        t += 0.07;
      }
      tone(980, t, 0.3, 0.05);
      tone(1180, t + 0.06, 0.28, 0.035);
      t += 0.35;
      hiss({ dry: sfxBus, reverb: sfxBus }, t, { type: "bandpass", frequency: 2300, q: 0.6, peak: 0.12, decay: 1.3 });
      const chirp = tone(900, t, 1.2, 0.025, "sawtooth");
      chirp.frequency.setValueAtTime(900, t);
      chirp.frequency.exponentialRampToValueAtTime(3100, t + 0.55);
      chirp.frequency.exponentialRampToValueAtTime(1300, t + 1.15);
      t += 1.3;
      return t - ctx.currentTime;
    },
  };

  return {
    sfx,
    get analyser() {
      return analyser;
    },
    get state() {
      return { ...state };
    },
    elapsed() {
      return state.playing && ctx ? ctx.currentTime - state.startedAt : 0;
    },
    play() {
      if (!AudioContextClass) return;
      if (state.muted) {
        state.muted = false;
        notify();
      }
      startSong();
    },
    stop: stopSong,
    setMuted(muted, { chime = true } = {}) {
      state.muted = muted;
      if (muted) stopSong();
      else {
        ensure();
        if (chime) sfx.chime();
      }
      notify();
    },
    setVolume(volume) {
      state.volume = volume;
      if (master) master.gain.setTargetAtTime(volume * MASTER, ctx.currentTime, 0.02);
      notify();
    },
    destroy() {
      stopSong();
      if (ctx) ctx.close();
      ctx = null;
    },
  };
}

function impulse(ctx, seconds) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
    }
  }
  return buffer;
}
