/* fog.js — the observation layer. The UI and the CLI only ever see what this returns:
 *  - rival capabilities as estimates from public releases, leaks and intel (error bars widen with time),
 *  - your own safety as an eval estimate (labs tend to overrate themselves) and trust as a poll,
 *  - policy effects as qualitative labels whose confidence grows with experience. */
(function (FL) {
  'use strict';
  const E = FL.Engine;
  const F = {};
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const strength = (state, id) => (state.policies[id] ? 0.2 + 0.8 * state.policies[id].level : 0);
  const gauss = (state) => { const u = Math.max(1e-9, E.rand(state)), v = E.rand(state); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

  F.init = function (state) {
    state.intel = {};
    for (const r of state.rivals) state.intel[r.id] = { est: r.cap + gauss(state) * 2, sd: 2.5, seenAt: 0, source: 'public reporting' };
    state.fogNoise = { safety: gauss(state), trust: gauss(state) };
  };

  /** Intel quality 0..1: competitive intelligence spend plus anyone you hired from that lab recently. */
  F.intelStrength = (state) => clamp(strength(state, 'intel'), 0, 1);

  F.observeRival = function (state, rivalId, value, sd, source) {
    state.intel = state.intel || {};
    state.intel[rivalId] = { est: value, sd, seenAt: state.t || 0, source };
  };

  /** Public estimate of a rival: last observation plus the field's typical pace since then. */
  F.rivalEstimate = function (state, r) {
    const rec = (state.intel || {})[r.id];
    if (!rec) return { est: r.cap, sd: 3, source: 'unknown', age: 0 };
    const age = Math.max(0, (state.t || 0) - rec.seenAt);
    const typicalPace = (r.remote ? 2 : r.rate) * (1 + 0.012 * (state.turn - 1));
    const est = rec.est + typicalPace * age;
    const sd = Math.sqrt(rec.sd * rec.sd + Math.pow(2.4 * age, 2)) * (1 - 0.5 * F.intelStrength(state));
    return { est, sd, source: rec.source, age };
  };
  F.bestRivalEstimate = function (state) {
    let best = null;
    for (const r of state.rivals) { const e = F.rivalEstimate(state, r); if (!best || e.est > best.est) best = { ...e, rival: r }; }
    return best;
  };

  /** Your safety as measured by your evals, and trust as measured by polls. */
  F.evalStrength = (state) => clamp(0.5 * strength(state, 'redteam') + 0.3 * strength(state, 'audits') + 0.3 * strength(state, 'interp'), 0, 0.9);
  F.measured = function (state, statId) {
    const v = state.values[statId];
    if (statId === 'safety') {
      const sd = 0.16 * (1 - F.evalStrength(state));
      const bias = 0.07 * (1 - strength(state, 'audits')); // without outside audits, labs grade themselves generously
      return { est: clamp(v + bias + state.fogNoise.safety * sd, 0, 1), sd, kind: 'eval estimate' };
    }
    if (statId === 'trust') {
      const sd = 0.04;
      return { est: clamp(v + state.fogNoise.trust * sd, 0, 1), sd, kind: 'poll' };
    }
    return { est: v, sd: 0, kind: 'measured' };
  };
  F.FOGGY = ['safety', 'trust'];

  /** Qualitative effect label. Confidence grows the longer the source policy has been running. */
  F.effectLabel = function (state, e, src) {
    const isPolicy = E.nodeType(e.from) === 'policy';
    const p = isPolicy ? state.policies[e.from] : null;
    const exp = p ? Math.max(0, (state.t || 0) - (p.since == null ? 0 : (p.since - 1))) : isPolicy ? 0 : 2;
    const known = exp >= 2;
    const k = e.k * (known && FL.World ? FL.World.edgeMult(state, e) : 1);
    const m = Math.abs(k * E.curve(e.curve, src == null ? 0.6 : src));
    const size = m < 0.015 ? 'negligible' : m < 0.05 ? 'small' : m < 0.11 ? 'moderate' : 'large';
    const dir = k >= 0 ? 'raises' : 'lowers';
    const confidence = exp < 0.5 ? 'guess' : exp < 2 ? 'rough' : 'measured';
    return { size, dir, confidence, text: `${size === 'negligible' ? 'barely moves' : `${dir} (${size})`}`, sign: Math.sign(k), mag: ['negligible', 'small', 'moderate', 'large'].indexOf(size) };
  };

  /** Leaks and intel reports arrive during play. */
  F.tick = function (state, qr, dt) {
    const s = F.intelStrength(state);
    const rate = 0.12 + 1.2 * s; // reports per quarter
    if (E.rand(state) > rate * dt || !state.rivals.length) return;
    const r = state.rivals[Math.floor(E.rand(state) * state.rivals.length)];
    if (r.remote) return;
    const sd = s > 0.3 ? 2 : 5;
    F.observeRival(state, r.id, r.cap + gauss(state) * sd, sd, s > 0.3 ? 'intel report' : 'rumor');
    E.emit(state, { type: 'intel', rival: r.name, source: s > 0.3 ? 'intel report' : 'rumor' });
  };

  /** New eval and poll readings each quarter. */
  F.quarter = function (state) {
    state.fogNoise.safety = 0.6 * state.fogNoise.safety + 0.8 * gauss(state);
    state.fogNoise.trust = gauss(state);
  };

  /** Everything the player may see, for the UI and the CLI. */
  F.view = function (state) {
    const stats = {};
    for (const s of FL.STATS.concat(FL.INDICATORS)) {
      const m = F.measured(state, s.id);
      stats[s.id] = m.sd ? { est: +m.est.toFixed(2), plusMinus: +(1.6 * m.sd).toFixed(2), kind: m.kind } : +state.values[s.id].toFixed(2);
    }
    const rivals = state.rivals.map((r) => { const e = F.rivalEstimate(state, r); return { name: r.name, estimate: +e.est.toFixed(0), plusMinus: +(1.6 * e.sd).toFixed(0), source: e.source, player: r.player || null }; });
    return { stats, rivals, notes: (state.world ? state.world.notes : []).slice(-6).map((n) => n.text) };
  };

  FL.Fog = F;
})(globalThis.FL = globalThis.FL || {});
