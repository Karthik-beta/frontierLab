/* world.js — each run's hidden world: randomized effect strengths and 2-3 secret world traits.
 * The player never sees these directly. Analyst notes hint at them over time — and about a
 * third of the notes describe traits this world does NOT have. */
(function (FL) {
  'use strict';
  const E = FL.Engine;
  const W = {};
  const traitOf = (id) => FL.WORLD_TRAITS.find((t) => t.id === id);

  /** Sample edge multipliers and traits for a new run (deterministic per seed). */
  W.init = function (state) {
    const effects = E.allEffects();
    const mult = effects.map(() => +(0.6 + 0.8 * E.rand(state)).toFixed(3));
    const pool = FL.WORLD_TRAITS.map((t) => t.id);
    const traits = [];
    const want = 2 + (E.rand(state) < 0.5 ? 1 : 0);
    while (traits.length < want && pool.length) {
      const id = pool.splice(Math.floor(E.rand(state) * pool.length), 1)[0];
      const clash = FL.WORLD_EXCLUSIVE.some(([a, b]) => (a === id && traits.includes(b)) || (b === id && traits.includes(a)));
      if (!clash) traits.push(id);
    }
    // Fold edge-specific trait mods into the multipliers.
    for (const id of traits) {
      for (const [key, m] of Object.entries(traitOf(id).mods)) {
        if (!key.startsWith('edge:')) continue;
        const [from, to] = key.slice(5).split('>');
        effects.forEach((e, i) => { if (e.from === from && e.to === to) mult[i] *= m; });
      }
    }
    state.world = { mult, traits, notes: [], hinted: [] };
  };

  W.edgeMult = (state, e) => (state.world && state.world.mult[e.idx]) || 1;

  /** Trait hooks: multiplicative for plain keys, additive for 'base:' keys. */
  W.mod = function (state, key, dflt) {
    if (!state.world) return dflt;
    let v = dflt;
    for (const id of state.world.traits) {
      const m = traitOf(id).mods[key];
      if (m == null) continue;
      v = key.startsWith('base:') ? v + m : v * m;
    }
    return v;
  };

  /** Now and then an analyst note arrives. Roughly two in three are about this world. */
  W.tick = function (state, qr, dt) {
    const w = state.world;
    if (!w || state.turn < 2 || E.rand(state) > 0.3 * dt) return;
    const truthful = E.rand(state) < 0.67;
    const pool = FL.WORLD_TRAITS.filter((t) => (truthful ? w.traits.includes(t.id) : !w.traits.includes(t.id)) && !w.hinted.includes(t.id));
    if (!pool.length) return;
    const t = pool[Math.floor(E.rand(state) * pool.length)];
    w.hinted.push(t.id);
    const note = { week: state.week, text: t.hint };
    w.notes.push(note);
    (qr.notes = qr.notes || []).push(t.hint);
    E.emit(state, { type: 'note', text: t.hint });
  };

  /** Revealed at the end of the run. */
  W.reveal = (state) => (state.world ? state.world.traits.map((id) => traitOf(id).name) : []);

  FL.World = W;
})(globalThis.FL = globalThis.FL || {});
