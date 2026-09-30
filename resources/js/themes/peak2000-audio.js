// Sounds for the "peak 2000s" theme: a MIDI-style jukebox plus sound effects.
//
// Everything is synthesized with the Web Audio API: there are no audio files,
// and the songs (peak2000-songs.js) are original loops written for this site.
// Nothing makes a sound until the visitor presses play (or un-mutes), so the
// page is silent by default.

import { SONGS } from "./peak2000-songs.js";

const MASTER = 0.8;
const LOOKAHEAD = 1.5;

const SEMITONES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const QUALITIES = {
  "": [0, 4, 7],
  m: [0, 3, 7],
  7: [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  sus4: [0, 5, 7],
};

const midiHz = (midi) => 440 * 2 ** ((midi - 69) / 12);
const accidentalShift = (accidental) => (accidental === "#" ? 1 : accidental === "b" ? -1 : 0);

function noteMidi(note) {
  const [, letter, accidental, octave] = /^([A-G])([#b]?)(\d)$/.exec(note);
  return (Number(octave) + 1) * 12 + SEMITONES[letter] + accidentalShift(accidental);
}

function parseChord(symbol) {
  const [, letter, accidental, quality] = /^([A-G])([#b]?)(.*)$/.exec(symbol);
  return { root: (SEMITONES[letter] + accidentalShift(accidental) + 12) % 12, intervals: QUALITIES[quality] };
}

// The close voicing (any inversion, any octave) whose average pitch is nearest `center`.
function voicing({ root, intervals }, center) {
  let best = null;
  for (let inversion = 0; inversion < intervals.length; inversion += 1) {
    const shape = intervals.map((interval, i) => interval + (i < inversion ? 12 : 0)).sort((a, b) => a - b);
    for (let base = 24; base <= 96; base += 12) {
      const notes = shape.map((interval) => base + root + interval);
      const distance = Math.abs(notes.reduce((sum, note) => sum + note, 0) / notes.length - center);
      if (!best || distance < best.distance) best = { notes, distance };
    }
  }
  return best.notes;
}

const bassMidi = ({ root }) => 36 + root; // octave 2

const TRACKS = SONGS.map((song) => {
  const eighth = 60 / song.bpm / 2;
  const bars = song.melody.map((bar, index) => {
    let start = 0;
    const notes = bar.split(" ").map((token) => {
      const [name, length] = token.split(":");
      const note = { midi: name === "R" ? null : noteMidi(name), start, length: Number(length) };
      start += note.length;
      return note;
    });
    return { notes, chords: song.chords[index].split("/").map(parseChord) };
  });
  return { ...song, eighth, bars, duration: bars.length * song.loops * 8 * eighth };
});

// The chord that sounds at a given eighth of the bar.
const chordAt = (bar, eighth) => (bar.chords.length > 1 && eighth >= 4 ? bar.chords[1] : bar.chords[0]);

export function createAudio({ onChange } = {}) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const state = { muted: true, playing: false, volume: 0.6, startedAt: 0, track: 0 };

  let ctx = null;
  let input = null;
  let master = null;
  let analyser = null;
  let sfxBus = null;
  let reverb = null;
  let echo = null;
  let noise = null;
  let pulse25 = null;
  let pulse12 = null;
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

      pulse25 = pulseWave(ctx, 0.25);
      pulse12 = pulseWave(ctx, 0.125);

      reverb = ctx.createConvolver();
      reverb.buffer = impulse(ctx, 1.8);
      const reverbReturn = ctx.createGain();
      reverbReturn.gain.value = 0.22;
      reverb.connect(reverbReturn);
      reverbReturn.connect(compressor);

      echo = ctx.createDelay(1);
      echo.delayTime.value = 0.36;
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

  // Building blocks -----------------------------------------------------------

  function envelope(gain, t, peak, attack, sustain, decay, end, release) {
    gain.setValueAtTime(0, t);
    gain.linearRampToValueAtTime(peak, t + attack);
    gain.setTargetAtTime(sustain, t + attack, decay);
    gain.setTargetAtTime(0, Math.max(t + attack, end), release);
  }

  function voice(type, freq, t, stop, { detune = 0, wave = null } = {}) {
    const osc = ctx.createOscillator();
    if (wave) osc.setPeriodicWave(wave);
    else osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = detune;
    osc.start(t);
    osc.stop(stop);
    return osc;
  }

  function node(kind, settings = {}) {
    const created = kind === "gain" ? ctx.createGain() : ctx.createBiquadFilter();
    if (kind !== "gain") created.type = kind;
    Object.entries(settings).forEach(([key, value]) => {
      created[key].value = value;
    });
    return created;
  }

  function send(amp, out, { echo: toEcho = false, reverb: toReverb = false, bus = out.dry } = {}) {
    amp.connect(bus);
    if (toEcho) amp.connect(out.echo);
    if (toReverb) amp.connect(out.reverb);
  }

  function vibrato(t, stop, freq, targets, { rate = 5.6, depth = 0.007, delay = 0.28 } = {}) {
    const lfo = voice("sine", rate, t, stop);
    const amount = node("gain");
    amount.gain.setValueAtTime(0, t);
    amount.gain.linearRampToValueAtTime(freq * depth, t + delay);
    lfo.connect(amount);
    targets.forEach((osc) => amount.connect(osc.frequency));
  }

  // Lead instruments ----------------------------------------------------------

  function squareLead(out, t, freq, duration) {
    const end = t + duration - 0.02;
    const amp = node("gain");
    envelope(amp.gain, t, 0.07, 0.008, 0.045, 0.08, end, 0.035);
    const filter = node("lowpass", { frequency: 2600 });
    filter.connect(amp);
    send(amp, out, { echo: true, reverb: true });
    const oscs = [0, 8].map((detune) => voice("square", freq, t, end + 0.3, { detune }));
    oscs.forEach((osc) => osc.connect(filter));
    if (duration > 0.3) vibrato(t, end + 0.3, freq, oscs);
  }

  function flute(out, t, freq, duration) {
    const end = t + duration - 0.03;
    const amp = node("gain");
    envelope(amp.gain, t, 0.09, 0.07, 0.075, 0.25, end, 0.14);
    const filter = node("lowpass", { frequency: 3000 });
    filter.connect(amp);
    send(amp, out, { echo: true, reverb: true });
    const body = voice("sine", freq, t, end + 0.6);
    const breath = voice("triangle", freq * 2, t, end + 0.6);
    const breathLevel = node("gain", { gain: 0.12 });
    body.connect(filter);
    breath.connect(breathLevel);
    breathLevel.connect(filter);
    vibrato(t, end + 0.6, freq, [body, breath], { rate: 5, depth: 0.006, delay: 0.35 });
  }

  function supersawLead(out, t, freq, duration) {
    const end = t + duration - 0.02;
    const amp = node("gain");
    envelope(amp.gain, t, 0.045, 0.005, 0.034, 0.1, end, 0.06);
    const filter = node("lowpass", { frequency: 3400, Q: 0.8 });
    filter.connect(amp);
    send(amp, out, { echo: true, reverb: true });
    [-14, 0, 14].forEach((detune) => voice("sawtooth", freq, t, end + 0.3, { detune }).connect(filter));
  }

  function pulseLead(out, t, freq, duration) {
    const end = t + duration - 0.015;
    const amp = node("gain");
    envelope(amp.gain, t, 0.075, 0.002, 0.06, 0.06, end, 0.02);
    send(amp, out, { echo: true });
    voice("square", freq, t, end + 0.1, { wave: pulse25 }).connect(amp);
  }

  function vibes(out, t, freq) {
    const amp = node("gain");
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(0.1, t + 0.004);
    amp.gain.setTargetAtTime(0, t + 0.004, 0.55);
    const tremolo = node("gain", { gain: 0.75 });
    const wobble = voice("sine", 5.5, t, t + 2.6);
    const depth = node("gain", { gain: 0.25 });
    wobble.connect(depth);
    depth.connect(tremolo.gain);
    amp.connect(tremolo);
    send(tremolo, out, { echo: true, reverb: true });
    voice("sine", freq, t, t + 2.6).connect(amp);
    const bell = node("gain");
    bell.gain.setValueAtTime(0.25, t);
    bell.gain.setTargetAtTime(0, t, 0.05);
    voice("sine", freq * 4, t, t + 0.4).connect(bell);
    bell.connect(amp);
  }

  // Chords ----------------------------------------------------------------------

  function stab(out, t, freqs) {
    freqs.forEach((freq) => {
      const amp = node("gain");
      envelope(amp.gain, t, 0.045, 0.004, 0.012, 0.05, t + 0.14, 0.05);
      send(amp, out, { reverb: true });
      [["triangle", 1, 1], ["sine", 2, 0.35]].forEach(([type, ratio, level]) => {
        const mix = node("gain", { gain: level });
        voice(type, freq * ratio, t, t + 0.5).connect(mix);
        mix.connect(amp);
      });
    });
  }

  function pad(out, t, freqs, duration, { attack = 0.18, cutoff = 950, peak = 0.02, voices = 1, bus = out.dry } = {}) {
    const amp = node("gain");
    envelope(amp.gain, t, peak, attack, peak * 0.8, 0.3, t + duration - 0.1, 0.18);
    const filter = node("lowpass", { frequency: cutoff });
    filter.connect(amp);
    send(amp, out, { reverb: true, bus });
    freqs.forEach((freq, index) => {
      voice("sawtooth", freq, t, t + duration + 0.8, { detune: (index - 1) * 6 }).connect(filter);
      if (voices > 1) voice("sawtooth", freq, t, t + duration + 0.8, { detune: 12 - index * 5 }).connect(filter);
    });
  }

  function piano(out, t, freq) {
    const amp = node("gain");
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(0.05, t + 0.004);
    amp.gain.setTargetAtTime(0, t + 0.004, 0.45);
    send(amp, out, { reverb: true });
    voice("triangle", freq, t, t + 2.4).connect(amp);
    const shine = node("gain", { gain: 0.3 });
    voice("sine", freq * 2, t, t + 2.4).connect(shine);
    shine.connect(amp);
  }

  function rhodes(out, t, freqs, length) {
    freqs.forEach((freq) => {
      const amp = node("gain");
      amp.gain.setValueAtTime(0, t);
      amp.gain.linearRampToValueAtTime(0.032, t + 0.006);
      amp.gain.setTargetAtTime(0, t + length, 0.12);
      send(amp, out, { reverb: true });
      voice("sine", freq, t, t + length + 0.8).connect(amp);
      const tine = node("gain", { gain: 0.18 });
      voice("sine", freq * 2, t, t + length + 0.8).connect(tine);
      tine.connect(amp);
    });
  }

  function arp(out, t, freq, { wave = null, peak = 0.03, length = 0.09, cutoff = 2200 } = {}) {
    const amp = node("gain");
    amp.gain.setValueAtTime(peak, t);
    amp.gain.setTargetAtTime(0, t + 0.01, length / 3);
    const filter = node("lowpass", { frequency: cutoff });
    filter.connect(amp);
    send(amp, out, { echo: true });
    voice("square", freq, t, t + length + 0.1, { wave }).connect(filter);
  }

  // Bass --------------------------------------------------------------------------

  function pluckBass(out, t, freq, eighth, bus = out.dry) {
    const filter = node("lowpass", { Q: 5 });
    filter.frequency.setValueAtTime(1300, t);
    filter.frequency.exponentialRampToValueAtTime(260, t + 0.14);
    const amp = node("gain");
    envelope(amp.gain, t, 0.2, 0.004, 0.08, 0.06, t + eighth * 0.8, 0.03);
    filter.connect(amp);
    amp.connect(bus);
    voice("sawtooth", freq, t, t + eighth + 0.2).connect(filter);
  }

  function softBass(out, t, freq, duration, type = "triangle") {
    const amp = node("gain");
    envelope(amp.gain, t, 0.22, 0.015, 0.17, 0.3, t + duration - 0.05, 0.08);
    const filter = node("lowpass", { frequency: 700 });
    filter.connect(amp);
    amp.connect(out.dry);
    voice(type, freq, t, t + duration + 0.5).connect(filter);
  }

  // Drums ----------------------------------------------------------------------

  function kick(out, t, peak = 0.55) {
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(44, t + 0.11);
    const amp = node("gain");
    amp.gain.setValueAtTime(peak, t);
    amp.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    osc.connect(amp);
    amp.connect(out.dry);
    osc.start(t);
    osc.stop(t + 0.3);
  }

  function chipKick(out, t) {
    const osc = voice("triangle", 420, t, t + 0.14);
    osc.frequency.setValueAtTime(420, t);
    osc.frequency.exponentialRampToValueAtTime(55, t + 0.07);
    const amp = node("gain");
    amp.gain.setValueAtTime(0.45, t);
    amp.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
    osc.connect(amp);
    amp.connect(out.dry);
  }

  function hiss(out, t, { type, frequency, q = 0.7, peak, decay, send: toReverb = false }) {
    const source = ctx.createBufferSource();
    source.buffer = noise;
    source.loop = true;
    const filter = node(type, { frequency, Q: q });
    const amp = node("gain");
    amp.gain.setValueAtTime(peak, t);
    amp.gain.exponentialRampToValueAtTime(0.0008, t + decay);
    source.connect(filter);
    filter.connect(amp);
    amp.connect(out.dry);
    if (toReverb) amp.connect(out.reverb);
    source.start(t, Math.random() * 0.5);
    source.stop(t + decay + 0.02);
  }

  const hat = (out, t, peak = 0.05, decay = 0.035) => hiss(out, t, { type: "highpass", frequency: 7500, peak, decay });
  const crash = (out, t, peak = 0.1) => hiss(out, t, { type: "highpass", frequency: 3600, peak, decay: 1.4, send: true });

  function snare(out, t) {
    hiss(out, t, { type: "bandpass", frequency: 1900, q: 0.8, peak: 0.3, decay: 0.15, send: true });
    const body = voice("triangle", 200, t, t + 0.1);
    body.frequency.setValueAtTime(200, t);
    body.frequency.exponentialRampToValueAtTime(120, t + 0.08);
    const amp = node("gain");
    amp.gain.setValueAtTime(0.22, t);
    amp.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    body.connect(amp);
    amp.connect(out.dry);
  }

  function clap(out, t) {
    [0, 0.011, 0.022].forEach((offset, i) => {
      hiss(out, t + offset, { type: "bandpass", frequency: 1300, q: 1.1, peak: 0.24, decay: i === 2 ? 0.16 : 0.012, send: i === 2 });
    });
  }

  function rim(out, t, peak = 0.12) {
    hiss(out, t, { type: "bandpass", frequency: 3200, q: 4, peak: peak * 1.6, decay: 0.035 });
    const amp = node("gain");
    amp.gain.setValueAtTime(peak * 0.5, t);
    amp.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    voice("sine", 1750, t, t + 0.05).connect(amp);
    amp.connect(out.dry);
  }

  // Styles: how each band plays one bar ------------------------------------------------

  const melody = (bar, t, eighth, play) =>
    bar.notes.forEach(({ midi, start, length }) => {
      if (midi !== null) play(t + start * eighth, midiHz(midi), length * eighth);
    });

  const eachChord = (bar, t, eighth, play) =>
    bar.chords.forEach((chord, i) => play(chord, t + i * (8 / bar.chords.length) * eighth, (8 / bar.chords.length) * eighth));

  const STYLES = {
    pop: {
      level: 1,
      echo: 1,
      reverb: 0.35,
      bar(out, bar, t, e, { index }) {
        melody(bar, t, e, (at, freq, length) => squareLead(out, at, freq, length));
        for (let i = 0; i < 8; i += 1) {
          const chord = chordAt(bar, i);
          const root = midiHz(bassMidi(chord));
          pluckBass(out, t + i * e, i % 2 ? root * 2 : root, e);
          if (i % 2) stab(out, t + i * e, voicing(chord, 62).map(midiHz));
        }
        eachChord(bar, t, e, (chord, at, length) => pad(out, at, voicing(chord, 62).map(midiHz), length));
        for (let s = 0; s < 16; s += 1) {
          const at = t + (s * e) / 2;
          if (s === 0 || s === 8 || (index >= 8 && s === 10)) kick(out, at);
          if (s === 4 || s === 12) snare(out, at);
          if (s % 2 === 0) {
            const open = s === 14 && index % 2 === 1;
            hat(out, at, s % 4 === 2 ? 0.09 : 0.05, open ? 0.22 : 0.035);
          }
        }
        if (index === 0 || index === 8) crash(out, t);
      },
    },

    trance: {
      level: 1,
      echo: 1.2,
      reverb: 0.3,
      bar(out, bar, t, e, { index, loop }) {
        const beat = e * 2;
        for (let k = 0; k < 4; k += 1) {
          out.pump.gain.setValueAtTime(0.28, t + k * beat);
          out.pump.gain.linearRampToValueAtTime(1, t + k * beat + beat * 0.55);
        }
        if (loop > 0) melody(bar, t, e, (at, freq, length) => supersawLead(out, at, freq, length));
        eachChord(bar, t, e, (chord, at, length) =>
          pad(out, at, voicing(chord, 64).map(midiHz), length, { attack: 0.02, cutoff: 2400, peak: 0.016, voices: 2, bus: out.pump }));
        for (let i = 1; i < 8; i += 2) pluckBass(out, t + i * e, midiHz(bassMidi(chordAt(bar, i))), e, out.pump);
        for (let s = 0; s < 16; s += 1) {
          const at = t + (s * e) / 2;
          const notes = voicing(chordAt(bar, s / 2), 76);
          arp(out, at, midiHz(notes[[0, 1, 2, 1][s % 4] % notes.length]), { peak: 0.024 });
          if (s % 4 === 0) kick(out, at, 0.6);
          if (s === 4 || s === 12) clap(out, at);
          if (s % 4 === 2) hat(out, at, 0.07, 0.12);
          else hat(out, at, 0.022, 0.025);
        }
        if (index === 0) crash(out, t, 0.09);
      },
    },

    ballad: {
      level: 0.75,
      echo: 0.8,
      reverb: 0.7,
      bar(out, bar, t, e, { index }) {
        melody(bar, t, e, (at, freq, length) => flute(out, at, freq, length));
        eachChord(bar, t, e, (chord, at, length) =>
          pad(out, at, voicing(chord, 60).map(midiHz), length, { attack: 0.45, cutoff: 1300, peak: 0.018 }));
        const order = [0, 1, 2, 3, 2, 1, 2, 3];
        for (let i = 0; i < 8; i += 1) {
          const notes = voicing(chordAt(bar, i), 57);
          const tones = [...notes, notes[0] + 12];
          piano(out, t + i * e, midiHz(tones[order[i] % tones.length]));
        }
        [0, 4].forEach((i) => {
          const root = bassMidi(chordAt(bar, i));
          softBass(out, t + i * e, midiHz(i === 0 ? root : root + 7), 4 * e, "sine");
        });
        if (index >= 8) {
          kick(out, t, 0.3);
          kick(out, t + 5 * e, 0.22);
          rim(out, t + 4 * e, 0.1);
          rim(out, t + 12 * e / 2, 0.1);
          for (let i = 0; i < 8; i += 1) hat(out, t + i * e, 0.022, 0.05);
        }
        if (index === 8) crash(out, t, 0.06);
      },
    },

    bossa: {
      level: 1,
      echo: 0.6,
      reverb: 0.35,
      bar(out, bar, t, e) {
        melody(bar, t, e, (at, freq) => vibes(out, at, freq));
        [0, 3, 6, 10, 12].forEach((s) => rhodes(out, t + (s * e) / 2, voicing(chordAt(bar, s / 2), 62).map(midiHz), s === 0 ? 0.5 : 0.26));
        [[0, 0, 1.5], [3, 7, 1], [4, 0, 1.5], [7, 7, 1]].forEach(([i, interval, length]) =>
          softBass(out, t + i * e, midiHz(bassMidi(chordAt(bar, i)) + interval), length * e));
        [0, 3, 6, 10, 13].forEach((s) => rim(out, t + (s * e) / 2, 0.1));
        for (let s = 0; s < 16; s += 1) {
          hiss(out, t + (s * e) / 2, { type: "highpass", frequency: 8500, peak: s % 2 ? 0.035 : 0.018, decay: 0.035 });
        }
        kick(out, t, 0.28);
        kick(out, t + 4 * e, 0.22);
      },
    },

    chip: {
      level: 0.85,
      echo: 0.4,
      reverb: 0,
      bar(out, bar, t, e, { index }) {
        melody(bar, t, e, (at, freq, length) => pulseLead(out, at, freq, length));
        for (let s = 0; s < 16; s += 1) {
          const at = t + (s * e) / 2;
          const notes = voicing(chordAt(bar, s / 2), 76);
          arp(out, at, midiHz(notes[s % notes.length]), { wave: pulse12, peak: 0.034, length: 0.07, cutoff: 6000 });
          if (s === 0 || s === 8 || (index % 2 === 1 && s === 10)) chipKick(out, at);
          if (s === 4 || s === 12) hiss(out, at, { type: "highpass", frequency: 1500, peak: 0.2, decay: 0.09 });
          if (s % 4 === 2) hiss(out, at, { type: "highpass", frequency: 7000, peak: 0.06, decay: 0.02 });
        }
        for (let i = 0; i < 8; i += 1) {
          const root = bassMidi(chordAt(bar, i));
          softBass(out, t + i * e, midiHz(i % 2 ? root + 12 : root), e * 0.9);
        }
      },
    },
  };

  // Jukebox ---------------------------------------------------------------------------

  function startTrack(index) {
    const context = ensure();
    if (!context) return;
    if (session) stopSong({ quiet: true });

    const out = {
      dry: context.createGain(),
      pump: context.createGain(),
      echo: context.createGain(),
      reverb: context.createGain(),
    };
    out.pump.connect(out.dry);
    out.dry.connect(input);
    out.echo.connect(echo);
    out.reverb.connect(reverb);

    const current = { out, track: index, bar: 0, loop: 0, next: context.currentTime + 0.08, timer: 0, pending: [] };

    // Levels and effects follow the track that is about to start at `at`.
    const begin = (trackIndex, at) => {
      const track = TRACKS[trackIndex];
      const style = STYLES[track.style];
      out.dry.gain.setValueAtTime(style.level, at);
      out.echo.gain.setValueAtTime(style.level * style.echo, at);
      out.reverb.gain.setValueAtTime(style.level * style.reverb, at);
      echo.delayTime.setValueAtTime(track.eighth * 1.5, at);
      const wait = Math.max(0, (at - context.currentTime) * 1000);
      current.pending.push(window.setTimeout(() => {
        state.track = trackIndex;
        state.startedAt = at;
        notify();
      }, wait));
    };

    const tick = () => {
      if (current.next < context.currentTime) current.next = context.currentTime + 0.05;
      while (current.next < context.currentTime + LOOKAHEAD) {
        const track = TRACKS[current.track];
        STYLES[track.style].bar(out, track.bars[current.bar], current.next, track.eighth, { index: current.bar, loop: current.loop });
        current.next += 8 * track.eighth;
        current.bar += 1;
        if (current.bar === track.bars.length) {
          current.bar = 0;
          current.loop += 1;
          if (current.loop === track.loops) {
            current.loop = 0;
            current.track = (current.track + 1) % TRACKS.length;
            begin(current.track, current.next);
          }
        }
      }
    };

    begin(index, current.next);
    state.track = index;
    state.startedAt = current.next;
    current.timer = window.setInterval(tick, 120);
    tick();
    session = current;
    state.playing = true;
    notify();
  }

  function stopSong({ quiet = false } = {}) {
    if (!session) return;
    const { out, timer, pending } = session;
    window.clearInterval(timer);
    pending.forEach((id) => window.clearTimeout(id));
    const nodes = Object.values(out);
    const now = ctx.currentTime;
    nodes.forEach((gainNode) => {
      gainNode.gain.cancelScheduledValues(now);
      gainNode.gain.setValueAtTime(gainNode.gain.value, now);
      gainNode.gain.setTargetAtTime(0, now, 0.04);
    });
    window.setTimeout(() => nodes.forEach((gainNode) => gainNode.disconnect()), 600);
    session = null;
    state.playing = false;
    if (!quiet) notify();
  }

  // Sound effects ------------------------------------------------------------------

  function tone(freq, t, duration, peak, type = "sine") {
    const osc = voice(type, freq, t, t + duration + 0.02);
    const amp = node("gain");
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(peak, t + 0.005);
    amp.gain.setValueAtTime(peak, t + Math.max(0.006, duration - 0.01));
    amp.gain.linearRampToValueAtTime(0, t + duration);
    osc.connect(amp);
    amp.connect(sfxBus);
    return osc;
  }

  const sfxOut = () => ({ dry: sfxBus, reverb: sfxBus });
  const ready = () => !state.muted && ensure();

  const notes = (list, gap, length, peak, type) => {
    const t = ctx.currentTime + 0.01;
    list.forEach((name, i) => tone(midiHz(noteMidi(name)), t + i * gap, length, peak, type));
  };

  const sfx = {
    click() {
      if (ready()) hiss(sfxOut(), ctx.currentTime, { type: "bandpass", frequency: 2800, q: 1.2, peak: 1, decay: 0.018 });
    },
    blip() {
      if (!ready()) return;
      const t = ctx.currentTime;
      const osc = tone(1320, t, 0.045, 0.2, "square");
      osc.frequency.setValueAtTime(1320, t);
      osc.frequency.exponentialRampToValueAtTime(1980, t + 0.04);
    },
    chime() {
      if (!ready()) return;
      const t = ctx.currentTime + 0.02;
      ["C5", "E5", "G5", "C6", "E6"].forEach((name, index) => {
        const at = t + index * 0.075;
        const amp = node("gain");
        amp.gain.setValueAtTime(0, at);
        amp.gain.linearRampToValueAtTime(0.09, at + 0.006);
        amp.gain.exponentialRampToValueAtTime(0.001, at + 0.6);
        voice("triangle", midiHz(noteMidi(name)), at, at + 0.62).connect(amp);
        amp.connect(sfxBus);
        amp.connect(reverb);
      });
    },
    // Game sounds.
    start() {
      if (ready()) notes(["C5", "E5", "G5", "C6"], 0.06, 0.07, 0.1, "square");
    },
    coin() {
      if (ready()) notes(["B5", "E6"], 0.07, 0.14, 0.1, "square");
    },
    eat() {
      if (!ready()) return;
      const t = ctx.currentTime;
      const osc = tone(660, t, 0.06, 0.14, "square");
      osc.frequency.setValueAtTime(660, t);
      osc.frequency.exponentialRampToValueAtTime(1100, t + 0.05);
    },
    whack() {
      if (!ready()) return;
      kick(sfxOut(), ctx.currentTime, 0.7);
      hiss(sfxOut(), ctx.currentTime, { type: "bandpass", frequency: 900, q: 1, peak: 0.4, decay: 0.07 });
    },
    oops() {
      if (ready()) notes(["E4", "C4"], 0.11, 0.12, 0.12, "sawtooth");
    },
    crash() {
      if (!ready()) return;
      const t = ctx.currentTime;
      const source = ctx.createBufferSource();
      source.buffer = noise;
      source.loop = true;
      const filter = node("lowpass", { Q: 1 });
      filter.frequency.setValueAtTime(4000, t);
      filter.frequency.exponentialRampToValueAtTime(120, t + 0.7);
      const amp = node("gain");
      amp.gain.setValueAtTime(0.6, t);
      amp.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
      source.connect(filter);
      filter.connect(amp);
      amp.connect(sfxBus);
      source.start(t);
      source.stop(t + 0.85);
      const fall = tone(330, t, 0.5, 0.08, "sawtooth");
      fall.frequency.setValueAtTime(330, t);
      fall.frequency.exponentialRampToValueAtTime(50, t + 0.5);
    },
    gameOver() {
      if (ready()) notes(["G4", "E4", "C4", "G3"], 0.16, 0.18, 0.12, "triangle");
    },
    shoot() {
      if (!ready()) return;
      const t = ctx.currentTime;
      const zap = tone(900, t, 0.12, 0.07, "square");
      zap.frequency.setValueAtTime(900, t);
      zap.frequency.exponentialRampToValueAtTime(180, t + 0.12);
      hiss(sfxOut(), t, { type: "highpass", frequency: 3000, peak: 0.1, decay: 0.05 });
    },
    hurt() {
      if (!ready()) return;
      const t = ctx.currentTime;
      const ouch = tone(170, t, 0.16, 0.14, "sawtooth");
      ouch.frequency.setValueAtTime(170, t);
      ouch.frequency.exponentialRampToValueAtTime(70, t + 0.15);
    },
    door() {
      if (!ready()) return;
      const t = ctx.currentTime;
      const source = ctx.createBufferSource();
      source.buffer = noise;
      source.loop = true;
      const filter = node("bandpass", { Q: 2 });
      filter.frequency.setValueAtTime(350, t);
      filter.frequency.exponentialRampToValueAtTime(1400, t + 0.45);
      const amp = node("gain");
      amp.gain.setValueAtTime(0.3, t);
      amp.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      source.connect(filter);
      filter.connect(amp);
      amp.connect(sfxBus);
      source.start(t);
      source.stop(t + 0.55);
    },
    // A dramatic chord for the final boss's entrance.
    boss() {
      if (!ready()) return;
      const t = ctx.currentTime + 0.02;
      const filter = node("lowpass", { Q: 3 });
      filter.frequency.setValueAtTime(180, t);
      filter.frequency.exponentialRampToValueAtTime(2200, t + 1.4);
      const amp = node("gain");
      amp.gain.setValueAtTime(0, t);
      amp.gain.linearRampToValueAtTime(0.09, t + 0.5);
      amp.gain.setTargetAtTime(0, t + 1.6, 0.35);
      filter.connect(amp);
      amp.connect(sfxBus);
      amp.connect(reverb);
      ["C2", "G2", "C3", "D#3", "G3"].forEach((name, i) => {
        voice("sawtooth", midiHz(noteMidi(name)), t, t + 3.2, { detune: (i - 2) * 5 }).connect(filter);
      });
      notes(["C6", "G6"], 0.25, 0.5, 0.05, "triangle");
    },
    pickup() {
      if (ready()) notes(["E5", "G5", "C6"], 0.05, 0.09, 0.1, "triangle");
    },
    caught() {
      if (ready()) notes(["G5", "D6"], 0.06, 0.12, 0.08, "sine");
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
      hiss(sfxOut(), t, { type: "bandpass", frequency: 2300, q: 0.6, peak: 0.12, decay: 1.3 });
      const chirp = tone(900, t, 1.2, 0.025, "sawtooth");
      chirp.frequency.setValueAtTime(900, t);
      chirp.frequency.exponentialRampToValueAtTime(3100, t + 0.55);
      chirp.frequency.exponentialRampToValueAtTime(1300, t + 1.15);
      t += 1.3;
      return t - ctx.currentTime;
    },
  };

  const step = (offset) => (state.track + offset + TRACKS.length) % TRACKS.length;

  return {
    sfx,
    tracks: TRACKS.map(({ title, duration }) => ({ title, duration })),
    get analyser() {
      return analyser;
    },
    get state() {
      return { ...state };
    },
    elapsed() {
      return state.playing && ctx ? Math.max(0, ctx.currentTime - state.startedAt) : 0;
    },
    play(index = state.track) {
      if (!AudioContextClass) return;
      state.muted = false;
      if (!session || index !== state.track) startTrack(index);
      else notify();
    },
    next() {
      if (session) startTrack(step(1));
      else {
        state.track = step(1);
        notify();
      }
    },
    previous() {
      if (session) startTrack(step(-1));
      else {
        state.track = step(-1);
        notify();
      }
    },
    stop: () => stopSong(),
    setMuted(muted, { chime = true } = {}) {
      state.muted = muted;
      if (muted) stopSong({ quiet: true });
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
      stopSong({ quiet: true });
      if (ctx) ctx.close();
      ctx = null;
    },
  };
}

// Fourier series of a pulse wave with the given duty cycle (for the chiptune sound).
function pulseWave(ctx, duty) {
  const size = 48;
  const real = new Float32Array(size);
  const imag = new Float32Array(size);
  for (let k = 1; k < size; k += 1) real[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
  return ctx.createPeriodicWave(real, imag);
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
