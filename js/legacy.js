/* legacy.js — prestige (Cookie Clicker's ascension): finishing a single-player run earns Legacy
 * points to spend on small permanent perks for future runs. */
(function (FL) {
  'use strict';
  const E = FL.Engine;
  const L = {};

  /** Points for a finished run: mostly score, a bonus for winning, a little for surviving long. */
  L.earned = function (state) {
    if (!state.ended) return 0;
    return Math.max(1, Math.floor(E.score(state) / 300) + (state.ended.win ? 3 : 0) + Math.floor(state.turn / 10));
  };

  L.apply = function (state, perks) {
    for (const id of perks || []) {
      const p = FL.LEGACY_PERKS.find((x) => x.id === id);
      if (p) { try { p.apply(state); } catch (e) { /* perk is best-effort */ } }
    }
    state.perks = (perks || []).slice();
  };

  FL.Legacy = L;
})(globalThis.FL = globalThis.FL || {});
