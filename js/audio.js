/* audio.js — synthesized WebAudio SFX and an adaptive ambient drone. No asset files.
 * Starts silent until the first user gesture (browser autoplay rules). */
(function (FL) {
  'use strict';
  const A = {};
  const KEY = 'frontierlab.audio';
  let ctx = null, master = null, sfxBus = null, droneBus = null, drone = null;
  let prefs = { muted: false, volume: 0.5 };
  try { Object.assign(prefs, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* defaults */ }
  let streak = 0, live = 0, droneLevel = 0;

  function savePrefs() { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) { /* ignore */ } }

  A.unlock = function () {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = prefs.muted ? 0 : prefs.volume;
    master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);
    droneBus = ctx.createGain(); droneBus.gain.value = 0; droneBus.connect(master);
    startDrone();
  };

  /** One enveloped oscillator note. */
  function tone(freq, { type = 'sine', at = 0, attack = 0.005, decay = 0.3, gain = 0.2, glideTo = null, filter = null } = {}) {
    if (!ctx || live > 12) return;
    const t0 = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + decay);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
    let node = osc;
    if (filter) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = filter;
      osc.connect(f); node = f;
    }
    node.connect(g); g.connect(sfxBus);
    live++;
    osc.onended = () => live--;
    osc.start(t0); osc.stop(t0 + attack + decay + 0.05);
  }

  function noise(dur, { at = 0, gain = 0.08, freq = 3000 } = {}) {
    if (!ctx) return;
    const t0 = ctx.currentTime + at;
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = ctx.createBufferSource();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    src.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq; g.gain.value = gain;
    src.connect(f); f.connect(g); g.connect(sfxBus);
    src.start(t0);
  }

  const semis = (f, n) => f * Math.pow(2, n / 12);

  /** Duck the drone ~6dB under stingers. */
  function duck(ms) {
    if (!droneBus) return;
    const t = ctx.currentTime;
    droneBus.gain.cancelScheduledValues(t);
    droneBus.gain.setTargetAtTime(droneLevel * 0.5, t, 0.05);
    droneBus.gain.setTargetAtTime(prefs.muted ? 0 : droneLevel, t + ms / 1000, 0.5);
  }

  const CUES = {
    hover: () => tone(2000, { decay: 0.02, gain: 0.03 }),
    click: () => tone(1200, { type: 'triangle', attack: 0.002, decay: 0.04, gain: 0.12 }),
    enact: () => { tone(523, { decay: 0.18, gain: 0.14 }); tone(784, { at: 0.06, decay: 0.25, gain: 0.12 }); },
    cancel: () => { tone(392, { decay: 0.15, gain: 0.12 }); tone(294, { at: 0.07, decay: 0.25, gain: 0.1 }); },
    endTurn: () => { noise(0.35, { gain: 0.05, freq: 900 }); tone(196, { type: 'triangle', decay: 0.4, gain: 0.1, glideTo: 392 }); },
    tick: (o) => tone(3000 + ((o && o.pitch) || 0) * 1200, { decay: 0.01, gain: 0.025 }),
    chime: () => {
      const root = semis(523.25, Math.min(12, streak));
      [0, 4, 7].forEach((n, i) => tone(semis(root, n), { at: i * 0.06, decay: 0.3, gain: 0.12 }));
    },
    cash: () => {
      duck(800);
      tone(1318, { decay: 0.15, gain: 0.12 }); tone(1760, { at: 0.05, decay: 0.3, gain: 0.12 });
      for (let i = 0; i < 8; i++) tone(2000 + Math.random() * 2000, { at: 0.1 + i * 0.03, decay: 0.03, gain: 0.04 });
    },
    milestone: () => {
      duck(1500);
      const root = semis(392, Math.min(12, streak));
      [0, 4, 7, 12].forEach((n, i) => tone(semis(root, n), { at: i * 0.08, decay: 0.5, gain: 0.12 }));
      tone(semis(root, 24), { at: 0.34, decay: 0.6, gain: 0.05, glideTo: semis(root, 26) });
    },
    artifact: (o) => {
      const rare = o && o.rarity;
      const root = rare === 'legendary' ? 659 : rare === 'rare' ? 587 : 523;
      [0, 7, 12].forEach((n, i) => tone(semis(root, n), { at: i * 0.05, decay: 0.35, gain: 0.09, type: 'triangle' }));
      if (rare === 'legendary') tone(semis(root, 24), { at: 0.2, decay: 0.9, gain: 0.05, glideTo: semis(root, 31) });
    },
    warn: () => { [0, 0.16].forEach((at) => { tone(440, { type: 'square', at, decay: 0.12, gain: 0.05, filter: 1500 }); tone(466, { type: 'square', at, decay: 0.12, gain: 0.05, filter: 1500 }); }); },
    crisis: () => { duck(1200); tone(220, { type: 'sawtooth', decay: 0.6, gain: 0.1, glideTo: 110, filter: 1800 }); noise(0.3, { gain: 0.06, freq: 400 }); },
    decision: () => { tone(330, { type: 'triangle', decay: 0.5, gain: 0.08 }); tone(494, { type: 'triangle', at: 0.1, decay: 0.6, gain: 0.06 }); },
    win: () => { duck(3000); [0, 4, 7, 12, 16, 19, 24].forEach((n, i) => tone(semis(392, n), { at: i * 0.11, decay: 0.7, gain: 0.1 })); },
    lose: () => { duck(3000); [0, -3, -7, -12].forEach((n, i) => tone(semis(330, n), { type: 'triangle', at: i * 0.22, decay: 0.8, gain: 0.1 })); },
  };

  /** Play a named cue. Positive cues raise the streak (rising pitch); bad ones reset it. */
  A.play = function (name, opts) {
    if (!ctx || prefs.muted || !CUES[name]) return;
    if (name === 'chime' || name === 'milestone') streak = Math.min(12, streak + 1);
    if (name === 'crisis' || name === 'lose' || name === 'warn') streak = 0;
    try { CUES[name](opts); } catch (e) { /* audio is best-effort */ }
  };

  function startDrone() {
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = 220; filt.Q.value = 2;
    const trem = ctx.createGain(); trem.gain.value = 1;
    const lfo = ctx.createOscillator(); const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.2; lfoGain.gain.value = 0.15;
    lfo.connect(lfoGain); lfoGain.connect(trem.gain); lfo.start();
    [3, -3].forEach((cents) => {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 55 * Math.pow(2, cents / 1200); o.connect(filt); o.start();
    });
    const fifth = ctx.createOscillator(); fifth.type = 'sine'; fifth.frequency.value = 82.4;
    const fifthGain = ctx.createGain(); fifthGain.gain.value = 0;
    fifth.connect(fifthGain); fifthGain.connect(filt); fifth.start();
    filt.connect(trem); trem.connect(droneBus);
    drone = { filt, lfo, fifthGain };
  }

  /** Ambient intensity 0..1: filter opens, gain rises, tremolo quickens, a fifth joins at high stakes. */
  A.setTension = function (level) {
    if (!ctx || !drone) return;
    const t = ctx.currentTime, x = Math.max(0, Math.min(1, level));
    droneLevel = 0.03 + 0.07 * x;
    droneBus.gain.setTargetAtTime(prefs.muted ? 0 : droneLevel, t, 2);
    drone.filt.frequency.setTargetAtTime(200 + 1600 * x, t, 2);
    drone.lfo.frequency.setTargetAtTime(0.2 + 3.8 * x * x, t, 2);
    drone.fifthGain.gain.setTargetAtTime(x > 0.7 ? 0.25 : 0, t, 2);
  };

  A.setMuted = function (m) {
    prefs.muted = !!m;
    savePrefs();
    if (master) master.gain.setTargetAtTime(prefs.muted ? 0 : prefs.volume, ctx.currentTime, 0.05);
  };
  A.isMuted = () => prefs.muted;

  FL.Audio = A;
})(globalThis.FL = globalThis.FL || {});
